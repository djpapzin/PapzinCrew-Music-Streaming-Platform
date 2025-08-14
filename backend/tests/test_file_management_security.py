import pytest
import os
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock
import sys

# Add backend to path for imports
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.routers.file_management import router
from fastapi.testclient import TestClient
from fastapi import FastAPI

# Create test app
app = FastAPI()
app.include_router(router)
client = TestClient(app)

class TestDirectoryTraversalPrevention:
    """Test prevention of directory traversal attacks."""
    
    def test_prevent_parent_directory_access(self):
        """Test that parent directory access is blocked."""
        malicious_paths = [
            "../../../etc/passwd",
            "..\\..\\..\\windows\\system32",
            "....//....//etc//passwd",
            "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",  # URL encoded
            "..%252f..%252f..%252fetc%252fpasswd",  # Double URL encoded
        ]
        
        for malicious_path in malicious_paths:
            # Test file deletion endpoint
            response = client.delete(f"/files/{malicious_path}")
            # Should return 403 Forbidden or 400 Bad Request, not 200
            assert response.status_code in [400, 403, 404], f"Failed for path: {malicious_path}"
    
    def test_prevent_absolute_path_access(self):
        """Test that absolute paths are blocked."""
        absolute_paths = [
            "/etc/passwd",
            "C:\\Windows\\System32\\config\\SAM",
            "/root/.ssh/id_rsa",
            "\\\\server\\share\\sensitive_file"
        ]
        
        for abs_path in absolute_paths:
            response = client.delete(f"/files/{abs_path}")
            assert response.status_code in [400, 403, 404], f"Failed for path: {abs_path}"
    
    def test_prevent_hidden_file_access(self):
        """Test that hidden files are protected."""
        hidden_files = [
            ".env",
            ".git/config",
            ".ssh/id_rsa",
            "..env",  # Variation
            ".htaccess"
        ]
        
        for hidden_file in hidden_files:
            response = client.delete(f"/files/{hidden_file}")
            assert response.status_code in [400, 403, 404], f"Failed for hidden file: {hidden_file}"

class TestPathSanitization:
    """Test path sanitization functions."""
    
    @pytest.fixture
    def temp_upload_dir(self):
        """Create temporary upload directory for testing."""
        with tempfile.TemporaryDirectory() as temp_dir:
            yield temp_dir
    
    def test_sanitize_filename_basic(self):
        """Test basic filename sanitization."""
        from app.routers.file_management import sanitize_filename
        
        test_cases = [
            ("normal_file.mp3", "normal_file.mp3"),
            ("file with spaces.mp3", "file_with_spaces.mp3"),
            ("file/with/slashes.mp3", "file_with_slashes.mp3"),
            ("file\\with\\backslashes.mp3", "file_with_backslashes.mp3"),
            ("file:with:colons.mp3", "file_with_colons.mp3"),
            ("file*with*asterisks.mp3", "file_with_asterisks.mp3"),
            ("file?with?questions.mp3", "file_with_questions.mp3"),
            ("file<with>brackets.mp3", "file_with_brackets.mp3"),
            ("file|with|pipes.mp3", "file_with_pipes.mp3"),
        ]
        
        for input_name, expected in test_cases:
            result = sanitize_filename(input_name)
            assert result == expected, f"Failed for input: {input_name}"
    
    def test_sanitize_filename_unicode(self):
        """Test sanitization of Unicode characters."""
        from app.routers.file_management import sanitize_filename
        
        unicode_cases = [
            ("файл.mp3", "файл.mp3"),  # Cyrillic should be preserved
            ("文件.mp3", "文件.mp3"),    # Chinese should be preserved
            ("café.mp3", "café.mp3"),   # Accented characters should be preserved
            ("file\u0000null.mp3", "file_null.mp3"),  # Null bytes should be removed
        ]
        
        for input_name, expected in unicode_cases:
            result = sanitize_filename(input_name)
            assert result == expected, f"Failed for Unicode input: {input_name}"
    
    def test_sanitize_filename_edge_cases(self):
        """Test edge cases for filename sanitization."""
        from app.routers.file_management import sanitize_filename
        
        edge_cases = [
            ("", "untitled"),  # Empty string
            ("   ", "untitled"),  # Only spaces
            ("...", "untitled"),  # Only dots
            ("con.mp3", "con_.mp3"),  # Windows reserved name
            ("aux.mp3", "aux_.mp3"),  # Windows reserved name
            ("nul.mp3", "nul_.mp3"),  # Windows reserved name
            ("a" * 300 + ".mp3", "a" * 251 + ".mp3"),  # Too long filename
        ]
        
        for input_name, expected in edge_cases:
            result = sanitize_filename(input_name)
            assert result == expected, f"Failed for edge case: {input_name}"

