import os
import sys
import io
import importlib
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

# Ensure backend/ import path
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


@pytest.fixture()
def test_app(tmp_path, monkeypatch):
    # Isolate uploads into a temp directory
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))
    # Keep AI cover generation from making network calls
    monkeypatch.setenv("AI_COVER_TIMEOUT_SECONDS", "0.1")
    # Use a temp sqlite DB file per test to avoid UNIQUE collisions between tests
    db_path = tmp_path / "test.db"
    monkeypatch.setenv("SQLALCHEMY_DATABASE_URL", f"sqlite:///{db_path}")

    # Reload modules so UPLOAD_DIR is read at import time
    import app.db.database as db_mod
    import app.routers.uploads as uploads_mod
    import app.main as app_main
    importlib.reload(db_mod)
    importlib.reload(uploads_mod)
    importlib.reload(app_main)

    # Return FastAPI app
    return app_main.app


def _form_data(file_name: str = "test.mp3", content: bytes = b"dummy-audio"):
    # Build multipart form
    data = {
        "title": "UnitTest Title",
        "artist_name": "UnitTest Artist",
        "skip_duplicate_check": "true",
    }
    files = {
        "file": (file_name, io.BytesIO(content), "audio/mpeg"),
    }
    return data, files


def test_upload_b2_success(test_app, tmp_path):
    client = TestClient(test_app)

    data, files = _form_data()

    # Patch validate to skip real parsing; patch B2 to succeed; block AI cover generation
    with patch("app.routers.uploads.validate_audio_file", return_value=(True, {
        "valid": True,
        "mime_type": "audio/mpeg",
        "file_extension": ".mp3",
        "file_size_bytes": len(files["file"][1].getvalue()),
    })):
        with patch("app.routers.uploads.AIArtGenerator.generate_cover_art_from_metadata", return_value=None):
            with patch("app.routers.uploads.B2Storage.is_configured", return_value=True):
                with patch("app.routers.uploads.B2Storage.put_bytes_safe", return_value={
                    "ok": True,
                    "key": "audio/UnitTest Artist - UnitTest Title.mp3",
                    "url": "https://b2.example/audio/UnitTest%20Artist%20-%20UnitTest%20Title.mp3",
                }):
                    resp = client.post("/upload", data=data, files=files)

    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body.get("storage") == "b2"
    # Location should prefer key when present
    assert body.get("location") == "audio/UnitTest Artist - UnitTest Title.mp3"
    assert "fallback_from_b2" not in body


def test_upload_b2_failure_fallback_local(test_app, tmp_path):
    client = TestClient(test_app)

    data, files = _form_data(file_name="fallback.mp3")

    with patch("app.routers.uploads.validate_audio_file", return_value=(True, {
        "valid": True,
        "mime_type": "audio/mpeg",
        "file_extension": ".mp3",
        "file_size_bytes": len(files["file"][1].getvalue()),
    })):
        with patch("app.routers.uploads.AIArtGenerator.generate_cover_art_from_metadata", return_value=None):
            with patch("app.routers.uploads.B2Storage.is_configured", return_value=True):
                with patch("app.routers.uploads.B2Storage.put_bytes_safe", return_value={
                    "ok": False,
                    "error_code": "auth_error",
                    "detail": "bad creds",
                }):
                    resp = client.post("/upload", data=data, files=files)

    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body.get("storage") == "local_filesystem"
    assert body.get("fallback_from_b2") is True
    # Ensure the local file exists
    loc = body.get("location")
    assert loc and os.path.exists(loc)


def test_upload_without_b2_uses_local_no_fallback_flag(test_app, tmp_path):
    client = TestClient(test_app)

    data, files = _form_data(file_name="nob2.mp3")

    with patch("app.routers.uploads.validate_audio_file", return_value=(True, {
        "valid": True,
        "mime_type": "audio/mpeg",
        "file_extension": ".mp3",
        "file_size_bytes": len(files["file"][1].getvalue()),
    })):
        with patch("app.routers.uploads.AIArtGenerator.generate_cover_art_from_metadata", return_value=None):
            with patch("app.routers.uploads.B2Storage.is_configured", return_value=False):
                resp = client.post("/upload", data=data, files=files)

    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body.get("storage") == "local_filesystem"
    # Not a fallback due to B2 error; B2 wasn't configured
    assert "fallback_from_b2" not in body
    loc = body.get("location")
    assert loc and os.path.exists(loc)
