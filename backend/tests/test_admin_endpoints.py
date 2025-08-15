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
from app.routers.tracks import _get_db_dyn

class TestAdminEndpoints:
    """Test admin endpoints functionality."""
    
    def test_admin_delete_endpoint(self):
        """Test admin delete endpoint."""
        # Create a mock track
        track = MagicMock()
        track.id = 1
        track.title = "Test Mix"
        track.file_path = "https://f002.backblazeb2.com/file/papzincrew/test.mp3"
        track.cover_art = "uploads/cover_1.jpg"
        track.artist = MagicMock()
        track.artist.name = "Test Artist"
        
        # Create a mock of the database session
        mock_db = MagicMock()
        
        # Set up the mock query to return our track
        mock_query = MagicMock()
        mock_filter = MagicMock()
        mock_filter.first.return_value = track
        mock_query.filter.return_value = mock_filter
        mock_db.query.return_value = mock_query
        
        # Create a test client with dependency overrides
        def override_get_db():
            return mock_db
            
        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[_get_db_dyn] = override_get_db
        
        client = TestClient(app)
        
        # Mock B2Storage
        with patch('app.routers.tracks.B2Storage') as mock_b2, \
             patch('os.path.exists', return_value=True), \
             patch('os.remove', return_value=None):
            
            # Configure the B2 mock
            mock_b2_instance = mock_b2.return_value
            mock_b2_instance.is_configured.return_value = True
            mock_b2_instance.extract_key_from_url.return_value = "test.mp3"    
            mock_b2_instance.delete_file.return_value = True
            
            # Call the endpoint
            response = client.delete("/tracks/admin/1")
            
            # Print response for debugging
            print(f"Response status: {response.status_code}")
            print(f"Response body: {response.text}")
            
            # Verify response
            assert response.status_code == 200
            result = response.json()
            assert result["id"] == 1
            assert result["title"] == "Test Mix"
            assert result["artist"] == "Test Artist"
            assert result["deleted"] == True
            
            # Verify B2 deletion was attempted
            mock_b2_instance.extract_key_from_url.assert_called_once_with("https://f002.backblazeb2.com/file/papzincrew/test.mp3")
            mock_b2_instance.delete_file.assert_called_once_with("test.mp3")
            
            # Verify DB deletion
            mock_db.delete.assert_called_once_with(track)
            mock_db.commit.assert_called_once()
            
        # Clean up dependency overrides
        app.dependency_overrides.clear()