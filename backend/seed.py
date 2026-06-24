"""CrimeAI data seeder / dataset generator.

Populates the PostgreSQL database with realistic Karnataka police data:

    30 districts, 500 police stations, 1,000 officers, 100,000 FIRs,
    50,000 suspects, 20,000 witnesses, 30,000 evidence records.

Usage
-----
    python seed.py            # seed everything (skips districts if already present)
    python seed.py --reset    # truncate seedable tables first, then seed
    python seed.py --scale 0.1  # seed 10% of every volume (fast smoke test)

The script reuses the application's own SQLAlchemy engine and models, so the
data it writes is consistent with what the API expects. It uses bulk inserts
and batched commits to stay fast even at 100k+ rows.
"""

from __future__ import annotations

import argparse
import random
import sys
from datetime import date, timedelta

from faker import Faker
from sqlalchemy import func, insert, select, text
from sqlalchemy.orm import Session

from auth import hash_password
from database import Base, SessionLocal, engine
from models import (
    AuditLog,
    District,
    Evidence,
    FIR,
    FIRSuspect,
    PoliceStation,
    Role,
    Suspect,
    User,
    Witness,
)

# ---------------------------------------------------------------------------
# Target volumes (multiplied by --scale)
# ---------------------------------------------------------------------------
TARGET_DISTRICTS = 30
TARGET_STATIONS = 500
TARGET_OFFICERS = 1_000
TARGET_FIRS = 100_000
TARGET_SUSPECTS = 50_000
TARGET_WITNESSES = 20_000
TARGET_EVIDENCE = 30_000

# Batch size for bulk inserts. Postgres handles large batches well; 5k keeps
# memory bounded and gives responsive progress output.
BATCH_SIZE = 5_000

# Default password shared by every seeded officer (documented for testers).
DEFAULT_OFFICER_PASSWORD = "Officer@123"

fake = Faker("en_IN")

# ---------------------------------------------------------------------------
# Reference data
# ---------------------------------------------------------------------------

# 30 real Karnataka districts.
KARNATAKA_DISTRICTS = [
    "Bengaluru Urban",
    "Bengaluru Rural",
    "Mysuru",
    "Mangaluru (Dakshina Kannada)",
    "Belagavi",
    "Kalaburagi",
    "Hubballi-Dharwad",
    "Tumakuru",
    "Shivamogga",
    "Davanagere",
    "Ballari",
    "Vijayapura",
    "Raichur",
    "Hassan",
    "Mandya",
    "Udupi",
    "Chitradurga",
    "Kolar",
    "Bagalkote",
    "Chikkamagaluru",
    "Bidar",
    "Koppal",
    "Gadag",
    "Haveri",
    "Chamarajanagara",
    "Yadgir",
    "Ramanagara",
    "Chikkaballapura",
    "Kodagu",
    "Uttara Kannada",
]

# Urban districts generate disproportionately more crime. Weight drives both
# station count and FIR volume so the distribution feels realistic.
DISTRICT_WEIGHTS = {
    "Bengaluru Urban": 30,
    "Mysuru": 9,
    "Mangaluru (Dakshina Kannada)": 7,
    "Hubballi-Dharwad": 7,
    "Belagavi": 6,
    "Kalaburagi": 5,
    "Tumakuru": 4,
    "Davanagere": 4,
    "Ballari": 4,
    "Shivamogga": 4,
    "Bengaluru Rural": 4,
}
DEFAULT_DISTRICT_WEIGHT = 2  # every other district

# Weighted crime distribution: common property crime dominates, murder is rare.
CRIME_DISTRIBUTION = {
    "Theft": 26,
    "Vehicle Theft": 16,
    "Cybercrime": 14,
    "Fraud": 12,
    "Assault": 11,
    "Robbery": 8,
    "Drug Offences": 9,
    "Murder": 4,
}

# Status distribution skews toward open/active cases.
STATUS_DISTRIBUTION = {
    "Open": 30,
    "Under Investigation": 40,
    "Chargesheet Filed": 18,
    "Closed": 12,
}

