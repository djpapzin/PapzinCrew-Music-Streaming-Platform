from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

import os
from pathlib import Path

# Prefer environment-provided database URL for test isolation and configurability
env_db_url = os.getenv("SQLALCHEMY_DATABASE_URL")
if env_db_url:
    SQLALCHEMY_DATABASE_URL = env_db_url
else:
    # Get the absolute path to the backend directory
    backend_dir = Path(__file__).parent.parent.parent
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{backend_dir}/papzin_crew.db"

# Only pass sqlite-specific connect args for sqlite URLs
connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()