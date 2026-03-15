import importlib
import io
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


@pytest.fixture()
def limited_app(tmp_path, monkeypatch):
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path / "uploads"))
    monkeypatch.setenv("AI_COVER_TIMEOUT_SECONDS", "0.1")
    monkeypatch.setenv("SQLALCHEMY_DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setenv("ENABLE_INPROCESS_RATE_LIMITING", "1")
    monkeypatch.setenv("UPLOAD_RATE_LIMIT", "2")
    monkeypatch.setenv("UPLOAD_RATE_LIMIT_WINDOW_SECONDS", "60")
    monkeypatch.setenv("STREAM_RATE_LIMIT", "2")
    monkeypatch.setenv("STREAM_RATE_LIMIT_WINDOW_SECONDS", "60")

    import app.db.database as db_mod
    import app.main as app_main
    import app.rate_limit as rate_limit_mod
    import app.routers.tracks as tracks_mod
    import app.routers.uploads as uploads_mod

    importlib.reload(rate_limit_mod)
    importlib.reload(db_mod)
    importlib.reload(uploads_mod)
    importlib.reload(tracks_mod)
    importlib.reload(app_main)
    rate_limit_mod.rate_limiter._events.clear()
    return app_main.app, rate_limit_mod


@pytest.fixture()
def limited_client(limited_app):
    app, _ = limited_app
    return TestClient(app)


def _upload_form(name: str = "rl.mp3"):
    return {
        "title": "Rate Limited Title",
        "artist_name": "Rate Limited Artist",
        "skip_duplicate_check": "true",
    }, {
        "file": (name, io.BytesIO(b"rate-limited-audio"), "audio/mpeg")
    }


def test_upload_rate_limit_returns_429(limited_client):
    with patch("app.routers.uploads.validate_audio_file", return_value=(True, {
        "valid": True,
        "mime_type": "audio/mpeg",
        "file_extension": ".mp3",
        "file_size_bytes": len(b"rate-limited-audio"),
    })), patch("app.routers.uploads.AIArtGenerator.generate_cover_art_from_metadata", return_value=None), patch(
        "app.routers.uploads.B2Storage.is_configured", return_value=False
    ):
        for idx in range(2):
            data, files = _upload_form(name=f"rl-{idx}.mp3")
            response = limited_client.post("/upload", data=data, files=files)
            assert response.status_code == 201, response.text

        data, files = _upload_form(name="rl-3.mp3")
        blocked = limited_client.post("/upload", data=data, files=files)

    assert blocked.status_code == 429, blocked.text
    body = blocked.json()["detail"]
    assert body["error_code"] == "rate_limited"
    assert body["bucket"] == "upload"
    assert blocked.headers.get("retry-after")


def test_stream_proxy_rate_limit_returns_429(limited_client):
    fake_track = MagicMock()
    fake_track.id = 1
    fake_track.file_path = "https://example.com/audio/test.mp3"
    fake_track.availability = "public"
    fake_track.play_count = 0
    fake_track.artist = MagicMock()

    async def _ok_head(*args, **kwargs):
        response = MagicMock()
        response.status_code = 200
        response.headers = {
            "Content-Type": "audio/mpeg",
            "Content-Length": "12345",
            "Accept-Ranges": "bytes",
        }
        return response

    with patch("app.routers.tracks.crud.get_mix", return_value=fake_track), patch("httpx.AsyncClient.head", side_effect=_ok_head):
        for _ in range(2):
            response = limited_client.head("/tracks/1/stream/proxy", follow_redirects=False)
            assert response.status_code == 200, response.text

        blocked = limited_client.head("/tracks/1/stream/proxy", follow_redirects=False)

    assert blocked.status_code == 429, blocked.text
    assert blocked.headers.get("retry-after")