CRIME_DESCRIPTIONS = {
    "Theft": [
        "Mobile phone snatched near the bus stand.",
        "Household valuables stolen during the day while the family was away.",
        "Gold ornaments reported missing from a locked residence.",
    ],
    "Vehicle Theft": [
        "Two-wheeler stolen from outside a commercial complex.",
        "Car reported missing from an apartment parking lot.",
    ],
    "Cybercrime": [
        "Victim defrauded via a fake online investment scheme.",
        "Unauthorised UPI transactions reported on the complainant's account.",
        "Phishing call led to OTP disclosure and account drain.",
    ],
    "Fraud": [
        "Land sale fraud using forged documents.",
        "Cheating in a job-placement racket against multiple victims.",
    ],
    "Assault": [
        "Physical assault following a roadside altercation.",
        "Group attack reported after a property dispute.",
    ],
    "Robbery": [
        "Armed robbery at a jewellery shop.",
        "Highway robbery targeting a transport vehicle.",
    ],
    "Drug Offences": [
        "Seizure of contraband substances during a routine check.",
        "Peddling network busted near an educational institution.",
    ],
    "Murder": [
        "Homicide reported under suspicious circumstances.",
        "Body recovered; investigation under way to identify the accused.",
    ],
}

RANKS = [
    "Constable",
    "Head Constable",
    "Assistant Sub-Inspector",
    "Sub-Inspector",
    "Inspector",
    "Deputy Superintendent of Police",
]

# Seeded officers are spread across operational roles.
OFFICER_ROLE_WEIGHTS = {
    "StationOfficer": 50,
    "Investigator": 30,
    "Analyst": 10,
    "DistrictAdmin": 8,
    "StateAdmin": 2,
}

STATION_SUFFIXES = ["Town", "City", "Rural", "East", "West", "North", "South", "Market", "Extension"]

EVIDENCE_TYPES = [
    ("image", "image/jpeg", "jpg"),
    ("image", "image/png", "png"),
    ("document", "application/pdf", "pdf"),
    ("document", "application/msword", "doc"),
    ("video", "video/mp4", "mp4"),
]


def weighted_choices(distribution: dict[str, int], count: int) -> list[str]:
    """Return `count` keys sampled with the given integer weights."""
    keys = list(distribution.keys())
    weights = list(distribution.values())
    return random.choices(keys, weights=weights, k=count)


def chunked(iterable: list, size: int):
    for start in range(0, len(iterable), size):
        yield iterable[start : start + size]


def bulk_insert(session: Session, model, rows: list[dict], label: str) -> None:
    """Insert rows in batches with progress output."""
    total = len(rows)
    done = 0
    for batch in chunked(rows, BATCH_SIZE):
        session.execute(insert(model), batch)
        session.commit()
        done += len(batch)
        print(f"  {label}: {done:,}/{total:,}", end="\r", flush=True)
    print(f"  {label}: {total:,}/{total:,}   ")


def scaled(value: int, scale: float) -> int:
    return max(1, int(round(value * scale)))


# ---------------------------------------------------------------------------
# Seed steps
# ---------------------------------------------------------------------------

def ensure_schema(session: Session) -> None:
    """Reconcile legacy table drift so the seeder matches models.py.

    The live `suspects` table predates the current model and is missing the
    `alias`, `notes`, and `created_at` columns the app now queries. Add them
    if absent, and relax legacy NOT NULL constraints (fir_id/phone/address)
    so model-shaped inserts succeed without touching old data.
    """
    print("Reconciling schema (suspects table)...")
    statements = [
        "ALTER TABLE suspects ADD COLUMN IF NOT EXISTS alias VARCHAR",
        "ALTER TABLE suspects ADD COLUMN IF NOT EXISTS notes TEXT",
        "ALTER TABLE suspects ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT now()",
        "ALTER TABLE suspects ALTER COLUMN fir_id DROP NOT NULL",
        "ALTER TABLE suspects ALTER COLUMN phone DROP NOT NULL",
        "ALTER TABLE suspects ALTER COLUMN address DROP NOT NULL",
    ]
    for statement in statements:
        try:
            session.execute(text(statement))
            session.commit()
        except Exception:
            # Column/table may already be in the desired state on a fresh DB.
            session.rollback()


def reset_tables(session: Session) -> None:
    """Truncate every seedable table and restart identity sequences."""
    print("Resetting seedable tables...")
    session.execute(
        text(
            "TRUNCATE TABLE "
            "audit_logs, evidence, witnesses, fir_suspects, suspects, firs, "
            "approval_requests, sessions, users, police_stations, districts "
            "RESTART IDENTITY CASCADE"
        )
    )
    session.commit()


def seed_roles(session: Session) -> dict[str, int]:
    role_names = ["SuperAdmin", "StateAdmin", "DistrictAdmin", "StationOfficer", "Investigator", "Analyst"]
    existing = {name for (name,) in session.execute(select(Role.name)).all()}
    new_roles = [{"name": name} for name in role_names if name not in existing]
    if new_roles:
        session.execute(insert(Role), new_roles)
        session.commit()
    return {name: rid for rid, name in session.execute(select(Role.id, Role.name)).all()}


