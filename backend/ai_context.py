"""Build structured, read-only context strings for the AI assistant.

Every function here queries the database read-only and returns plain text that
is fed to the AI model. Centralizing this keeps prompts consistent and ensures the AI
only ever sees data we deliberately expose.
"""

from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from models import (
    AuditLog,
    District,
    Evidence,
    FIR,
    FIRSuspect,
    PoliceStation,
    Suspect,
    Witness,
)


def _district_name(db: Session, district_id: int | None) -> str:
    if not district_id:
        return "Unknown"
    row = db.query(District.name).filter(District.id == district_id).first()
    return row[0] if row else f"District #{district_id}"


def _station_name(db: Session, station_id: int | None) -> str:
    if not station_id:
        return "Unknown"
    row = db.query(PoliceStation.name).filter(PoliceStation.id == station_id).first()
    return row[0] if row else f"Station #{station_id}"


def build_fir_context(db: Session, fir: FIR) -> str:
    """Full single-FIR context: details, evidence, witnesses, suspects, timeline."""
    evidence = db.query(Evidence).filter(Evidence.fir_id == fir.id).all()
    witnesses = db.query(Witness).filter(Witness.fir_id == fir.id).all()
    suspect_links = db.query(FIRSuspect).filter(FIRSuspect.fir_id == fir.id).all()
    suspects = [link.suspect for link in suspect_links if link.suspect]
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.fir_id == fir.id)
        .order_by(AuditLog.created_at.asc())
        .all()
    )

    lines = [
        "## FIR DETAILS",
        f"FIR Number: {fir.fir_number}",
        f"Crime Type: {fir.crime_type}",
        f"Status: {fir.status}",
        f"District: {_district_name(db, fir.district_id)}",
        f"Police Station: {_station_name(db, fir.police_station_id)}",
        f"Incident Date: {fir.incident_date}",
        f"Description: {fir.description}",
        "",
        "## EVIDENCE",
    ]
    if evidence:
        for item in evidence:
            desc = f" — {item.description}" if item.description else ""
            lines.append(f"- [{item.media_type}] {item.file_name}{desc}")
    else:
        lines.append("- None recorded.")

    lines.append("")
    lines.append("## WITNESSES")
    if witnesses:
        for w in witnesses:
            lines.append(f"- {w.name} ({w.contact_number}): {w.statement}")
    else:
        lines.append("- None recorded.")

    lines.append("")
    lines.append("## SUSPECTS")
    if suspects:
        for s in suspects:
            alias = f" alias '{s.alias}'" if s.alias else ""
            age = f", age {s.age}" if s.age else ""
            notes = f" — {s.notes}" if s.notes else ""
            lines.append(f"- {s.name}{alias}{age}{notes}")
    else:
        lines.append("- None recorded.")

    lines.append("")
    lines.append("## ACTIVITY TIMELINE")
    if logs:
        for log in logs:
            lines.append(f"- {log.created_at:%Y-%m-%d %H:%M} — {log.action}: {log.description}")
    else:
        lines.append("- No recorded activity.")

    return "\n".join(lines)


def extract_fir_references(db: Session, fir: FIR) -> dict:
    """Return the structured records used to answer about an FIR.

    These are the *actual* rows pulled into context — the source of truth for
    the explainability panel, independent of anything the model claims. The AI
    answer is grounded in exactly this data.
    """
    evidence = db.query(Evidence).filter(Evidence.fir_id == fir.id).all()
    witnesses = db.query(Witness).filter(Witness.fir_id == fir.id).all()
    suspect_links = db.query(FIRSuspect).filter(FIRSuspect.fir_id == fir.id).all()
    suspects = [link.suspect for link in suspect_links if link.suspect]

    return {
        "firs": [
            {
                "id": fir.id,
                "fir_number": fir.fir_number,
                "crime_type": fir.crime_type,
                "status": fir.status,
                "district": _district_name(db, fir.district_id),
            }
        ],
        "evidence": [
            {"id": e.id, "file_name": e.file_name, "media_type": e.media_type}
            for e in evidence
        ],
        "suspects": [
            {"id": s.id, "name": s.name, "alias": s.alias} for s in suspects
        ],
        "witnesses": [{"id": w.id, "name": w.name} for w in witnesses],
        "data_sources": _data_sources(fir, evidence, witnesses, suspects),
    }


def _data_sources(fir, evidence, witnesses, suspects) -> list[str]:
    """Human-readable list of which datasets contributed to the answer."""
    sources = [f"FIR record ({fir.fir_number})"]
    if evidence:
        sources.append(f"Evidence table ({len(evidence)} item(s))")
    if witnesses:
        sources.append(f"Witness statements ({len(witnesses)})")
    if suspects:
        sources.append(f"Suspect records ({len(suspects)})")
    sources.append("Case activity timeline (audit log)")
    return sources


