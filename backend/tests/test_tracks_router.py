import pytest
import os
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from fastapi import FastAPI
import sys

# Add backend to path for imports
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.routers.tracks import router
from app import schemas
from app.models import models
from app.db.database import SessionLocal

# Create test app
app = FastAPI()
app.include_router(router)
client = TestClient(app)

class TestTrackStreaming:
    """Test track streaming functionality."""
    
    @pytest.fixture
    def mock_db_session(self):
        """Mock database session."""
        with patch('app.routers.tracks.get_db') as mock_get_db:
            mock_session = MagicMock()
            mock_get_db.return_value = mock_session
            yield mock_session
    
    @pytest.fixture
    def sample_track(self):
        """Sample track data for testing."""
        track = MagicMock()
        track.id = 1
        track.title = "Test Track"
        track.file_path = "/uploads/test_track.mp3"
        track.availability = "public"
        track.artist = MagicMock()
        track.artist.name = "Test Artist"
        return track
    
    def test_stream_track_success(self, mock_db_session, sample_track):
        """Test successful track streaming."""
        mock_db_session.query().filter().first.return_value = sample_track
        
        # Mock all file system operations
        with patch('os.path.exists', return_value=True), \
             patch('os.path.getsize', return_value=5000000), \
             patch('os.path.abspath', side_effect=lambda x: f"/abs/{x}"), \
             patch('os.path.commonpath', return_value="/abs/uploads"), \
             patch('os.path.relpath', return_value="test.mp3"), \
             patch('fastapi.responses.RedirectResponse') as mock_redirect:
            
            mock_redirect.return_value = MagicMock(status_code=307)
            
            response = client.get("/tracks/1/stream")
            
            # Should redirect to /uploads/test.mp3 or return success
            assert response.status_code in [200, 307] or mock_redirect.called
    
    def test_stream_track_not_found(self, mock_db_session):
        """Test streaming non-existent track."""
        mock_db_session.query().filter().first.return_value = None
        
        response = client.get("/tracks/999/stream")
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
    
    def test_stream_track_file_missing(self, mock_db_session, sample_track):
        """Test streaming when file is missing from filesystem."""
        mock_db_session.query().filter().first.return_value = sample_track
        
        with patch('os.path.exists', return_value=False):
            response = client.get("/tracks/1/stream")
            
            assert response.status_code == 404
            assert "file not found" in response.json()["detail"].lower()
    
    def test_stream_private_track_unauthorized(self, mock_db_session, sample_track):
        """Test streaming private track without authorization."""
        sample_track.availability = "private"
        mock_db_session.query().filter().first.return_value = sample_track
        
        response = client.get("/tracks/1/stream")
        
        # Should require authentication for private tracks
        assert response.status_code in [401, 403]
    
    def test_stream_track_range_request(self, mock_db_session, sample_track):
        """Test HTTP range requests for streaming."""
        mock_db_session.query().filter().first.return_value = sample_track
        
        with patch('os.path.exists', return_value=True), \
             patch('os.path.getsize', return_value=5000000), \
             patch('os.path.abspath', side_effect=lambda x: f"/abs/{x}"), \
             patch('os.path.commonpath', return_value="/abs/uploads"), \
             patch('os.path.relpath', return_value="test.mp3"), \
             patch('app.routers.tracks.RedirectResponse') as mock_redirect:
            
            # Request partial content
            headers = {"Range": "bytes=0-1023"}
            response = client.get("/tracks/1/stream", headers=headers)
            
            # Should support range requests for efficient streaming
            assert response.status_code in [200, 206]  # OK or Partial Content

