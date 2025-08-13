from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker

import os
from pathlib import Path
import logging

# Prefer environment-provided database URL. Support common names used in hosting.
env_db_url = (
    os.getenv("SQLALCHEMY_DATABASE_URL")
    or os.getenv("DATABASE_URL")
    or os.getenv("INTERNAL_DATABASE_URL")
    or os.getenv("DATABASE_URL")
)

# Render/Heroku often provide 'postgres://' which SQLAlchemy expects as 'postgresql+psycopg2://'
if env_db_url and env_db_url.startswith("postgres://"):
    env_db_url = env_db_url.replace("postgres://", "postgresql+psycopg2://", 1)

if env_db_url:
    SQLALCHEMY_DATABASE_URL = env_db_url
else:
    # Get the absolute path to the backend directory (ephemeral on Render)
    backend_dir = Path(__file__).parent.parent.parent
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{backend_dir}/papzin_crew.db"

# Only pass sqlite-specific connect args for sqlite URLs
connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}

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

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()