"""Backfill synthetic-but-realistic sociological attributes onto suspects.

The base data only had `age`. This populates gender, occupation, education,
income band, employment status, and migrant flag with distributions that are
deliberately *correlated* (with age and the crime type of the suspect's FIR) so
the sociology analytics surface meaningful patterns rather than uniform noise.

Run once:  python backfill_demographics.py
Idempotent: only fills rows where gender IS NULL (re-run safe). Use --force to
overwrite all rows.
"""

from __future__ import annotations

import argparse
import random

from sqlalchemy import text

from database import SessionLocal

random.seed(7)

GENDERS = ["Male", "Female", "Other"]
GENDER_WEIGHTS = [82, 17, 1]  # crime suspect populations skew heavily male

EDUCATION = ["None", "Primary", "Secondary", "Graduate", "Postgraduate"]
OCCUPATIONS = [
    "Labourer", "Driver", "Shopkeeper", "Farmer", "Student", "Unemployed",
    "IT Professional", "Daily Wage Worker", "Mechanic", "Vendor", "Clerk", "Other",
]
INCOME_BANDS = ["Low", "Lower-Middle", "Middle", "Upper-Middle", "High"]
EMPLOYMENT = ["Employed", "Unemployed", "Self-employed", "Student"]

# Crime types whose offenders skew lower-income / higher economic stress.
PROPERTY_CRIMES = {"Theft", "Vehicle Theft", "Robbery", "Drug Offences"}
WHITE_COLLAR = {"Cybercrime", "Fraud"}


def pick(options, weights):
    return random.choices(options, weights=weights, k=1)[0]


def demographics_for(age: int, crime_type: str | None) -> dict:
    crime_type = crime_type or ""

    # Education skews higher for white-collar crime, lower otherwise.
    if crime_type in WHITE_COLLAR:
        education = pick(EDUCATION, [2, 5, 25, 50, 18])
        income = pick(INCOME_BANDS, [5, 15, 35, 30, 15])
        occupation = pick(
            ["IT Professional", "Clerk", "Shopkeeper", "Other", "Student"],
            [40, 20, 15, 15, 10],
        )
    elif crime_type in PROPERTY_CRIMES:
        education = pick(EDUCATION, [20, 35, 30, 13, 2])
        income = pick(INCOME_BANDS, [45, 30, 18, 5, 2])
        occupation = pick(
            ["Labourer", "Daily Wage Worker", "Unemployed", "Driver", "Vendor", "Mechanic", "Other"],
            [25, 22, 20, 12, 9, 7, 5],
        )
    else:
        education = pick(EDUCATION, [12, 28, 38, 18, 4])
        income = pick(INCOME_BANDS, [25, 32, 28, 12, 3])
        occupation = pick(OCCUPATIONS, [16, 12, 10, 10, 8, 14, 4, 12, 6, 6, 4, 8])

    # Younger suspects: more students / unemployed.
    if age < 25:
        employment = pick(EMPLOYMENT, [30, 30, 15, 25])
    elif age < 40:
        employment = pick(EMPLOYMENT, [50, 22, 23, 5])
    else:
        employment = pick(EMPLOYMENT, [55, 25, 20, 0])
    if occupation == "Student":
        employment = "Student"
    if occupation == "Unemployed":
        employment = "Unemployed"

    # Migration: higher among low-income, working-age, urban-crime offenders.
    migrant_prob = 0.18
    if income in ("Low", "Lower-Middle"):
        migrant_prob += 0.12
    if 20 <= age <= 40:
        migrant_prob += 0.06
    is_migrant = random.random() < migrant_prob

    return {
        "gender": pick(GENDERS, GENDER_WEIGHTS),
        "occupation": occupation,
        "education": education,
        "income_band": income,
        "employment_status": employment,
        "is_migrant": is_migrant,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Overwrite all rows, not just NULLs.")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        where = "" if args.force else "WHERE s.gender IS NULL"
        rows = db.execute(
            text(
                "SELECT s.id, s.age, f.crime_type "
                "FROM suspects s "
                "LEFT JOIN fir_suspects fs ON fs.suspect_id = s.id "
                "LEFT JOIN firs f ON f.id = fs.fir_id "
                f"{where}"
            )
        ).all()

        print(f"Backfilling {len(rows):,} suspects…")
        batch = []
        for sid, age, crime_type in rows:
            demo = demographics_for(age or 30, crime_type)
            demo["id"] = sid
            batch.append(demo)

        # Bulk update in chunks.
        updated = 0
        for start in range(0, len(batch), 5000):
            chunk = batch[start : start + 5000]
            db.execute(
                text(
                    "UPDATE suspects SET gender=:gender, occupation=:occupation, "
                    "education=:education, income_band=:income_band, "
                    "employment_status=:employment_status, is_migrant=:is_migrant "
                    "WHERE id=:id"
                ),
                chunk,
            )
            db.commit()
            updated += len(chunk)
            print(f"  {updated:,}/{len(batch):,}", end="\r", flush=True)
        print(f"\nDone. Updated {updated:,} suspects.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
