"""Similar Case Intelligence Engine.

Given a target FIR, find the most similar prior cases using a hybrid score:

  * TF-IDF cosine over the FIR description  -> modus operandi / crime pattern
  * crime-type match                        -> similar crime
  * district match                          -> similar location
  * shared suspects (fir_suspects overlap)  -> similar suspects

The components are combined into a single 0-100 similarity score. At 100k FIRs
we never vectorize the whole corpus per request: a candidate pool is pre-filtered
in SQL (same crime type or district, most recent, capped), then TF-IDF + cosine
run over just that pool. Pools and their fitted vectorizers are cached briefly.

All queries are read-only.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy import text
from sqlalchemy.orm import Session

# Component weights for the blended similarity score.
WEIGHTS = {
    "text": 0.45,      # TF-IDF modus operandi
    "crime": 0.25,     # same crime type
    "district": 0.15,  # same location
    "suspects": 0.15,  # shared suspects
}

CANDIDATE_POOL_CAP = 3000
_CACHE: dict[str, tuple[float, object]] = {}
_CACHE_TTL = 300


def _cache_get(key: str):
    entry = _CACHE.get(key)
    if entry and entry[0] > time.time():
        return entry[1]
    return None


def _cache_set(key: str, value) -> None:
    _CACHE[key] = (time.time() + _CACHE_TTL, value)


@dataclass
class SimilarCase:
    fir_id: int
    fir_number: str
    crime_type: str
    status: str
    district: str
    incident_date: str
    description: str
    similarity: float
    breakdown: dict
    shared_suspects: list[str]


@dataclass
class SimilarCasesResult:
    target: dict
    similar: list[SimilarCase]
    outcome_distribution: dict
    recommendation: str


def _get_target(db: Session, fir_id: int) -> dict | None:
    row = db.execute(
        text(
            "SELECT f.id, f.fir_number, f.crime_type, f.status, f.description, "
            "f.incident_date, f.district_id, d.name AS district "
            "FROM firs f JOIN districts d ON d.id = f.district_id WHERE f.id = :id"
        ),
        {"id": fir_id},
    ).mappings().first()
    return dict(row) if row else None


def _candidate_pool(db: Session, target: dict) -> list[dict]:
    rows = db.execute(
        text(
            "SELECT f.id, f.fir_number, f.crime_type, f.status, f.description, "
            "f.incident_date, f.district_id, d.name AS district "
            "FROM firs f JOIN districts d ON d.id = f.district_id "
            "WHERE f.id != :id AND (f.crime_type = :ct OR f.district_id = :did) "
            "ORDER BY f.incident_date DESC LIMIT :cap"
        ),
        {"id": target["id"], "ct": target["crime_type"], "did": target["district_id"], "cap": CANDIDATE_POOL_CAP},
    ).mappings().all()
    return [dict(r) for r in rows]


def _suspect_ids(db: Session, fir_id: int) -> set[int]:
    rows = db.execute(
        text("SELECT suspect_id FROM fir_suspects WHERE fir_id = :id"), {"id": fir_id}
    ).all()
    return {r[0] for r in rows}


def _suspect_names(db: Session, suspect_ids: set[int]) -> dict[int, str]:
    if not suspect_ids:
        return {}
    rows = db.execute(
        text("SELECT id, name FROM suspects WHERE id = ANY(:ids)"),
        {"ids": list(suspect_ids)},
    ).all()
    return {r[0]: r[1] for r in rows}


def find_similar(db: Session, fir_id: int, limit: int = 10) -> SimilarCasesResult | None:
    target = _get_target(db, fir_id)
    if not target:
        return None

    pool = _candidate_pool(db, target)
    if not pool:
        return SimilarCasesResult(
            target=_target_summary(target),
            similar=[],
            outcome_distribution={},
            recommendation="No comparable cases found in the same crime type or district.",
        )

    # TF-IDF over target + pool descriptions.
    docs = [target["description"] or ""] + [c["description"] or "" for c in pool]
    vectorizer = TfidfVectorizer(stop_words="english", max_features=4000, ngram_range=(1, 2))
    matrix = vectorizer.fit_transform(docs)
    text_sims = cosine_similarity(matrix[0:1], matrix[1:]).flatten()

    # Suspect overlap for the target.
    target_suspects = _suspect_ids(db, fir_id)
    pool_ids = [c["id"] for c in pool]
    pool_suspect_map = _pool_suspects(db, pool_ids)
    all_shared_ids: set[int] = set()

    scored: list[SimilarCase] = []
    for idx, cand in enumerate(pool):
        text_score = float(text_sims[idx])
        crime_score = 1.0 if cand["crime_type"] == target["crime_type"] else 0.0
        district_score = 1.0 if cand["district_id"] == target["district_id"] else 0.0
        cand_suspects = pool_suspect_map.get(cand["id"], set())
        shared = target_suspects & cand_suspects
        all_shared_ids |= shared
        suspect_score = (
            len(shared) / len(target_suspects) if target_suspects else 0.0
        )

        total = (
            WEIGHTS["text"] * text_score
            + WEIGHTS["crime"] * crime_score
            + WEIGHTS["district"] * district_score
            + WEIGHTS["suspects"] * suspect_score
        )
        scored.append(
            SimilarCase(
                fir_id=cand["id"],
                fir_number=cand["fir_number"],
                crime_type=cand["crime_type"],
                status=cand["status"],
                district=cand["district"],
                incident_date=str(cand["incident_date"]),
                description=(cand["description"] or "")[:240],
                similarity=round(total * 100, 1),
                breakdown={
                    "text": round(text_score * 100, 1),
                    "crime_type": round(crime_score * 100, 1),
                    "location": round(district_score * 100, 1),
                    "suspects": round(suspect_score * 100, 1),
                },
                shared_suspects=list(shared),  # resolved to names below
            )
        )

    scored.sort(key=lambda c: c.similarity, reverse=True)
    top = scored[:limit]

    # Resolve shared-suspect ids -> names on the top results only.
    names = _suspect_names(db, all_shared_ids)
    for case in top:
        case.shared_suspects = [names.get(sid, f"#{sid}") for sid in case.shared_suspects]

    outcomes = _outcome_distribution(top)
    recommendation = _build_recommendation(target, top, outcomes)

    return SimilarCasesResult(
        target=_target_summary(target),
        similar=top,
        outcome_distribution=outcomes,
        recommendation=recommendation,
    )


def _pool_suspects(db: Session, pool_ids: list[int]) -> dict[int, set[int]]:
    if not pool_ids:
        return {}
    rows = db.execute(
        text("SELECT fir_id, suspect_id FROM fir_suspects WHERE fir_id = ANY(:ids)"),
        {"ids": pool_ids},
    ).all()
    out: dict[int, set[int]] = {}
    for fir_id, suspect_id in rows:
        out.setdefault(fir_id, set()).add(suspect_id)
    return out


def _target_summary(target: dict) -> dict:
    return {
        "id": target["id"],
        "fir_number": target["fir_number"],
        "crime_type": target["crime_type"],
        "status": target["status"],
        "district": target["district"],
        "description": (target["description"] or "")[:300],
    }


def _outcome_distribution(cases: list[SimilarCase]) -> dict:
    dist: dict[str, int] = {}
    for case in cases:
        dist[case.status] = dist.get(case.status, 0) + 1
    return dist


def _build_recommendation(target: dict, cases: list[SimilarCase], outcomes: dict) -> str:
    if not cases:
        return "No comparable cases to learn from."
    total = sum(outcomes.values())
    closed = outcomes.get("Closed", 0) + outcomes.get("Chargesheet Filed", 0)
    resolution_rate = round(100 * closed / total) if total else 0
    top = cases[0]
    parts = [
        f"{len(cases)} comparable {target['crime_type']} cases found "
        f"(top match {top.fir_number} at {top.similarity}% similarity).",
        f"{resolution_rate}% of similar cases reached chargesheet/closure.",
    ]
    if any(c.shared_suspects for c in cases):
        parts.append("Some similar cases share suspects — review for a common offender.")
    if resolution_rate < 40:
        parts.append("Low historical resolution: prioritise evidence gathering and witness follow-up.")
    else:
        parts.append("Mirror the investigative steps from the resolved similar cases.")
    return " ".join(parts)
