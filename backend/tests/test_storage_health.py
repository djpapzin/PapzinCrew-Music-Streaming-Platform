import sys
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

# Ensure we can import backend app module by adding backend/ to sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app  # noqa: E402

client = TestClient(app)


@pytest.fixture
def mock_b2_health_ok():
    return {
        "configured": True,
        "ok": True,
        "endpoint": "https://example",
        "bucket": "bucket",
        "region": "us-west-002",
    }


@pytest.fixture
def mock_b2_health_not_configured():
    return {"configured": False, "ok": False, "error_code": "not_configured"}


@pytest.fixture
def mock_b2_health_degraded():
    return {"configured": True, "ok": False, "error_code": "auth_error", "detail": "bad creds"}


def test_storage_health_not_configured(mock_b2_health_not_configured):
    with patch("app.routers.storage.B2Storage.check_health", return_value=mock_b2_health_not_configured):
        resp = client.get("/storage/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "disabled"
    assert data["b2"]["configured"] is False


def test_storage_health_ok(mock_b2_health_ok):
    with patch("app.routers.storage.B2Storage.check_health", return_value=mock_b2_health_ok):
        resp = client.get("/storage/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["b2"]["ok"] is True
    assert data["b2"]["bucket"] == "bucket"


def test_storage_health_degraded(mock_b2_health_degraded):
    with patch("app.routers.storage.B2Storage.check_health", return_value=mock_b2_health_degraded):
        resp = client.get("/storage/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "degraded"
    assert data["b2"]["ok"] is False
    assert data["b2"]["error_code"] == "auth_error"