def seed_districts(session: Session, count: int) -> list[int]:
    existing = session.execute(select(District.id, District.name)).all()
    if existing:
        print(f"Districts already present ({len(existing)}); skipping.")
        return [rid for rid, _ in existing]

    names = KARNATAKA_DISTRICTS[:count]
    print(f"Seeding {len(names)} districts...")
    session.execute(insert(District), [{"name": name} for name in names])
    session.commit()
    return [rid for (rid,) in session.execute(select(District.id)).all()]


def district_weight(name: str) -> int:
    return DISTRICT_WEIGHTS.get(name, DEFAULT_DISTRICT_WEIGHT)


def seed_stations(session: Session, count: int, districts: list[tuple[int, str]]) -> list[tuple[int, int]]:
    """Create stations, distributing them across districts by weight.

    Returns a list of (station_id, district_id) pairs.
    """
    print(f"Seeding {count:,} police stations...")
    weights = [district_weight(name) for _, name in districts]
    rows: list[dict] = []
    per_district_index: dict[int, int] = {}
    for _ in range(count):
        district_id, district_name = random.choices(districts, weights=weights, k=1)[0]
        idx = per_district_index.get(district_id, 0) + 1
        per_district_index[district_id] = idx
        suffix = random.choice(STATION_SUFFIXES)
        rows.append(
            {
                "district_id": district_id,
                "name": f"{district_name.split(' (')[0]} {suffix} PS #{idx}",
            }
        )
    bulk_insert(session, PoliceStation, rows, "stations")
    return [
        (sid, did)
        for sid, did in session.execute(select(PoliceStation.id, PoliceStation.district_id)).all()
    ]


def seed_officers(
    session: Session,
    count: int,
    roles: dict[str, int],
    stations: list[tuple[int, int]],
) -> None:
    print(f"Seeding {count:,} officers (hashing password once)...")
    password_hash = hash_password(DEFAULT_OFFICER_PASSWORD)
    role_names = weighted_choices(OFFICER_ROLE_WEIGHTS, count)

    rows: list[dict] = []
    used_emails: set[str] = set()
    used_employee_ids: set[str] = set()
    for i in range(count):
        station_id, district_id = random.choice(stations)
        role_name = role_names[i]

        # Guarantee unique email / employee id.
        employee_id = f"KA{random.randint(10, 99)}{i:06d}"
        while employee_id in used_employee_ids:
            employee_id = f"KA{random.randint(10, 99)}{random.randint(0, 999999):06d}"
        used_employee_ids.add(employee_id)

        email = f"officer{i:06d}@kspolice.gov.in"
        used_emails.add(email)

        rows.append(
            {
                "name": fake.name(),
                "email": email,
                "employee_id": employee_id,
                "mobile_number": f"9{random.randint(100000000, 999999999)}",
                "rank": random.choice(RANKS),
                "password_hash": password_hash,
                "role": role_name,
                "role_id": roles[role_name],
                "district_id": district_id,
                "station_id": station_id,
                "status": "Approved",
                "failed_login_attempts": 0,
            }
        )
    bulk_insert(session, User, rows, "officers")


def random_incident_date() -> date:
    """A date within the last ~3 years, biased toward recent months."""
    days_ago = int(random.triangular(0, 1095, 120))
    return date.today() - timedelta(days=days_ago)


def seed_firs(
    session: Session,
    count: int,
    stations: list[tuple[int, int]],
    officer_ids: list[int],
) -> list[int]:
    print(f"Seeding {count:,} FIRs...")
    crime_types = weighted_choices(CRIME_DISTRIBUTION, count)
    statuses = weighted_choices(STATUS_DISTRIBUTION, count)
    year = date.today().year

    rows: list[dict] = []
    for i in range(count):
        crime_type = crime_types[i]
        station_id, district_id = random.choice(stations)
        rows.append(
            {
                "fir_number": f"FIR/{year}/{district_id:02d}/{i + 1:07d}",
                "crime_type": crime_type,
                "description": random.choice(CRIME_DESCRIPTIONS[crime_type]),
                "district_id": district_id,
                "police_station_id": station_id,
                "incident_date": random_incident_date(),
                "status": statuses[i],
            }
        )
    bulk_insert(session, FIR, rows, "firs")
    return [fid for (fid,) in session.execute(select(FIR.id)).all()]


