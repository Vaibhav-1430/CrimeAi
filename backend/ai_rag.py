"""Retrieval-Augmented Generation (RAG) over the CrimeAI database.

Turns a free-text investigator question into grounded context by:
  1. Detecting entities in the message (FIR numbers, FIR/case IDs, district
     names, station names, suspect names).
  2. Dynamically querying PostgreSQL (read-only) for the matching records —
     FIR details, suspects, witnesses, evidence, audit logs / timeline, related
     cases, and the officers assigned to the relevant station/district.
  3. Assembling a single context block and a structured list of the data
     sources / FIR references that were actually used.

Only falls back to department-wide analytics when no concrete entity is found,
so the assistant behaves like an investigator with record access — not a
dashboard chatbot.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from sqlalchemy import func
from sqlalchemy.orm import Session

from ai_context import (
    build_fir_context,
    build_insights_context,
    build_related_context,
    extract_fir_references,
)
from crime_playbooks import build_playbook_block
from models import District, FIR, PoliceStation, Suspect, User

# FIR/YYYY/DD/NNNNNNN — the seeded format. Tolerant of spacing/case.
FIR_NUMBER_RE = re.compile(r"\bFIR\s*/\s*\d{4}\s*/\s*\d{1,3}\s*/\s*\d{1,9}\b", re.IGNORECASE)
# Bare "FIR 123" / "FIR #123" / "case 123" → numeric FIR id.
FIR_ID_RE = re.compile(r"\b(?:fir|case)\s*#?\s*(\d{1,9})\b", re.IGNORECASE)

# Common stop-words so we don't match district/suspect names inside chatter.
_STOP = {
    "the", "a", "an", "is", "are", "what", "who", "show", "list", "find", "any",
    "fir", "case", "crime", "district", "station", "suspect", "evidence", "in",
    "of", "for", "and", "or", "me", "give", "tell", "about", "status", "summary",
}


@dataclass
class RagResult:
    context: str
    sources: list[str] = field(default_factory=list)
    fir_references: list[dict] = field(default_factory=list)
    matched_entities: dict = field(default_factory=dict)
    crime_types: list[str] = field(default_factory=list)
    grounded: bool = False  # True when concrete records (not just analytics) were used


def _normalize_fir_number(raw: str) -> str:
    return re.sub(r"\s+", "", raw).upper()


def detect_entities(db: Session, message: str) -> dict:
    """Extract candidate entities from the message and resolve against the DB."""
    entities: dict = {
        "fir_numbers": [],
        "fir_ids": [],
        "districts": [],
        "stations": [],
        "suspects": [],
    }

    # FIR numbers (formatted).
    for m in FIR_NUMBER_RE.findall(message):
        entities["fir_numbers"].append(_normalize_fir_number(m))

    # Bare FIR/case ids.
    for m in FIR_ID_RE.findall(message):
        try:
            entities["fir_ids"].append(int(m))
        except ValueError:
            pass

    lowered = message.lower()

    # District names — match known districts as substrings (handles multi-word).
    for (name,) in db.query(District.name).all():
        base = name.split(" (")[0].strip()
        if base.lower() in lowered:
            entities["districts"].append(name)

    # Station names — match the distinctive prefix (e.g. "Mandya East PS").
    # Only check when "station" / "ps" appears to avoid false hits.
    if "station" in lowered or " ps" in lowered or "p.s" in lowered:
        for (name,) in db.query(PoliceStation.name).limit(2000).all():
            if name.lower() in lowered:
                entities["stations"].append(name)

    # Suspect names — match capitalized 2-word tokens against the suspects table.
    candidates = re.findall(r"\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b", message)
    for cand in candidates:
        if any(w.lower() in _STOP for w in cand.split()):
            continue
        hit = db.query(Suspect.id, Suspect.name).filter(Suspect.name.ilike(cand)).first()
        if hit:
            entities["suspects"].append({"id": hit[0], "name": hit[1]})

    return entities


def _officers_for_fir(db: Session, fir: FIR) -> list[dict]:
    """Officers assigned to the FIR's station (or district), as a proxy for
    case assignment (the schema assigns officers to stations/districts)."""
    q = db.query(User.name, User.rank, User.role).filter(User.status == "Approved")
    if fir.police_station_id:
        rows = q.filter(User.station_id == fir.police_station_id).limit(8).all()
        if rows:
            return [{"name": n, "rank": r, "role": role} for n, r, role in rows]
    if fir.district_id:
        rows = q.filter(User.district_id == fir.district_id).limit(8).all()
        return [{"name": n, "rank": r, "role": role} for n, r, role in rows]
    return []


def _resolve_firs(db: Session, entities: dict) -> list[FIR]:
    """Resolve detected FIR numbers / ids / suspect links to FIR rows."""
    firs: dict[int, FIR] = {}

    for num in entities["fir_numbers"]:
        fir = db.query(FIR).filter(func.upper(FIR.fir_number) == num).first()
        if fir:
            firs[fir.id] = fir

    for fid in entities["fir_ids"]:
        fir = db.query(FIR).filter(FIR.id == fid).first()
        if fir:
            firs[fir.id] = fir

    # Suspect → their FIRs (cap to avoid huge context).
    for suspect in entities["suspects"][:3]:
        from models import FIRSuspect

        links = (
            db.query(FIRSuspect.fir_id)
            .filter(FIRSuspect.suspect_id == suspect["id"])
            .limit(3)
            .all()
        )
        for (fir_id,) in links:
            if fir_id not in firs:
                fir = db.query(FIR).filter(FIR.id == fir_id).first()
                if fir:
                    firs[fir.id] = fir

    return list(firs.values())[:5]  # hard cap on FIRs per query


def retrieve(db: Session, message: str) -> RagResult:
    """Main RAG entry point: detect → query → assemble context + sources."""
    entities = detect_entities(db, message)
    firs = _resolve_firs(db, entities)

    sources: list[str] = []
    fir_references: list[dict] = []
    blocks: list[str] = []

    # 1. Per-FIR deep context (the core of investigator-grade retrieval).
    for fir in firs:
        blocks.append(f"=== FIR {fir.fir_number} ===\n" + build_fir_context(db, fir))

        refs = extract_fir_references(db, fir)
        fir_references.append(refs["firs"][0])
        sources.extend(refs["data_sources"])

        officers = _officers_for_fir(db, fir)
        if officers:
            blocks.append(
                f"## OFFICERS ASSIGNED (station/district of {fir.fir_number})\n"
                + "\n".join(f"- {o['rank'] or o['role']}: {o['name']}" for o in officers)
            )
            sources.append(f"Officer assignments ({fir.fir_number})")

        # Related cases for richer "similar cases / related suspects" answers.
        blocks.append(f"## RELATED CASES FOR {fir.fir_number}\n" + build_related_context(db, fir))
        sources.append(f"Related-case index ({fir.fir_number})")

    # 2. District/station scoped FIR lists when those entities are named.
    if entities["districts"] and not firs:
        for dname in entities["districts"][:2]:
            drow = db.query(District).filter(District.name == dname).first()
            if not drow:
                continue
            recent = (
                db.query(FIR)
                .filter(FIR.district_id == drow.id)
                .order_by(FIR.incident_date.desc())
                .limit(10)
                .all()
            )
            if recent:
                blocks.append(
                    f"## RECENT FIRs IN {dname}\n"
                    + "\n".join(
                        f"- {f.fir_number} | {f.crime_type} | {f.status} | {f.incident_date}"
                        for f in recent
                    )
                )
                sources.append(f"District FIR index ({dname})")

    grounded = bool(blocks)

    # Crime-specific investigative playbooks for the retrieved FIRs.
    crime_types = list({fir.crime_type for fir in firs})
    if crime_types:
        playbook = build_playbook_block(crime_types)
        if playbook:
            blocks.append("## CRIME-SPECIFIC INVESTIGATIVE GUIDANCE\n" + playbook)

    # 3. Fallback to analytics ONLY when nothing concrete matched.
    if not grounded:
        blocks.append("## DEPARTMENT ANALYTICS\n" + build_insights_context(db))
        sources.append("Department analytics (aggregate)")

    # De-duplicate sources, preserve order.
    seen: set[str] = set()
    unique_sources = [s for s in sources if not (s in seen or seen.add(s))]

    return RagResult(
        context="\n\n".join(blocks),
        sources=unique_sources,
        fir_references=fir_references,
        matched_entities={
            "fir_numbers": entities["fir_numbers"],
            "fir_ids": entities["fir_ids"],
            "districts": entities["districts"],
            "stations": entities["stations"],
            "suspects": [s["name"] for s in entities["suspects"]],
        },
        crime_types=crime_types,
        grounded=grounded,
    )
