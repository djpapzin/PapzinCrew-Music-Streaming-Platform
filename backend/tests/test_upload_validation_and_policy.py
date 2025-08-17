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
        # IMPORTANT: for validation tests we may set this to true to bypass duplicate check
        # For duplicate test, we will not set it to true.
    }
    files = {
        "file": (file_name, io.BytesIO(content), "audio/mpeg"),
    }
    return data, files


def test_upload_file_too_large_returns_400(test_app, tmp_path):
    client = TestClient(test_app)
    data, files = _form_data()

    # Simulate validator rejecting due to size
    with patch(
        "app.routers.uploads.validate_audio_file",
        return_value=(
            False,
            {
                "valid": False,
                "error": "File too large. Maximum size is 100MB",
                "error_code": "file_too_large",
                "file_extension": ".mp3",
                "file_size_bytes": 150 * 1024 * 1024,
            },
        ),
    ):
        resp = client.post("/upload", data={**data, "skip_duplicate_check": "true"}, files=files)

    assert resp.status_code == 400, resp.text
    body = resp.json()
    # FastAPI returns HTTPException detail under 'detail'
    assert body.get("detail", {}).get("error_code") == "file_too_large"


def test_upload_unsupported_file_type_returns_400(test_app, tmp_path):
    client = TestClient(test_app)
    data, files = _form_data(file_name="track.xyz", content=b"abc")

    with patch(
        "app.routers.uploads.validate_audio_file",
        return_value=(
            False,
            {
                "valid": False,
                "error": "Unsupported file type. Supported extensions: ...",
                "error_code": "unsupported_file_type",
                "file_extension": ".xyz",
                "detected_type": "application/octet-stream",
                "file_size_bytes": len(files["file"][1].getvalue()),
            },
        ),
    ):
        resp = client.post("/upload", data={**data, "skip_duplicate_check": "true"}, files=files)

    assert resp.status_code == 400, resp.text
    body = resp.json()
    assert body.get("detail", {}).get("error_code") == "unsupported_file_type"


def test_upload_duplicate_returns_409_pre_storage(test_app, tmp_path):
    client = TestClient(test_app)
    data, files = _form_data(file_name="dupe.mp3", content=b"same-content")

    # Shared patches: make validation succeed; disable AI art; use local storage (no B2)
    base_validate_ok = (
        True,
        {
            "valid": True,
            "mime_type": "audio/mpeg",
            "file_extension": ".mp3",
            "file_size_bytes": len(files["file"][1].getvalue()),
        },
    )

    with patch("app.routers.uploads.validate_audio_file", return_value=base_validate_ok):
        with patch("app.routers.uploads.AIArtGenerator.generate_cover_art_from_metadata", return_value=None):
            with patch("app.routers.uploads.B2Storage.is_configured", return_value=False):
                # First upload should succeed (no duplicates yet)
                resp1 = client.post("/upload", data=data, files=files)
                assert resp1.status_code == 201, resp1.text

                # Second upload with the same title/artist/file size should trigger pre-storage duplicate detection
                resp2 = client.post("/upload", data=data, files=files)

    assert resp2.status_code == 409, resp2.text
    body = resp2.json()
    assert body.get("detail", {}).get("error_code") == "duplicate_track"


def test_enforce_b2_only_returns_503_when_unconfigured(test_app, tmp_path, monkeypatch):
    client = TestClient(test_app)
    data, files = _form_data(file_name="policy.mp3")

    # Enforce remote-only policy
    monkeypatch.setenv("ENFORCE_B2_ONLY", "1")

    with patch(
        "app.routers.uploads.validate_audio_file",
        return_value=(
            True,
            {
                "valid": True,
                "mime_type": "audio/mpeg",
                "file_extension": ".mp3",
                "file_size_bytes": len(files["file"][1].getvalue()),
            },
        ),
    ):
        with patch("app.routers.uploads.AIArtGenerator.generate_cover_art_from_metadata", return_value=None):
            with patch("app.routers.uploads.B2Storage.is_configured", return_value=False):
                resp = client.post("/upload", data=data, files=files)

    assert resp.status_code == 503, resp.text
    body = resp.json()
    assert body.get("detail", {}).get("error_code") == "storage_unavailable"
    # Ensure no audio file was saved locally (DB file may exist in tmp_path)
    assert not any(Path(tmp_path).glob("*.mp3")), "No audio files should be created when ENFORCE_B2_ONLY is enabled"
