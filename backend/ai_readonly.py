"""Read-only database access for the AI assistant.

The AI layer must never modify data. We enforce this at the *database* level by
opening sessions on connections where PostgreSQL's
``default_transaction_read_only`` is ON — any INSERT/UPDATE/DELETE then fails
with ``cannot execute ... in a read-only transaction``, regardless of what the
application code attempts. This is a hard guarantee, not a convention.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# A dedicated engine so the read-only setting never leaks into the app's
# read/write sessions.
readonly_engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"options": "-c default_transaction_read_only=on"},
)


@event.listens_for(readonly_engine, "begin")
def _enforce_readonly(connection) -> None:
    # Belt-and-suspenders: also assert read-only at the start of every
    # transaction in case connection args are ignored by a pooler.
    connection.exec_driver_sql("SET TRANSACTION READ ONLY")


ReadOnlySessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=readonly_engine,
)


def get_readonly_db():
    """FastAPI dependency yielding a read-only DB session."""
    db = ReadOnlySessionLocal()
    try:
        yield db
    finally:
        db.close()