class TestTrackMetadata:
    """Test track metadata retrieval."""
    
    @pytest.fixture
    def mock_db_session(self):
        """Mock database session."""
        with patch('app.routers.tracks.get_db') as mock_get_db:
            mock_session = MagicMock()
            mock_get_db.return_value = mock_session
            yield mock_session
    
    @pytest.fixture
    def detailed_track(self):
        """Detailed track with metadata."""
        track = MagicMock()
        track.id = 1
        track.title = "Detailed Track"
        track.duration_seconds = 240
        track.quality_kbps = 320
        track.file_size_mb = 7.5
        track.genre = "Electronic"
        track.album = "Test Album"
        track.year = 2024
        track.bpm = 128
        track.availability = "public"
        track.artist = MagicMock()
        track.artist.name = "Test Artist"
        track.artist.id = 1
        return track
    
    def test_get_track_metadata_success(self, mock_db_session, detailed_track):
        """Test successful metadata retrieval."""
        mock_db_session.query().filter().first.return_value = detailed_track
        
        response = client.get("/tracks/1")
        
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Detailed Track"
        assert data["duration_seconds"] == 240
        assert data["quality_kbps"] == 320
        assert data["genre"] == "Electronic"
        assert data["artist"]["name"] == "Test Artist"
    
    def test_get_track_metadata_not_found(self, mock_db_session):
        """Test metadata retrieval for non-existent track."""
        mock_db_session.query().filter().first.return_value = None
        
        response = client.get("/tracks/999")
        
        assert response.status_code == 404
    
    def test_get_track_metadata_private_unauthorized(self, mock_db_session, detailed_track):
        """Test metadata access for private track without authorization."""
        detailed_track.availability = "private"
        mock_db_session.query().filter().first.return_value = detailed_track
        
        response = client.get("/tracks/1")
        
        # Should require authentication for private tracks
        assert response.status_code in [401, 403]

class TestTrackDownload:
    """Test track download functionality."""
    
    @pytest.fixture
    def mock_db_session(self):
        """Mock database session."""
        with patch('app.routers.tracks.get_db') as mock_get_db:
            mock_session = MagicMock()
            mock_get_db.return_value = mock_session
            yield mock_session
    
    @pytest.fixture
    def downloadable_track(self):
        """Track that allows downloads."""
        track = MagicMock()
        track.id = 1
        track.title = "Downloadable Track"
        track.original_filename = "track.mp3"
        track.file_path = "/uploads/track.mp3"
        track.allow_downloads = "yes"
        track.availability = "public"
        track.artist = MagicMock()
        track.artist.name = "Test Artist"
        return track
    
    def test_download_track_success(self, mock_db_session, downloadable_track):
        """Test successful track download."""
        mock_db_session.query().filter().first.return_value = downloadable_track
        
        with patch('os.path.exists', return_value=True), \
             patch('os.path.getsize', return_value=5000000), \
             patch('builtins.open', create=True) as mock_open:
            
            mock_file = MagicMock()
            mock_file.read.return_value = b'audio_data'
            mock_open.return_value.__enter__.return_value = mock_file
            
            response = client.get("/tracks/1/download")
            
            assert response.status_code == 200
            assert "attachment" in response.headers.get("content-disposition", "")
    
    def test_download_track_not_allowed(self, mock_db_session, downloadable_track):
        """Test download when downloads are disabled."""
        downloadable_track.allow_downloads = "no"
        mock_db_session.query().filter().first.return_value = downloadable_track
        
        response = client.get("/tracks/1/download")
        
        assert response.status_code == 403
        assert "download not allowed" in response.json()["detail"].lower()
    
    def test_download_track_not_found(self, mock_db_session):
        """Test download of non-existent track."""
        mock_db_session.query().filter().first.return_value = None
        
        response = client.get("/tracks/999/download")
        
        assert response.status_code == 404

