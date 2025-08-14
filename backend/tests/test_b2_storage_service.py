import pytest
import os
from unittest.mock import patch, MagicMock
from pathlib import Path
import sys

# Add backend to path for imports
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.b2_storage import B2Storage

class TestB2StorageConfiguration:
    """Test B2Storage configuration and initialization."""
    
    def test_is_configured_with_all_env_vars(self):
        """Test B2 is considered configured when all env vars are present."""
        with patch.dict(os.environ, {
            'B2_APPLICATION_KEY_ID': 'test_key_id',
            'B2_APPLICATION_KEY': 'test_key',
            'B2_BUCKET_NAME': 'test_bucket'
        }):
            b2 = B2Storage()
            assert b2.is_configured() is True
    
    def test_is_configured_missing_key_id(self):
        """Test B2 is not configured when key ID is missing."""
        with patch.dict(os.environ, {
            'B2_APPLICATION_KEY': 'test_key',
            'B2_BUCKET_NAME': 'test_bucket'
        }, clear=True):
            b2 = B2Storage()
            assert b2.is_configured() is False
    
    def test_put_bytes_safe_success(self):
        """Test successful file upload."""
        with patch.dict(os.environ, {
            'B2_APPLICATION_KEY_ID': 'test_key_id',
            'B2_APPLICATION_KEY': 'test_key',
            'B2_BUCKET_NAME': 'test_bucket'
        }):
            b2 = B2Storage()
            test_data = b'test file content'
            test_key = 'test/file.txt'
            
            with patch('app.services.b2_storage.B2Api') as mock_b2_api:
                # Mock successful upload
                mock_api_instance = MagicMock()
                mock_b2_api.return_value = mock_api_instance
                
                mock_bucket = MagicMock()
                mock_api_instance.get_bucket_by_name.return_value = mock_bucket
                
                mock_file_info = MagicMock()
                mock_file_info.id_ = 'file_id_123'
                mock_bucket.upload_bytes.return_value = mock_file_info
                
                with patch.object(b2, '_generate_public_url', return_value='https://example.com/file.txt'):
                    result = b2.put_bytes_safe(test_key, test_data, 'text/plain')
                
                assert result['ok'] is True
                assert result['url'] == 'https://example.com/file.txt'
    
    def test_put_bytes_safe_auth_failure(self):
        """Test handling of authentication failure."""
        with patch.dict(os.environ, {
            'B2_APPLICATION_KEY_ID': 'test_key_id',
            'B2_APPLICATION_KEY': 'test_key',
            'B2_BUCKET_NAME': 'test_bucket'
        }):
            b2 = B2Storage()
            
            with patch('app.services.b2_storage.B2Api') as mock_b2_api:
                mock_api_instance = MagicMock()
                mock_b2_api.return_value = mock_api_instance
                
                # Mock auth failure
                mock_api_instance.authorize_account.side_effect = Exception("Unauthorized")
                
                result = b2.put_bytes_safe('test/file.txt', b'data', 'text/plain')
                
                assert result['ok'] is False
                assert 'error_code' in result