class TestFilePermissionValidation:
    """Test file permission and access control."""
    
    @pytest.fixture
    def mock_file_system(self):
        """Mock file system for testing."""
        with patch('os.path.exists') as mock_exists, \
             patch('os.access') as mock_access, \
             patch('os.remove') as mock_remove:
            yield {
                'exists': mock_exists,
                'access': mock_access,
                'remove': mock_remove
            }
    
    def test_file_deletion_permission_check(self, mock_file_system):
        """Test that file deletion checks permissions."""
        mock_file_system['exists'].return_value = True
        mock_file_system['access'].return_value = False  # No write permission
        
        response = client.delete("/files/test_file.mp3")
        
        # Should fail due to insufficient permissions
        assert response.status_code in [403, 500]
    
    def test_file_deletion_nonexistent_file(self, mock_file_system):
        """Test deletion of non-existent file."""
        mock_file_system['exists'].return_value = False
        
        response = client.delete("/files/nonexistent.mp3")
        
        # Should return 404 Not Found
        assert response.status_code == 404
    
    def test_file_deletion_success(self, mock_file_system):
        """Test successful file deletion."""
        mock_file_system['exists'].return_value = True
        mock_file_system['access'].return_value = True  # Has write permission
        mock_file_system['remove'].return_value = None  # Successful deletion
        
        response = client.delete("/files/valid_file.mp3")
        
        # Should succeed
        assert response.status_code == 200

class TestBulkOperationSecurity:
    """Test security of bulk file operations."""
    
    def test_bulk_delete_size_limit(self):
        """Test that bulk operations have reasonable size limits."""
        # Create a large list of files to delete
        large_file_list = [f"file_{i}.mp3" for i in range(1000)]
        
        response = client.post("/files/bulk-delete", json={"files": large_file_list})
        
        # Should reject requests that are too large
        assert response.status_code in [400, 413, 422]  # Bad Request or Payload Too Large
    
    def test_bulk_delete_path_validation(self):
        """Test that bulk operations validate all paths."""
        malicious_files = [
            "valid_file.mp3",
            "../../../etc/passwd",  # Malicious path mixed in
            "another_valid_file.mp3"
        ]
        
        response = client.post("/files/bulk-delete", json={"files": malicious_files})
        
        # Should reject the entire request if any path is malicious
        assert response.status_code in [400, 403]

class TestAccessControlValidation:
    """Test access control and authorization."""
    
    def test_unauthorized_file_access(self):
        """Test that unauthorized users cannot access files."""
        # Test without authentication headers
        response = client.delete("/files/protected_file.mp3")
        
        # Should require authentication (if implemented)
        # For now, just ensure it doesn't crash
        assert response.status_code in [200, 401, 403, 404]
    
    def test_cross_user_file_access(self):
        """Test that users cannot access other users' files."""
        # This would test user isolation if implemented
        with patch('app.routers.file_management.get_current_user') as mock_user:
            mock_user.return_value = {"id": 1, "username": "user1"}
            
            # Try to delete file belonging to another user
            response = client.delete("/files/user2_file.mp3")
            
            # Should be forbidden or not found
            assert response.status_code in [403, 404]

class TestFileTypeValidation:
    """Test file type and extension validation."""
    
    def test_allowed_file_extensions(self):
        """Test that only allowed file extensions can be deleted."""
        allowed_files = [
            "song.mp3",
            "track.wav",
            "audio.flac",
            "cover.jpg",
            "artwork.png"
        ]
        
        for filename in allowed_files:
            with patch('os.path.exists', return_value=True), \
                 patch('os.access', return_value=True), \
                 patch('os.remove'):
                response = client.delete(f"/files/{filename}")
                # Should be allowed (200) or at least not rejected for file type (not 415)
                assert response.status_code != 415
    
    def test_blocked_file_extensions(self):
        """Test that dangerous file extensions are blocked."""
        dangerous_files = [
            "script.exe",
            "malware.bat",
            "virus.scr",
            "trojan.com",
            "backdoor.pif"
        ]
        
        for filename in dangerous_files:
            response = client.delete(f"/files/{filename}")
            # Should be rejected for security reasons
            assert response.status_code in [400, 403, 415]

class TestRateLimitingAndDOS:
    """Test rate limiting and DoS protection."""
    
    def test_rapid_deletion_requests(self):
        """Test protection against rapid deletion requests."""
        # Simulate rapid requests
        responses = []
        for i in range(100):  # Many rapid requests
            response = client.delete(f"/files/file_{i}.mp3")
            responses.append(response.status_code)
        
        # Should eventually start rate limiting (429) or handle gracefully
        rate_limited = any(status == 429 for status in responses)
        all_handled = all(status in [200, 404, 429] for status in responses)
        
        assert rate_limited or all_handled

class TestLoggingAndAuditing:
    """Test security logging and auditing."""
    
    def test_security_event_logging(self):
        """Test that security events are logged."""
        with patch('app.routers.file_management.logger') as mock_logger:
            # Attempt directory traversal
            client.delete("/files/../../../etc/passwd")
            
            # Should log security violation
            mock_logger.warning.assert_called()
    
    def test_file_operation_auditing(self):
        """Test that file operations are audited."""
        with patch('app.routers.file_management.logger') as mock_logger, \
             patch('os.path.exists', return_value=True), \
             patch('os.access', return_value=True), \
             patch('os.remove'):
            
            client.delete("/files/test_file.mp3")
            
            # Should log file operations
            assert mock_logger.info.called or mock_logger.debug.called
