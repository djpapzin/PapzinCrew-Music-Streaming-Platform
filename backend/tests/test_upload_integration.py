import importlib
import io
import sys
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


@pytest.fixture()
def integration_app(tmp_path, monkeypatch):
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path / "uploads"))
    monkeypatch.setenv("AI_COVER_TIMEOUT_SECONDS", "0.1")
    monkeypatch.setenv("ENABLE_INPROCESS_RATE_LIMITING", "0")
    monkeypatch.setenv("ENFORCE_B2_ONLY", "0")
    db_path = tmp_path / "test.db"
    monkeypatch.setenv("SQLALCHEMY_DATABASE_URL", f"sqlite:///{db_path}")

    import app.db.database as db_mod
    import app.main as app_main
    import app.routers.uploads as uploads_mod

    importlib.reload(db_mod)
    importlib.reload(uploads_mod)
    importlib.reload(app_main)
    return app_main.app


@pytest.fixture()
def integration_client(integration_app):
    return TestClient(integration_app)


def _audio_form(file_name: str = "integration.mp3", content: bytes = b"integration-audio", paperclip_task_id: int | None = None):
    data = {
        "title": "Integration Title",
        "artist_name": "Integration Artist",
        "skip_duplicate_check": "true",
    }
    if paperclip_task_id is not None:
        data["paperclip_task_id"] = str(paperclip_task_id)
    files = {
        "file": (file_name, io.BytesIO(content), "audio/mpeg"),
    }
    return data, files


def _opus_form(file_name: str = "integration.opus", content: bytes = b"integration-opus"):
    data = {
        "title": "Integration OPUS Title",
        "artist_name": "Integration OPUS Artist",
        "skip_duplicate_check": "true",
    }
    files = {
        "file": (file_name, io.BytesIO(content), "audio/opus"),
    }
    return data, files


@pytest.mark.integration
def test_upload_local_scaffold_persists_mix_and_file(integration_client):
    data, files = _audio_form(file_name="local.mp3")

    with patch("app.routers.uploads.validate_audio_file", return_value=(True, {
        "valid": True,
        "mime_type": "audio/mpeg",
        "file_extension": ".mp3",
        "file_size_bytes": len(files["file"][1].getvalue()),
    })), patch("app.routers.uploads.AIArtGenerator.generate_cover_art_from_metadata", return_value=None), patch(
        "app.routers.uploads.B2Storage.is_configured", return_value=False
    ):
        response = integration_client.post("/upload", data=data, files=files)

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["storage"] == "local_filesystem"
    assert body["id"] > 0
    assert body["paperclip_task_id"] == body["id"]
    location = Path(body["location"])
    assert location.exists()

    from app.db.database import SessionLocal
    from app.models import models

    db = SessionLocal()
    try:
        mix = db.query(models.Mix).filter(models.Mix.id == body["id"]).first()
        assert mix is not None
        assert mix.file_path == body["file_path"]
        assert mix.title == "Integration Title"
        assert mix.artist.name == "Integration Artist"
    finally:
        db.close()


@pytest.mark.integration
def test_upload_b2_success_scaffold_persists_remote_mix(integration_client):
    data, files = _audio_form(file_name="remote.mp3")
    expected_url = "https://b2.example/audio/integration-artist-integration-title.mp3"

    with patch("app.routers.uploads.validate_audio_file", return_value=(True, {
        "valid": True,
        "mime_type": "audio/mpeg",
        "file_extension": ".mp3",
        "file_size_bytes": len(files["file"][1].getvalue()),
    })), patch("app.routers.uploads.AIArtGenerator.generate_cover_art_from_metadata", return_value=None), patch(
        "app.routers.uploads.B2Storage.is_configured", return_value=True
    ), patch("app.routers.uploads.B2Storage.put_bytes_safe", return_value={
        "ok": True,
        "key": "audio/integration-artist-integration-title-mock.mp3",
        "url": expected_url,
    }):
        response = integration_client.post("/upload", data=data, files=files)

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["storage"] == "b2"
    assert body["location"].startswith("audio/integration-artist-integration-title")
    assert body["location"].endswith(".mp3")
    assert body["file_path"] == expected_url

    from app.db.database import SessionLocal
    from app.models import models

    db = SessionLocal()
    try:
        mix = db.query(models.Mix).filter(models.Mix.id == body["id"]).first()
        assert mix is not None
        assert mix.file_path == expected_url
    finally:
        db.close()


@pytest.mark.integration
def test_upload_b2_only_mode_returns_503_without_local_artifact(integration_client, tmp_path, monkeypatch):
    data, files = _audio_form(file_name="b2-only.mp3")
    monkeypatch.setenv("ENFORCE_B2_ONLY", "1")

    with patch("app.routers.uploads.validate_audio_file", return_value=(True, {
        "valid": True,
        "mime_type": "audio/mpeg",
        "file_extension": ".mp3",
        "file_size_bytes": len(files["file"][1].getvalue()),
    })), patch("app.routers.uploads.AIArtGenerator.generate_cover_art_from_metadata", return_value=None), patch(
        "app.routers.uploads.B2Storage.is_configured", return_value=False
    ):
        response = integration_client.post("/upload", data=data, files=files)

    assert response.status_code == 503, response.text
    detail = response.json()["detail"]
    assert detail["error_code"] == "storage_unavailable"
    assert not list((tmp_path / "uploads").glob("*.mp3"))


@pytest.mark.integration
def test_upload_opus_file_success(integration_client):
    data, files = _opus_form(file_name="test.opus")

    with patch("app.routers.uploads.validate_audio_file", return_value=(True, {
        "valid": True,
        "mime_type": "audio/opus",
        "file_extension": ".opus",
        "file_size_bytes": len(files["file"][1].getvalue()),
    })), patch("app.routers.uploads.AIArtGenerator.generate_cover_art_from_metadata", return_value=None), patch(
        "app.routers.uploads.B2Storage.is_configured", return_value=False
    ):
        response = integration_client.post("/upload", data=data, files=files)

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["storage"] == "local_filesystem"
    assert body["id"] > 0
    assert ".opus" in body["location"]


@pytest.mark.integration
def test_upload_round_trips_paperclip_task_id(integration_client):
    data, files = _audio_form(file_name="paperclip.mp3", paperclip_task_id=321)

    with patch("app.routers.uploads.validate_audio_file", return_value=(True, {
        "valid": True,
        "mime_type": "audio/mpeg",
        "file_extension": ".mp3",
        "file_size_bytes": len(files["file"][1].getvalue()),
    })), patch("app.routers.uploads.AIArtGenerator.generate_cover_art_from_metadata", return_value=None), patch(
        "app.routers.uploads.B2Storage.is_configured", return_value=False
    ):
        response = integration_client.post("/upload", data=data, files=files)

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["paperclip_task_id"] == 321
    assert body["id"] > 0
