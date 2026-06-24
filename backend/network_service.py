"""Criminal network analysis: build an intelligence graph and run analytics.

Entities become nodes (FIR, suspect, witness, evidence, police station) and the
relationships between them become edges. Because the database holds 100k+ FIRs,
the graph is always *scoped* (by district / crime type / status / a focus
suspect or FIR, plus a hard node cap) so the result stays interpretable and the
frontend stays responsive.

All queries run on the read-only session — this module never writes.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

from sqlalchemy import func
from sqlalchemy.orm import Session

from models import (
    District,
    Evidence,
    FIR,
    FIRSuspect,
    PoliceStation,
    Suspect,
    Witness,
)

# Hard caps so a broad filter can't return an unusable graph.
MAX_FIRS = 120
MAX_NODES = 600


@dataclass
class GraphNode:
    id: str
    type: str  # fir | suspect | witness | evidence | station
    label: str
    meta: dict = field(default_factory=dict)


@dataclass
class GraphEdge:
    id: str
    source: str
    target: str
    type: str  # accused_in | co_accused | witnessed | evidence_of | filed_at


@dataclass
class NetworkGraph:
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    stats: dict
    repeat_offenders: list[dict]
    most_connected: list[dict]
    crime_groups: list[dict]


def _scoped_fir_query(db: Session, filters: dict):
    query = db.query(FIR)
    if filters.get("crime_type"):
        query = query.filter(FIR.crime_type == filters["crime_type"])
    if filters.get("status"):
        query = query.filter(FIR.status == filters["status"])
    if filters.get("district_id"):
        query = query.filter(FIR.district_id == filters["district_id"])
    return query


def _focus_fir_ids(db: Session, filters: dict) -> list[int]:
    """Resolve which FIRs anchor the graph.

    Priority: a focus suspect's FIRs -> a single focus FIR -> filtered set.
    """
    if filters.get("suspect_id"):
        rows = (
            db.query(FIRSuspect.fir_id)
            .filter(FIRSuspect.suspect_id == filters["suspect_id"])
            .limit(MAX_FIRS)
            .all()
        )
        return [r[0] for r in rows]
    if filters.get("fir_id"):
        return [filters["fir_id"]]
    rows = (
        _scoped_fir_query(db, filters)
        .order_by(FIR.incident_date.desc())
        .limit(MAX_FIRS)
        .all()
    )
    return [fir.id for fir in rows]


def build_network(db: Session, filters: dict, *, include_witness_evidence: bool = True) -> NetworkGraph:
    fir_ids = _focus_fir_ids(db, filters)
    if not fir_ids:
        return NetworkGraph([], [], {"firs": 0, "suspects": 0, "edges": 0}, [], [], [])

    firs = db.query(FIR).filter(FIR.id.in_(fir_ids)).all()
    district_names = {
        d.id: d.name for d in db.query(District).all()
    }
    station_names = {
        s.id: s.name for s in db.query(PoliceStation).filter(PoliceStation.id.in_([f.police_station_id for f in firs])).all()
    }

    nodes: dict[str, GraphNode] = {}
    edges: list[GraphEdge] = []

    def add_node(node: GraphNode) -> None:
        if node.id not in nodes and len(nodes) < MAX_NODES:
            nodes[node.id] = node

    # FIR + station nodes/edges.
    for fir in firs:
        fir_key = f"fir:{fir.id}"
        add_node(
            GraphNode(
                id=fir_key,
                type="fir",
                label=fir.fir_number,
                meta={
                    "crime_type": fir.crime_type,
                    "status": fir.status,
                    "district": district_names.get(fir.district_id, ""),
                    "incident_date": str(fir.incident_date),
                },
            )
        )
        if fir.police_station_id:
            station_key = f"station:{fir.police_station_id}"
            add_node(
                GraphNode(
                    id=station_key,
                    type="station",
                    label=station_names.get(fir.police_station_id, f"Station #{fir.police_station_id}"),
                    meta={"district": district_names.get(fir.district_id, "")},
                )
            )
            edges.append(
                GraphEdge(id=f"e_filed_{fir.id}", source=fir_key, target=station_key, type="filed_at")
            )

    # Suspect ↔ FIR (accused_in) and gather suspect→firs for co-accused + repeat detection.
    suspect_links = db.query(FIRSuspect).filter(FIRSuspect.fir_id.in_(fir_ids)).all()
    suspect_ids = list({link.suspect_id for link in suspect_links})
    suspects = {
        s.id: s for s in db.query(Suspect).filter(Suspect.id.in_(suspect_ids)).all()
    }
    suspect_to_firs: dict[int, set[int]] = defaultdict(set)
    fir_to_suspects: dict[int, set[int]] = defaultdict(set)

    for link in suspect_links:
        suspect = suspects.get(link.suspect_id)
        if not suspect:
            continue
        suspect_key = f"suspect:{suspect.id}"
        add_node(
            GraphNode(
                id=suspect_key,
                type="suspect",
                label=suspect.name,
                meta={"alias": suspect.alias or "", "age": suspect.age},
            )
        )
        edges.append(
            GraphEdge(
                id=f"e_acc_{link.fir_id}_{suspect.id}",
                source=suspect_key,
                target=f"fir:{link.fir_id}",
                type="accused_in",
            )
        )
        suspect_to_firs[suspect.id].add(link.fir_id)
        fir_to_suspects[link.fir_id].add(suspect.id)

    # Co-accused edges (two suspects sharing an FIR) — the basis for crime groups.
    co_pairs: set[tuple[int, int]] = set()
    for shared_suspects in fir_to_suspects.values():
        members = sorted(shared_suspects)
        for i in range(len(members)):
            for j in range(i + 1, len(members)):
                co_pairs.add((members[i], members[j]))
    for a, b in co_pairs:
        edges.append(
            GraphEdge(id=f"e_co_{a}_{b}", source=f"suspect:{a}", target=f"suspect:{b}", type="co_accused")
        )

    # Witness + evidence nodes (optional, they enlarge the graph quickly).
    if include_witness_evidence:
        for w in db.query(Witness).filter(Witness.fir_id.in_(fir_ids)).limit(MAX_NODES).all():
            wkey = f"witness:{w.id}"
            add_node(GraphNode(id=wkey, type="witness", label=w.name, meta={}))
            edges.append(GraphEdge(id=f"e_wit_{w.id}", source=wkey, target=f"fir:{w.fir_id}", type="witnessed"))
        for e in db.query(Evidence).filter(Evidence.fir_id.in_(fir_ids)).limit(MAX_NODES).all():
            ekey = f"evidence:{e.id}"
            add_node(
                GraphNode(id=ekey, type="evidence", label=e.file_name, meta={"media_type": e.media_type})
            )
            edges.append(
                GraphEdge(id=f"e_ev_{e.id}", source=ekey, target=f"fir:{e.fir_id}", type="evidence_of")
            )

    # Keep only edges whose endpoints survived the node cap.
    edges = [edge for edge in edges if edge.source in nodes and edge.target in nodes]

    analytics = _analyze(db, suspect_to_firs, suspects, co_pairs)

    stats = {
        "firs": len([n for n in nodes.values() if n.type == "fir"]),
        "suspects": len([n for n in nodes.values() if n.type == "suspect"]),
        "witnesses": len([n for n in nodes.values() if n.type == "witness"]),
        "evidence": len([n for n in nodes.values() if n.type == "evidence"]),
        "stations": len([n for n in nodes.values() if n.type == "station"]),
        "nodes": len(nodes),
        "edges": len(edges),
        "co_accused_links": len(co_pairs),
    }

    return NetworkGraph(
        nodes=list(nodes.values()),
        edges=edges,
        stats=stats,
        repeat_offenders=analytics["repeat_offenders"],
        most_connected=analytics["most_connected"],
        crime_groups=analytics["crime_groups"],
    )


def _analyze(
    db: Session,
    suspect_to_firs: dict[int, set[int]],
    suspects: dict[int, Suspect],
    co_pairs: set[tuple[int, int]],
) -> dict:
    # Repeat offenders: suspects linked to >1 FIR within the scope. We also pull
    # their *global* FIR count so the ranking reflects true recidivism.
    global_counts = dict(
        db.query(FIRSuspect.suspect_id, func.count(FIRSuspect.fir_id))
        .filter(FIRSuspect.suspect_id.in_(list(suspects.keys()) or [0]))
        .group_by(FIRSuspect.suspect_id)
        .all()
    )
    repeat_offenders = [
        {
            "suspect_id": sid,
            "name": suspects[sid].name,
            "alias": suspects[sid].alias,
            "fir_count_in_scope": len(firs),
            "fir_count_total": global_counts.get(sid, len(firs)),
        }
        for sid, firs in suspect_to_firs.items()
        if global_counts.get(sid, len(firs)) > 1
    ]
    repeat_offenders.sort(key=lambda r: r["fir_count_total"], reverse=True)

    # Most connected (degree centrality in the co-accused graph).
    degree: dict[int, int] = defaultdict(int)
    for a, b in co_pairs:
        degree[a] += 1
        degree[b] += 1
    most_connected = sorted(
        (
            {"suspect_id": sid, "name": suspects[sid].name, "connections": deg}
            for sid, deg in degree.items()
        ),
        key=lambda r: r["connections"],
        reverse=True,
    )[:10]

    # Crime groups: connected components of the co-accused graph (size >= 2).
    adjacency: dict[int, set[int]] = defaultdict(set)
    for a, b in co_pairs:
        adjacency[a].add(b)
        adjacency[b].add(a)
    seen: set[int] = set()
    groups: list[dict] = []
    for start in adjacency:
        if start in seen:
            continue
        stack = [start]
        component: set[int] = set()
        while stack:
            node = stack.pop()
            if node in seen:
                continue
            seen.add(node)
            component.add(node)
            stack.extend(adjacency[node] - seen)
        if len(component) >= 2:
            members = sorted(component)
            groups.append(
                {
                    "size": len(members),
                    "members": [
                        {"suspect_id": sid, "name": suspects[sid].name} for sid in members
                    ],
                }
            )
    groups.sort(key=lambda g: g["size"], reverse=True)

    return {
        "repeat_offenders": repeat_offenders[:15],
        "most_connected": most_connected,
        "crime_groups": groups[:15],
    }


def search_suspects(db: Session, term: str, limit: int = 20) -> list[dict]:
    """Search suspects by name/alias for the focus selector."""
    pattern = f"%{term}%"
    rows = (
        db.query(Suspect.id, Suspect.name, Suspect.alias)
        .filter((Suspect.name.ilike(pattern)) | (Suspect.alias.ilike(pattern)))
        .order_by(Suspect.name)
        .limit(limit)
        .all()
    )
    return [{"id": r[0], "name": r[1], "alias": r[2]} for r in rows]
