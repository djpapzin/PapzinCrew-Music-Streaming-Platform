import importlib
import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect, text


PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def test_ensure_mix_extra_columns_adds_missing_file_hash_and_index_on_legacy_db(tmp_path, monkeypatch):
    db_path = tmp_path / "legacy.db"
    database_url = f"sqlite:///{db_path}"
    monkeypatch.setenv("SQLALCHEMY_DATABASE_URL", database_url)

    import app.db.database as db_mod
    import app.main as app_main

    importlib.reload(db_mod)
    importlib.reload(app_main)

    legacy_engine = create_engine(database_url, connect_args={"check_same_thread": False})
    with legacy_engine.begin() as conn:
        conn.execute(text("CREATE TABLE mixes (id INTEGER PRIMARY KEY, title VARCHAR NOT NULL, file_path VARCHAR NOT NULL)"))

    app_main._ensure_mix_extra_columns(legacy_engine)

    inspector = inspect(legacy_engine)
    columns = {col["name"] for col in inspector.get_columns("mixes")}
    indexes = {idx["name"] for idx in inspector.get_indexes("mixes")}

    assert "play_count" in columns
    assert "download_count" in columns
    assert "file_hash" in columns
    assert "ix_mixes_file_hash" in indexes


def test_ensure_mix_extra_columns_is_safe_when_mixes_table_is_missing(tmp_path, monkeypatch):
    db_path = tmp_path / "empty.db"
    database_url = f"sqlite:///{db_path}"
    monkeypatch.setenv("SQLALCHEMY_DATABASE_URL", database_url)

    import app.db.database as db_mod
    import app.main as app_main

    importlib.reload(db_mod)
    importlib.reload(app_main)

    empty_engine = create_engine(database_url, connect_args={"check_same_thread": False})

    app_main._ensure_mix_extra_columns(empty_engine)

    inspector = inspect(empty_engine)
    assert "mixes" not in inspector.get_table_names()
