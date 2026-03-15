import sys
from pathlib import Path

import pytest
from fastapi import HTTPException

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.security import require_admin


class DummyUser:
    def __init__(self, username: str, email: str):
        self.username = username
        self.email = email


def test_require_admin_denies_when_admin_allowlist_is_unset(monkeypatch):
    monkeypatch.delenv("ADMIN_USERNAMES", raising=False)

    with pytest.raises(HTTPException) as excinfo:
        require_admin(DummyUser(username="admin", email="admin@example.com"))

    assert excinfo.value.status_code == 403
    assert excinfo.value.detail == "Admin access is not configured"


def test_require_admin_allows_listed_username(monkeypatch):
    monkeypatch.setenv("ADMIN_USERNAMES", "admin,other-user")

    user = require_admin(DummyUser(username="admin", email="admin@example.com"))

    assert user.username == "admin"


def test_require_admin_denies_unlisted_user(monkeypatch):
    monkeypatch.setenv("ADMIN_USERNAMES", "someone-else@example.com")

    with pytest.raises(HTTPException) as excinfo:
        require_admin(DummyUser(username="admin", email="admin@example.com"))

    assert excinfo.value.status_code == 403
    assert excinfo.value.detail == "Admin access required"
