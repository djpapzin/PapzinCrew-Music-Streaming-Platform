import os
import io
import logging
import pytest
import asyncio
from unittest.mock import patch, MagicMock
from pathlib import Path
import sys

# Add backend to path for imports
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.routers.uploads import _save_cover_art
from app.services.b2_storage import B2Storage

@pytest.fixture(autouse=True)
def _set_caplog_level(caplog):
    """Capture INFO logs from uploads module for assertions."""
    caplog.set_level(logging.INFO, logger="app.routers.uploads")

# Sample cover art data (small red dot PNG)
TEST_COVER_ART = (
    b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x02\x00\x00\x05\x00\x01\x0e\x0e4\x9c\x00\x00\x00\x00IEND\xaeB`\x82'
)

@pytest.fixture
def temp_upload_dir(tmp_path):
    """Create and return a temporary upload directory."""
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    return str(upload_dir)

@pytest.fixture
def mock_b2_success():
    """Mock B2Storage with successful upload."""
    with patch('app.routers.uploads.B2Storage') as mock_b2:
        mock_instance = mock_b2.return_value
        mock_instance.is_configured.return_value = True
        mock_instance.put_bytes_safe.return_value = {
            "ok": True,
            "url": "https://example.com/covers/test-cover.jpg",
            "key": "covers/test-cover.jpg"
        }
        yield mock_instance

@pytest.fixture
def mock_b2_failure():
    """Mock B2Storage with upload failure."""
    with patch('app.routers.uploads.B2Storage') as mock_b2:
        mock_instance = mock_b2.return_value
        mock_instance.is_configured.return_value = True
        mock_instance.put_bytes_safe.return_value = {
            "ok": False,
            "error_code": "test_error",
            "detail": "Test error"
        }
        yield mock_instance

@pytest.fixture
def mock_b2_timeout():
    """Mock B2Storage with upload timeout."""
    import time
    def slow_put_bytes(*args, **kwargs):
        # Sleep longer than the patched B2_PUT_TIMEOUT to trigger asyncio.wait_for timeout
        time.sleep(0.2)
        return {"ok": True, "url": "https://example.com/should-not-be-used"}
        
    with patch('app.routers.uploads.B2Storage') as mock_b2:
        mock_instance = mock_b2.return_value
        mock_instance.is_configured.return_value = True
        mock_instance.put_bytes_safe.side_effect = slow_put_bytes
        yield mock_instance

@pytest.mark.asyncio
async def test_save_cover_art_b2_success(temp_upload_dir, mock_b2_success, caplog):
    """Test successful cover art upload to B2 storage."""
    base_name = "test-cover"
    source = "test"
    
    result = await _save_cover_art(
        cover_bytes=TEST_COVER_ART,
        base_name=base_name,
        upload_dir=temp_upload_dir,
        source=source
    )
    
    # Verify B2 was called correctly
    mock_b2_success.put_bytes_safe.assert_called_once()
    args, _ = mock_b2_success.put_bytes_safe.call_args
    assert args[0] == "covers/test-cover-cover.jpg"
    assert args[1] == TEST_COVER_ART
    assert args[2] == "image/jpeg"
    
    # Verify the correct URL is returned
    assert result == "https://example.com/covers/test-cover.jpg"
    
    # Verify logs
    assert "Uploading cover art to B2 storage" in caplog.text
    assert "Cover art uploaded to B2" in caplog.text

@pytest.mark.asyncio
async def test_save_cover_art_b2_fallback_to_local(temp_upload_dir, mock_b2_failure, caplog):
    """Test fallback to local storage when B2 upload fails."""
    base_name = "test-fallback"
    source = "test"
    
    result = await _save_cover_art(
        cover_bytes=TEST_COVER_ART,
        base_name=base_name,
        upload_dir=temp_upload_dir,
        source=source
    )
    
    # Verify B2 was called and failed
    mock_b2_failure.put_bytes_safe.assert_called_once()
    
    # Verify local file was created
    local_files = list(Path(temp_upload_dir).glob("test-fallback-cover*.jpg"))
    assert len(local_files) == 1
    
    # Verify the local file URL is returned
    assert result.startswith("/uploads/test-fallback-cover")
    assert result.endswith(".jpg")
    
    # Verify logs
    assert "B2 cover upload failed" in caplog.text
    assert "Saving cover art locally" in caplog.text
    assert "Cover art saved locally" in caplog.text

@pytest.mark.asyncio
async def test_save_cover_art_b2_timeout_fallback(temp_upload_dir, mock_b2_timeout, caplog):
    """Test fallback when B2 upload times out."""
    base_name = "test-timeout"
    source = "test"
    
    # Set a short timeout to trigger the timeout quickly
    with patch.dict(os.environ, {"B2_PUT_TIMEOUT": "0.05"}):
        result = await _save_cover_art(
            cover_bytes=TEST_COVER_ART,
            base_name=base_name,
            upload_dir=temp_upload_dir,
            source=source
        )
    
    # Verify local fallback was used
    local_files = list(Path(temp_upload_dir).glob("test-timeout-cover*.jpg"))
    assert len(local_files) == 1
    assert result.startswith("/uploads/test-timeout-cover")
    
    # Verify logs
    assert "B2 cover upload timed out" in caplog.text

@pytest.mark.asyncio
async def test_save_cover_art_local_only(temp_upload_dir, caplog):
    """Test saving cover art directly to local storage when B2 is not configured."""
    with patch('app.routers.uploads.B2Storage') as mock_b2:
        mock_instance = mock_b2.return_value
        mock_instance.is_configured.return_value = False
        
        base_name = "test-local"
        source = "test"
        
        result = await _save_cover_art(
            cover_bytes=TEST_COVER_ART,
            base_name=base_name,
            upload_dir=temp_upload_dir,
            source=source
        )
        
        # Verify B2 was checked but not used
        mock_instance.put_bytes_safe.assert_not_called()
        
        # Verify local file was created
        local_files = list(Path(temp_upload_dir).glob("test-local-cover*.jpg"))
        assert len(local_files) == 1
        
        # Verify the local file URL is returned
        assert result.startswith("/uploads/test-local-cover")
        assert result.endswith(".jpg")
        
        # Verify logs
        assert "Saving cover art locally" in caplog.text
        assert "Cover art saved locally" in caplog.text

@pytest.mark.asyncio
async def test_save_cover_art_empty_bytes_local(temp_upload_dir, caplog):
    """Empty bytes should still be saved locally when B2 is not configured."""
    with patch('app.routers.uploads.B2Storage') as mock_b2:
        mock_instance = mock_b2.return_value
        mock_instance.is_configured.return_value = False
        
        result = await _save_cover_art(
            cover_bytes=b"",
            base_name="test-empty",
            upload_dir=temp_upload_dir,
            source="test"
        )
        
        # Verify B2 was checked but not used
        mock_instance.put_bytes_safe.assert_not_called()
        
        # Verify local file was created
        local_files = list(Path(temp_upload_dir).glob("test-empty-cover*.jpg"))
        assert len(local_files) == 1
        
        # Verify the local file URL is returned
        assert result.startswith("/uploads/test-empty-cover")
        assert result.endswith(".jpg")
        
        # Verify logs
        assert "Saving cover art locally" in caplog.text