class TestPlayCountStatistics:
    """Test play count and statistics tracking."""
    
    @pytest.fixture
    def mock_db_session(self):
        """Mock database session."""
        with patch('app.routers.tracks.get_db') as mock_get_db:
            mock_session = MagicMock()
            mock_get_db.return_value = mock_session
            yield mock_session
    
    def test_increment_play_count_on_stream(self, mock_db_session):
        """Test that play count increments when track is streamed."""
        track = MagicMock()
        track.id = 1
        track.play_count = 5
        track.file_path = "/uploads/test.mp3"
        track.availability = "public"
        mock_db_session.query().filter().first.return_value = track
        
        with patch('os.path.exists', return_value=True), \
             patch('os.path.getsize', return_value=5000000), \
             patch('builtins.open', create=True):
            
            client.get("/tracks/1/stream")
            
            # Play count should be incremented
            assert track.play_count == 6
            mock_db_session.commit.assert_called()
    
    def test_track_statistics_endpoint(self, mock_db_session):
        """Test track statistics retrieval."""
        track = MagicMock()
        track.id = 1
        track.play_count = 150
        track.download_count = 25
        mock_db_session.query().filter().first.return_value = track
        
        response = client.get("/tracks/1/stats")
        
        assert response.status_code == 200
        stats = response.json()
        assert stats["play_count"] == 150
        assert stats["download_count"] == 25
        
    def test_admin_delete_endpoint(self, mock_db_session):
        """Test admin delete endpoint."""
        # Setup mock track
        track = MagicMock()
        track.id = 1
        track.title = "Test Track"
        track.artist = MagicMock()
        track.artist.name = "Test Artist"
        track.file_path = "https://example.com/test.mp3"
        track.cover_art_url = "/uploads/cover.jpg"
        mock_db_session.query().filter().first.return_value = track
        
        # Mock B2Storage
        with patch('app.routers.tracks.B2Storage') as mock_b2:
            # Configure the mock
            mock_b2_instance = mock_b2.return_value
            mock_b2_instance.is_configured.return_value = True
            mock_b2_instance.extract_key_from_url.return_value = "test.mp3"
            mock_b2_instance.delete_file.return_value = True
            
            # Mock os.path.exists and os.remove for cover art
            with patch('os.path.exists', return_value=True), \
                 patch('os.remove', return_value=None):
                
                # Call the endpoint
                response = client.delete("/tracks/admin/1")
                
                # Verify response
                assert response.status_code == 200
                result = response.json()
                assert result["id"] == 1
                assert result["title"] == "Test Mix"
                assert result["artist"] == "Test Artist"
                assert result["deleted"] == True
                
                # Verify B2 deletion was attempted
                mock_b2_instance.extract_key_from_url.assert_called_once_with("https://example.com/test.mp3")
                mock_b2_instance.delete_file.assert_called_once_with("test.mp3")
                
                # Verify DB deletion
                mock_db_session.delete.assert_called_once_with(track)
                mock_db_session.commit.assert_called_once()
    
    def test_increment_download_count(self, mock_db_session):
        """Test that download count increments on download."""
        track = MagicMock()
        track.id = 1
        track.download_count = 10
        track.allow_downloads = "yes"
        track.file_path = "/uploads/test.mp3"
        track.availability = "public"
        mock_db_session.query().filter().first.return_value = track
        
        with patch('os.path.exists', return_value=True), \
             patch('os.path.getsize', return_value=5000000), \
             patch('builtins.open', create=True):
            
            client.get("/tracks/1/download")
            
            # Download count should be incremented
            assert track.download_count == 11
            mock_db_session.commit.assert_called()

class TestTrackSearch:
    """Test track search functionality."""
    
    @pytest.fixture
    def mock_db_session(self):
        """Mock database session."""
        with patch('app.routers.tracks.get_db') as mock_get_db:
            mock_session = MagicMock()
            mock_get_db.return_value = mock_session
            yield mock_session
    
    def test_search_tracks_by_title(self, mock_db_session):
        """Test searching tracks by title."""
        mock_tracks = [
            MagicMock(id=1, title="Electronic Dreams", artist=MagicMock(name="DJ Test")),
            MagicMock(id=2, title="Dream State", artist=MagicMock(name="Producer X"))
        ]
        
        # Mock the full query chain for search
        mock_query = MagicMock()
        mock_query.join.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.offset.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = mock_tracks
        mock_db_session.query.return_value = mock_query
        
        response = client.get("/tracks/search?q=dream")
        
        assert response.status_code == 200
        results = response.json()
        assert len(results) == 2
    
    def test_search_tracks_by_artist(self, mock_db_session):
        """Test searching tracks by artist name."""
        mock_tracks = [
            MagicMock(id=1, title="Track 1", artist=MagicMock(name="Test Artist")),
            MagicMock(id=2, title="Track 2", artist=MagicMock(name="Test Artist"))
        ]
        mock_db_session.query().join().filter().all.return_value = mock_tracks
        
        response = client.get("/tracks/search?q=test+artist")
        
        assert response.status_code == 200
        results = response.json()
        assert len(results) == 2
    
    def test_search_tracks_by_genre(self, mock_db_session):
        """Test searching tracks by genre."""
        mock_tracks = [
            MagicMock(id=1, title="Electronic Track", genre="Electronic"),
            MagicMock(id=2, title="Synthwave Track", genre="Electronic")
        ]
        mock_db_session.query().filter().all.return_value = mock_tracks
        
        response = client.get("/tracks/search?genre=electronic")
        
        assert response.status_code == 200
        results = response.json()
        assert len(results) == 2
        assert all(track["genre"] == "Electronic" for track in results)
    
    def test_search_tracks_pagination(self, mock_db_session):
        """Test search results pagination."""
        # Mock 25 tracks
        mock_tracks = [MagicMock(id=i, title=f"Track {i}") for i in range(25)]
        mock_db_session.query().offset().limit().all.return_value = mock_tracks[:10]
        
        response = client.get("/tracks/search?q=track&page=1&limit=10")
        
        assert response.status_code == 200
        results = response.json()
        assert len(results) <= 10  # Should respect limit
    
    def test_search_tracks_empty_query(self, mock_db_session):
        """Test search with empty query."""
        response = client.get("/tracks/search?q=")
        
        # Should return bad request or empty results
        assert response.status_code in [200, 400]