def build_related_context(db: Session, fir: FIR, limit: int = 8) -> str:
    """Context for related-case detection: same crime type / district, shared suspects."""
    similar = (
        db.query(FIR)
        .filter(
            FIR.id != fir.id,
            (FIR.crime_type == fir.crime_type) | (FIR.district_id == fir.district_id),
        )
        .order_by(FIR.incident_date.desc())
        .limit(limit)
        .all()
    )

    # Suspects on this FIR and other FIRs they appear on.
    suspect_ids = [
        link.suspect_id
        for link in db.query(FIRSuspect).filter(FIRSuspect.fir_id == fir.id).all()
    ]
    shared_rows = []
    if suspect_ids:
        shared_rows = (
            db.query(FIRSuspect.fir_id, Suspect.name)
            .join(Suspect, FIRSuspect.suspect_id == Suspect.id)
            .filter(FIRSuspect.suspect_id.in_(suspect_ids), FIRSuspect.fir_id != fir.id)
            .limit(limit)
            .all()
        )

    lines = [
        "## TARGET FIR",
        f"{fir.fir_number} | {fir.crime_type} | {_district_name(db, fir.district_id)} | {fir.status}",
        f"Description: {fir.description}",
        "",
        "## CANDIDATE SIMILAR FIRs (same crime type or district)",
    ]
    if similar:
        for s in similar:
            lines.append(
                f"- {s.fir_number} | {s.crime_type} | {_district_name(db, s.district_id)} "
                f"| {s.incident_date} | {s.status} — {s.description[:120]}"
            )
    else:
        lines.append("- None found.")

    lines.append("")
    lines.append("## SHARED-SUSPECT LINKS")
    if shared_rows:
        for other_fir_id, suspect_name in shared_rows:
            lines.append(f"- Suspect '{suspect_name}' also linked to FIR id {other_fir_id}")
    else:
        lines.append("- No shared suspects with other FIRs.")

    return "\n".join(lines)


def build_insights_context(db: Session) -> str:
    """Aggregate context for the AI insights dashboard (trends, patterns, hotspots)."""
    crime_rows = (
        db.query(FIR.crime_type, func.count(FIR.id))
        .group_by(FIR.crime_type)
        .order_by(func.count(FIR.id).desc())
        .all()
    )
    district_rows = (
        db.query(District.name, func.count(FIR.id))
        .join(FIR, FIR.district_id == District.id)
        .group_by(District.name)
        .order_by(func.count(FIR.id).desc())
        .limit(10)
        .all()
    )
    status_rows = (
        db.query(FIR.status, func.count(FIR.id)).group_by(FIR.status).all()
    )
    month = func.to_char(FIR.incident_date, "YYYY-MM")
    monthly_rows = (
        db.query(month, func.count(FIR.id)).group_by(month).order_by(month.desc()).limit(6).all()
    )
    # Repeat offenders: suspects linked to multiple FIRs.
    repeat_rows = (
        db.query(Suspect.name, func.count(FIRSuspect.fir_id))
        .join(FIRSuspect, FIRSuspect.suspect_id == Suspect.id)
        .group_by(Suspect.name)
        .having(func.count(FIRSuspect.fir_id) > 1)
        .order_by(func.count(FIRSuspect.fir_id).desc())
        .limit(10)
        .all()
    )

    lines = ["## CRIME TYPE DISTRIBUTION"]
    lines += [f"- {name}: {count}" for name, count in crime_rows]
    lines.append("")
    lines.append("## TOP DISTRICTS BY VOLUME (high-risk locations)")
    lines += [f"- {name}: {count}" for name, count in district_rows]
    lines.append("")
    lines.append("## STATUS BREAKDOWN")
    lines += [f"- {status}: {count}" for status, count in status_rows]
    lines.append("")
    lines.append("## RECENT MONTHLY VOLUME")
    lines += [f"- {m}: {count}" for m, count in monthly_rows]
    lines.append("")
    lines.append("## REPEAT OFFENDERS (suspects on multiple FIRs)")
    if repeat_rows:
        lines += [f"- {name}: linked to {count} FIRs" for name, count in repeat_rows]
    else:
        lines.append("- None detected.")

    return "\n".join(lines)


def search_firs(db: Session, filters: dict, limit: int = 25) -> list[FIR]:
    """Execute a structured filter set (from NL search) against FIRs, read-only."""
    query = db.query(FIR)
    crime_type = filters.get("crime_type")
    status = filters.get("status")
    district = filters.get("district")
    keyword = filters.get("keyword")

    if crime_type:
        query = query.filter(FIR.crime_type.ilike(f"%{crime_type}%"))
    if status:
        query = query.filter(FIR.status == status)
    if district:
        district_row = db.query(District.id).filter(District.name.ilike(f"%{district}%")).first()
        if district_row:
            query = query.filter(FIR.district_id == district_row[0])
    if keyword:
        query = query.filter(FIR.description.ilike(f"%{keyword}%"))
    if filters.get("date_from"):
        query = query.filter(FIR.incident_date >= filters["date_from"])
    if filters.get("date_to"):
        query = query.filter(FIR.incident_date <= filters["date_to"])

    return query.order_by(FIR.incident_date.desc()).limit(limit).all()
