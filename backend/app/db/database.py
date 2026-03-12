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


def _env_int(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default

    try:
        return int(raw_value)
    except ValueError:
        return default


def _postgres_connect_args() -> dict:
    return {
        "keepalives": _env_int("DB_TCP_KEEPALIVES", 1),
        "keepalives_idle": _env_int("DB_TCP_KEEPALIVES_IDLE", 30),
        "keepalives_interval": _env_int("DB_TCP_KEEPALIVES_INTERVAL", 10),
        "keepalives_count": _env_int("DB_TCP_KEEPALIVES_COUNT", 5),
    }


def _postgres_engine_kwargs() -> dict:
    return {
        "pool_pre_ping": True,
        "pool_recycle": _env_int("DB_POOL_RECYCLE", 300),
        "pool_size": _env_int("DB_POOL_SIZE", 5),
        "max_overflow": _env_int("DB_MAX_OVERFLOW", 10),
        "connect_args": _postgres_connect_args(),
    }


def _build_db_diagnostics(db_url: str, source: str) -> dict:
    parsed = urlparse(db_url)
    query = parse_qs(parsed.query)
    diagnostics = {
        "source": source,
        "backend": parsed.scheme or ("sqlite" if db_url.startswith("sqlite") else "unknown"),
        "host": parsed.hostname,
        "port": parsed.port,
        "database": parsed.path.lstrip("/") if parsed.path else None,
        "sslmode": query.get("sslmode", [None])[0],
        "running_on_render": bool(os.getenv("RENDER")),
    }

    if parsed.scheme.startswith("postgresql"):
        diagnostics["pool"] = {
            "pre_ping": True,
            "recycle_seconds": _env_int("DB_POOL_RECYCLE", 300),
            "pool_size": _env_int("DB_POOL_SIZE", 5),
            "max_overflow": _env_int("DB_MAX_OVERFLOW", 10),
            "tcp_keepalives": _postgres_connect_args(),
        }

    return diagnostics


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

if SQLALCHEMY_DATABASE_URL == "sqlite://":
    # In-memory DB shared across threads/process via StaticPool
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        pool_pre_ping=True,
    )
elif SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
    )
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL, **_postgres_engine_kwargs())

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