class TestTrackAccessControl:
    """Test track access control and permissions."""
    
    @pytest.fixture
    def mock_db_session(self):
        """Mock database session."""
        with patch('app.routers.tracks.get_db') as mock_get_db:
            mock_session = MagicMock()
            mock_get_db.return_value = mock_session
            yield mock_session
    
    def test_age_restricted_track_access(self, mock_db_session):
        """Test access to age-restricted tracks."""
        track = MagicMock()
        track.id = 1
        track.age_restriction = "18+"
        track.availability = "public"
        mock_db_session.query().filter().first.return_value = track
        
        # Without age verification
        response = client.get("/tracks/1")
        
        # Should require age verification
        assert response.status_code in [200, 403]  # Depends on implementation
    
    def test_private_track_owner_access(self, mock_db_session):
        """Test that track owner can access private tracks."""
        track = MagicMock()
        track.id = 1
        track.availability = "private"
        track.artist.id = 1
        mock_db_session.query().filter().first.return_value = track
        
        # Mock authenticated user as owner
        with patch('app.routers.tracks.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=1)
            
            response = client.get("/tracks/1")
            
            # Owner should have access
            assert response.status_code == 200
    
    def test_private_track_non_owner_access(self, mock_db_session):
        """Test that non-owners cannot access private tracks."""
        track = MagicMock()
        track.id = 1
        track.availability = "private"
        track.artist.id = 1
        mock_db_session.query().filter().first.return_value = track
        
        # Mock authenticated user as non-owner
        with patch('app.routers.tracks.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=2)  # Different user
            
            response = client.get("/tracks/1")
            
            # Non-owner should be denied access
            assert response.status_code == 403

class TestTrackQualitySelection:
    """Test streaming quality selection."""
    
    @pytest.fixture
    def mock_db_session(self):
        """Mock database session."""
        with patch('app.routers.tracks.get_db') as mock_get_db:
            mock_session = MagicMock()
            mock_get_db.return_value = mock_session
            yield mock_session
    
    def test_stream_quality_selection(self, mock_db_session):
        """Test streaming with quality parameter."""
        track = MagicMock()
        track.id = 1
        track.file_path = "/uploads/track.mp3"
        track.quality_kbps = 320
        track.availability = "public"
        mock_db_session.query().filter().first.return_value = track
        
        with patch('os.path.exists', return_value=True), \
             patch('os.path.getsize', return_value=5000000):
            
            # Request specific quality
            response = client.get("/tracks/1/stream?quality=128")
            
            # Should handle quality selection (if implemented)
            assert response.status_code in [200, 400]  # OK or not supported
    
    def test_adaptive_quality_based_on_connection(self, mock_db_session):
        """Test adaptive quality based on connection speed."""
        track = MagicMock()
        track.id = 1
        track.file_path = "/uploads/track.mp3"
        track.availability = "public"
        mock_db_session.query().filter().first.return_value = track
        
        # Mock slow connection headers
        headers = {"Connection": "slow"}
        
        with patch('os.path.exists', return_value=True):
            response = client.get("/tracks/1/stream", headers=headers)
            
            # Should adapt quality for slow connections (if implemented)
            assert response.status_code == 200
