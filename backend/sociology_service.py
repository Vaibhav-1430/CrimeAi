"""Sociological Crime Intelligence.

Aggregates suspect demographics (joined to their FIR crime types) into
sociological views: age groups, gender, occupation, education, income, youth-
and gender-based crime trends, social risk factors, migration impact, and
economic-stress indicators, plus an age x crime-type correlation matrix.

All queries are read-only and computed in SQL where possible.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.orm import Session

_CACHE: dict[str, tuple[float, object]] = {}
_CACHE_TTL = 300

AGE_BUCKETS = [
    ("18-24", 18, 24),
    ("25-34", 25, 34),
    ("35-44", 35, 44),
    ("45-54", 45, 54),
    ("55-65", 55, 65),
]

PROPERTY_CRIMES = ("Theft", "Vehicle Theft", "Robbery", "Drug Offences")


def _cache_get(key: str):
    e = _CACHE.get(key)
    return e[1] if e and e[0] > time.time() else None


def _cache_set(key: str, value) -> None:
    _CACHE[key] = (time.time() + _CACHE_TTL, value)


def _named_counts(db: Session, column: str) -> list[dict]:
    rows = db.execute(
        text(f"SELECT {column} AS k, count(*) c FROM suspects WHERE {column} IS NOT NULL GROUP BY {column} ORDER BY c DESC")
    ).all()
    return [{"name": r[0], "count": r[1]} for r in rows]


def _age_distribution(db: Session) -> list[dict]:
    out = []
    for label, lo, hi in AGE_BUCKETS:
        c = db.execute(
            text("SELECT count(*) FROM suspects WHERE age BETWEEN :lo AND :hi"),
            {"lo": lo, "hi": hi},
        ).scalar()
        out.append({"name": label, "count": int(c or 0)})
    return out


@dataclass
class SociologyOverview:
    kpis: dict
    age_distribution: list[dict]
    gender: list[dict]
    education: list[dict]
    occupation: list[dict]
    income_band: list[dict]
    employment: list[dict]


def overview(db: Session) -> SociologyOverview:
    cached = _cache_get("overview")
    if cached:
        return cached

    total = db.execute(text("SELECT count(*) FROM suspects")).scalar() or 0
    youth = db.execute(text("SELECT count(*) FROM suspects WHERE age < 25")).scalar() or 0
    migrants = db.execute(text("SELECT count(*) FROM suspects WHERE is_migrant IS TRUE")).scalar() or 0
    unemployed = (
        db.execute(text("SELECT count(*) FROM suspects WHERE employment_status='Unemployed'")).scalar() or 0
    )
    low_income = (
        db.execute(text("SELECT count(*) FROM suspects WHERE income_band IN ('Low','Lower-Middle')")).scalar()
        or 0
    )

    kpis = {
        "total_suspects": int(total),
        "youth_share_pct": round(100 * youth / total, 1) if total else 0,
        "migrant_share_pct": round(100 * migrants / total, 1) if total else 0,
        "unemployed_share_pct": round(100 * unemployed / total, 1) if total else 0,
        "low_income_share_pct": round(100 * low_income / total, 1) if total else 0,
    }

    result = SociologyOverview(
        kpis=kpis,
        age_distribution=_age_distribution(db),
        gender=_named_counts(db, "gender"),
        education=_named_counts(db, "education"),
        occupation=_named_counts(db, "occupation"),
        income_band=_named_counts(db, "income_band"),
        employment=_named_counts(db, "employment_status"),
    )
    _cache_set("overview", result)
    return result


def youth_crime_trends(db: Session) -> dict:
    """Crime-type mix for youth (<25) vs the rest, and youth share by crime type."""
    rows = db.execute(
        text(
            """
            SELECT f.crime_type,
                   sum(CASE WHEN s.age < 25 THEN 1 ELSE 0 END) AS youth,
                   count(*) AS total
            FROM suspects s
            JOIN fir_suspects fs ON fs.suspect_id = s.id
            JOIN firs f ON f.id = fs.fir_id
            GROUP BY f.crime_type
            ORDER BY total DESC
            """
        )
    ).all()
    by_crime = [
        {
            "crime_type": r[0],
            "youth": int(r[1]),
            "total": int(r[2]),
            "youth_pct": round(100 * r[1] / r[2], 1) if r[2] else 0,
        }
        for r in rows
    ]
    return {"by_crime": by_crime}


def gender_crime_trends(db: Session) -> dict:
    """Crime-type distribution by gender."""
    rows = db.execute(
        text(
            """
            SELECT f.crime_type, s.gender, count(*) c
            FROM suspects s
            JOIN fir_suspects fs ON fs.suspect_id = s.id
            JOIN firs f ON f.id = fs.fir_id
            WHERE s.gender IS NOT NULL
            GROUP BY f.crime_type, s.gender
            """
        )
    ).all()
    matrix: dict[str, dict[str, int]] = {}
    for crime, gender, c in rows:
        matrix.setdefault(crime, {})[gender] = int(c)
    data = [
        {"crime_type": crime, "Male": g.get("Male", 0), "Female": g.get("Female", 0), "Other": g.get("Other", 0)}
        for crime, g in sorted(matrix.items(), key=lambda kv: -sum(kv[1].values()))
    ]
    return {"by_crime": data}


def social_risk_factors(db: Session) -> dict:
    """Compare key risk-factor prevalence among suspects vs a neutral baseline.

    Each factor reports the share of suspects exhibiting it; property-crime
    offenders are highlighted to show concentration of stress indicators.
    """
    total = db.execute(text("SELECT count(*) FROM suspects")).scalar() or 1
    factors = []
    definitions = [
        ("Unemployment", "employment_status = 'Unemployed'"),
        ("Low income", "income_band IN ('Low','Lower-Middle')"),
        ("No/Primary education", "education IN ('None','Primary')"),
        ("Migrant", "is_migrant IS TRUE"),
        ("Youth (<25)", "age < 25"),
    ]
    for label, cond in definitions:
        overall = db.execute(text(f"SELECT count(*) FROM suspects WHERE {cond}")).scalar() or 0
        prop = (
            db.execute(
                text(
                    f"""
                    SELECT count(*) FROM suspects s
                    JOIN fir_suspects fs ON fs.suspect_id = s.id
                    JOIN firs f ON f.id = fs.fir_id
                    WHERE ({cond}) AND f.crime_type IN :props
                    """
                ).bindparams(props=PROPERTY_CRIMES)
            ).scalar()
            or 0
        )
        prop_total = (
            db.execute(
                text(
                    """
                    SELECT count(*) FROM suspects s
                    JOIN fir_suspects fs ON fs.suspect_id = s.id
                    JOIN firs f ON f.id = fs.fir_id
                    WHERE f.crime_type IN :props
                    """
                ).bindparams(props=PROPERTY_CRIMES)
            ).scalar()
            or 1
        )
        factors.append(
            {
                "factor": label,
                "overall_pct": round(100 * overall / total, 1),
                "property_crime_pct": round(100 * prop / prop_total, 1),
            }
        )
    return {"factors": factors}


def migration_impact(db: Session) -> dict:
    rows = db.execute(
        text(
            """
            SELECT f.crime_type,
                   sum(CASE WHEN s.is_migrant THEN 1 ELSE 0 END) migrant,
                   count(*) total
            FROM suspects s
            JOIN fir_suspects fs ON fs.suspect_id = s.id
            JOIN firs f ON f.id = fs.fir_id
            GROUP BY f.crime_type ORDER BY total DESC
            """
        )
    ).all()
    return {
        "by_crime": [
            {
                "crime_type": r[0],
                "migrant": int(r[1]),
                "total": int(r[2]),
                "migrant_pct": round(100 * r[1] / r[2], 1) if r[2] else 0,
            }
            for r in rows
        ]
    }


def economic_stress(db: Session) -> dict:
    """Economic-stress index per district: share of low-income + unemployed suspects."""
    rows = db.execute(
        text(
            """
            SELECT d.name,
                   count(*) total,
                   sum(CASE WHEN s.income_band IN ('Low','Lower-Middle') THEN 1 ELSE 0 END) low_income,
                   sum(CASE WHEN s.employment_status='Unemployed' THEN 1 ELSE 0 END) unemployed
            FROM suspects s
            JOIN fir_suspects fs ON fs.suspect_id = s.id
            JOIN firs f ON f.id = fs.fir_id
            JOIN districts d ON d.id = f.district_id
            GROUP BY d.name
            HAVING count(*) >= 20
            """
        )
    ).all()
    out = []
    for name, total, low, unemp in rows:
        stress = round(100 * (low + unemp) / (2 * total), 1) if total else 0
        out.append({"district": name, "suspects": int(total), "stress_index": stress})
    out.sort(key=lambda r: r["stress_index"], reverse=True)
    return {"districts": out[:15]}


def age_crime_correlation(db: Session) -> dict:
    """Age-bucket x crime-type matrix (counts) for the correlation heatmap."""
    crime_types = [
        r[0] for r in db.execute(text("SELECT DISTINCT crime_type FROM firs ORDER BY crime_type")).all()
    ]
    matrix = []
    for label, lo, hi in AGE_BUCKETS:
        row = {"age_group": label}
        for ct in crime_types:
            c = db.execute(
                text(
                    """
                    SELECT count(*) FROM suspects s
                    JOIN fir_suspects fs ON fs.suspect_id = s.id
                    JOIN firs f ON f.id = fs.fir_id
                    WHERE s.age BETWEEN :lo AND :hi AND f.crime_type = :ct
                    """
                ),
                {"lo": lo, "hi": hi, "ct": ct},
            ).scalar()
            row[ct] = int(c or 0)
        matrix.append(row)
    return {"crime_types": crime_types, "matrix": matrix}
