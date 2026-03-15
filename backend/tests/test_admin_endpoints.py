import pytest
import os
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from fastapi import FastAPI, Request
import sys

# Add backend to path for imports
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Import the main app and dependencies
from app.main import app
from app import schemas
from app.models.models import Mix
from app.db.database import get_db, SessionLocal
from app.routers.tracks import _get_db_dyn, router as tracks_router
from app.security import require_admin


class TestAdminEndpoints:
    """Test admin endpoints functionality."""

    def test_admin_delete_endpoint_requires_admin_auth(self):
        test_app = FastAPI()
        test_app.include_router(tracks_router)
        client = TestClient(test_app)
        response = client.delete("/tracks/admin/1")

        assert response.status_code == 401

    def test_admin_delete_endpoint(self):
        """Test admin delete endpoint for an authorized admin."""
        track = MagicMock()
        track.id = 1
        track.title = "Test Mix"
        track.file_path = "https://f002.backblazeb2.com/file/papzincrew/test.mp3"
        track.cover_art = "uploads/cover_1.jpg"
        track.artist = MagicMock()
        track.artist.name = "Test Artist"

        mock_db = MagicMock()
        mock_query = MagicMock()
        mock_filter = MagicMock()
        mock_filter.first.return_value = track
        mock_query.filter.return_value = mock_filter
        mock_db.query.return_value = mock_query

        def override_get_db():
            return mock_db

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[_get_db_dyn] = override_get_db
        app.dependency_overrides[require_admin] = lambda: MagicMock(username="admin", email="admin@example.com")

        client = TestClient(app)

        try:
            with patch('app.routers.tracks.B2Storage') as mock_b2, \
                 patch('os.path.exists', return_value=True), \
                 patch('os.remove', return_value=None):

                mock_b2_instance = mock_b2.return_value
                mock_b2_instance.is_configured.return_value = True
                mock_b2_instance.extract_key_from_url.return_value = "test.mp3"
                mock_b2_instance.delete_file.return_value = True

                response = client.delete("/tracks/admin/1")

                assert response.status_code == 200
                result = response.json()
                assert result["id"] == 1
                assert result["title"] == "Test Mix"
                assert result["artist"] == "Test Artist"
                assert result["deleted"] is True

                mock_b2_instance.extract_key_from_url.assert_called_once_with(
                    "https://f002.backblazeb2.com/file/papzincrew/test.mp3"
                )
                mock_b2_instance.delete_file.assert_called_once_with("test.mp3")
                mock_db.delete.assert_called_once_with(track)
                mock_db.commit.assert_called_once()
        finally:
            app.dependency_overrides.clear()
