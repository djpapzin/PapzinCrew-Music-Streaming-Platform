from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import os
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse


def _normalize_database_url(raw_url: str | None) -> str | None:
    """Normalize postgres URL forms and apply safe Render SSL defaulting."""
    if not raw_url:
        return raw_url

    normalized = raw_url.strip()

    # Render/Heroku sometimes provide postgres:// aliases
    if normalized.startswith("postgres://"):
        normalized = normalized.replace("postgres://", "postgresql+psycopg2://", 1)

    parsed = urlparse(normalized)
    is_postgres = parsed.scheme.startswith("postgresql")

    # On Render, force explicit sslmode=require when missing.
    # This keeps behavior unchanged elsewhere and avoids accidental overrides.
    if is_postgres and os.getenv("RENDER") and "sslmode" not in parse_qs(parsed.query):
        query = parse_qs(parsed.query)
        query["sslmode"] = [os.getenv("DB_SSLMODE", "require")]
        normalized = urlunparse(parsed._replace(query=urlencode(query, doseq=True)))

    return normalized


def _build_db_diagnostics(db_url: str, source: str) -> dict:
    parsed = urlparse(db_url)
    query = parse_qs(parsed.query)
    return {
        "source": source,
        "backend": parsed.scheme or ("sqlite" if db_url.startswith("sqlite") else "unknown"),
        "host": parsed.hostname,
        "port": parsed.port,
        "database": parsed.path.lstrip("/") if parsed.path else None,
        "sslmode": query.get("sslmode", [None])[0],
        "running_on_render": bool(os.getenv("RENDER")),
    }


# Prefer environment-provided database URL. Support common names used in hosting.
env_db_url = (
    os.getenv("SQLALCHEMY_DATABASE_URL")
    or os.getenv("DATABASE_URL")
    or os.getenv("INTERNAL_DATABASE_URL")
)

# Use an isolated in-memory SQLite database for pytest runs to ensure clean schema
RUNNING_UNDER_PYTEST = bool(os.getenv("PYTEST_CURRENT_TEST")) or ("pytest" in sys.modules)
if RUNNING_UNDER_PYTEST:
    SQLALCHEMY_DATABASE_URL = "sqlite://"
    DATABASE_URL_SOURCE = "pytest"
elif env_db_url:
    SQLALCHEMY_DATABASE_URL = _normalize_database_url(env_db_url)
    DATABASE_URL_SOURCE = "environment"
else:
    # Get the absolute path to the backend directory (ephemeral on Render)
    backend_dir = Path(__file__).parent.parent.parent
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{backend_dir}/papzin_crew.db"
    DATABASE_URL_SOURCE = "local_sqlite_fallback"

DB_DIAGNOSTICS = _build_db_diagnostics(SQLALCHEMY_DATABASE_URL, DATABASE_URL_SOURCE)

# Only pass sqlite-specific connect args for sqlite URLs
connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}

if SQLALCHEMY_DATABASE_URL == "sqlite://":
    # In-memory DB shared across threads/process via StaticPool
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        pool_pre_ping=True,
    )
else:
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args=connect_args, pool_pre_ping=True
    )

# Enable foreign key constraints for SQLite
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False, bind=engine)

Base = declarative_base()


def get_db_diagnostics() -> dict:
    return DB_DIAGNOSTICS.copy()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