def seed_suspects_and_links(
    session: Session, count: int, fir_ids: list[int]
) -> None:
    print(f"Seeding {count:,} suspects + FIR links...")
    rows: list[dict] = []
    for _ in range(count):
        has_alias = random.random() < 0.4
        rows.append(
            {
                "name": fake.name(),
                "alias": fake.first_name() if has_alias else None,
                "age": random.randint(18, 65),
                "notes": fake.sentence(nb_words=8) if random.random() < 0.5 else None,
            }
        )
    bulk_insert(session, Suspect, rows, "suspects")

    suspect_ids = [sid for (sid,) in session.execute(select(Suspect.id)).all()]
    print(f"  linking {len(suspect_ids):,} suspects to FIRs...")
    link_rows = [
        {"fir_id": random.choice(fir_ids), "suspect_id": suspect_id}
        for suspect_id in suspect_ids
    ]
    bulk_insert(session, FIRSuspect, link_rows, "fir_suspects")


def seed_witnesses(session: Session, count: int, fir_ids: list[int]) -> None:
    print(f"Seeding {count:,} witnesses...")
    rows = [
        {
            "fir_id": random.choice(fir_ids),
            "name": fake.name(),
            "contact_number": f"9{random.randint(100000000, 999999999)}",
            "statement": fake.paragraph(nb_sentences=3),
            "address": fake.address().replace("\n", ", "),
        }
        for _ in range(count)
    ]
    bulk_insert(session, Witness, rows, "witnesses")


def seed_evidence(
    session: Session, count: int, fir_ids: list[int], officer_ids: list[int]
) -> None:
    print(f"Seeding {count:,} evidence records...")
    rows: list[dict] = []
    for i in range(count):
        media_type, content_type, ext = random.choice(EVIDENCE_TYPES)
        fir_id = random.choice(fir_ids)
        folder = {"image": "images", "document": "documents", "video": "videos"}[media_type]
        file_name = f"evidence_{i + 1}.{ext}"
        rows.append(
            {
                "fir_id": fir_id,
                "file_name": file_name,
                "file_type": content_type,
                "media_type": media_type,
                "file_path": f"/uploads/{folder}/fir_{fir_id}_{file_name}",
                "uploaded_by": random.choice(officer_ids),
            }
        )
    bulk_insert(session, Evidence, rows, "evidence")


def print_summary(session: Session) -> None:
    print("\n" + "=" * 50)
    print("Seed complete. Row counts:")
    for label, model in [
        ("Districts", District),
        ("Police stations", PoliceStation),
        ("Officers", User),
        ("FIRs", FIR),
        ("Suspects", Suspect),
        ("FIR-Suspect links", FIRSuspect),
        ("Witnesses", Witness),
        ("Evidence", Evidence),
    ]:
        count = session.execute(select(func.count(model.id))).scalar()
        print(f"  {label:<20} {count:>10,}")
    print("=" * 50)
    print(f"Officer login password: {DEFAULT_OFFICER_PASSWORD}")
    print("Example officer email:  officer000000@kspolice.gov.in")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the CrimeAI database with realistic Karnataka data.")
    parser.add_argument("--reset", action="store_true", help="Truncate seedable tables before seeding.")
    parser.add_argument(
        "--scale",
        type=float,
        default=1.0,
        help="Scale factor for all volumes (e.g. 0.1 seeds 10%% for a quick test).",
    )
    args = parser.parse_args()

    random.seed(42)
    Faker.seed(42)

    # Make sure the schema exists (no-op if the app already created it).
    Base.metadata.create_all(bind=engine)

    session = SessionLocal()
    try:
        ensure_schema(session)

        if args.reset:
            reset_tables(session)

        roles = seed_roles(session)
        district_ids = seed_districts(session, scaled(TARGET_DISTRICTS, args.scale))
        districts = session.execute(select(District.id, District.name)).all()
        districts = [(did, name) for did, name in districts]

        stations = seed_stations(session, scaled(TARGET_STATIONS, args.scale), districts)

        seed_officers(session, scaled(TARGET_OFFICERS, args.scale), roles, stations)
        officer_ids = [oid for (oid,) in session.execute(select(User.id)).all()]

        fir_ids = seed_firs(session, scaled(TARGET_FIRS, args.scale), stations, officer_ids)

        seed_suspects_and_links(session, scaled(TARGET_SUSPECTS, args.scale), fir_ids)
        seed_witnesses(session, scaled(TARGET_WITNESSES, args.scale), fir_ids)
        seed_evidence(session, scaled(TARGET_EVIDENCE, args.scale), fir_ids, officer_ids)

        print_summary(session)
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    sys.exit(main())
