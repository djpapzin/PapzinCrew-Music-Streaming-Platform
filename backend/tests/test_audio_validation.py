import pytest
import io
from pathlib import Path
import sys
from unittest.mock import patch, MagicMock

# Add backend to path for imports
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.routers.uploads import validate_audio_file

# Sample audio file headers for testing
MP3_HEADER = b'\xff\xfb\x90\x00'  # MP3 header
WAV_HEADER = b'RIFF\x24\x08\x00\x00WAVEfmt '  # WAV header
FLAC_HEADER = b'fLaC'  # FLAC header
INVALID_HEADER = b'\x00\x01\x02\x03'  # Invalid audio header

class TestAudioValidation:
    """Test audio file validation functionality."""
    
    @pytest.fixture
    def mock_mp3_file(self):
        """Create a mock MP3 file."""
        content = MP3_HEADER + b'\x00' * 1000  # MP3 header + dummy data
        return io.BytesIO(content)
    
    @pytest.fixture
    def mock_wav_file(self):
        """Create a mock WAV file."""
        content = WAV_HEADER + b'\x00' * 1000  # WAV header + dummy data
        return io.BytesIO(content)
    
    @pytest.fixture
    def mock_invalid_file(self):
        """Create a mock invalid file."""
        content = INVALID_HEADER + b'\x00' * 1000
        return io.BytesIO(content)
    
    @pytest.fixture
    def mock_empty_file(self):
        """Create a mock empty file."""
        return io.BytesIO(b'')
    
    def test_validate_mp3_success(self, mock_mp3_file):
        """Test successful MP3 validation."""
        with patch('mutagen.File') as mock_mutagen:
            # Mock mutagen to return MP3 metadata
            mock_audio = MagicMock()
            mock_audio.info.length = 180.5
            mock_audio.info.bitrate = 320
            mock_audio.mime = ['audio/mpeg']
            mock_mutagen.return_value = mock_audio
            
            is_valid, result = validate_audio_file(mock_mp3_file, "test.mp3")
            
            assert is_valid is True
            assert result['valid'] is True
            assert result['mime_type'] == 'audio/mpeg'
            assert result['file_extension'] == '.mp3'
            assert 'duration_seconds' in result
            assert 'quality_kbps' in result
    
    def test_validate_wav_success(self, mock_wav_file):
        """Test successful WAV validation."""
        with patch('mutagen.File') as mock_mutagen:
            # Mock mutagen to return WAV metadata
            mock_audio = MagicMock()
            mock_audio.info.length = 240.0
            mock_audio.info.bitrate = 1411  # CD quality
            mock_audio.mime = ['audio/wav']
            mock_mutagen.return_value = mock_audio
            
            is_valid, result = validate_audio_file(mock_wav_file, "test.wav")
            
            assert is_valid is True
            assert result['valid'] is True
            assert result['mime_type'] == 'audio/wav'
            assert result['file_extension'] == '.wav'
    
    def test_validate_empty_file(self, mock_empty_file):
        """Test validation of empty file."""
        is_valid, result = validate_audio_file(mock_empty_file, "empty.mp3")
        
        assert is_valid is False
        assert result['valid'] is False
        assert 'error' in result
        assert 'empty' in result['error'].lower()
    
    def test_validate_invalid_audio_format(self, mock_invalid_file):
        """Test validation of invalid audio format."""
        with patch('mutagen.File') as mock_mutagen:
            # Mock mutagen to return None (invalid format)
            mock_mutagen.return_value = None
            
            is_valid, result = validate_audio_file(mock_invalid_file, "invalid.txt")
            
            assert is_valid is False
            assert result['valid'] is False
            assert 'error' in result
    
    def test_validate_corrupted_audio(self, mock_mp3_file):
        """Test validation of corrupted audio file."""
        with patch('mutagen.File') as mock_mutagen:
            # Mock mutagen to raise an exception (corrupted file)
            mock_mutagen.side_effect = Exception("File is corrupted")
            
            is_valid, result = validate_audio_file(mock_mp3_file, "corrupted.mp3")
            
            assert is_valid is False
            assert result['valid'] is False
            assert 'error' in result
    
    def test_validate_large_file(self):
        """Test validation of very large file."""
        # Create a mock file that's too large
        large_content = b'\xff\xfb\x90\x00' + b'\x00' * (100 * 1024 * 1024)  # 100MB
        large_file = io.BytesIO(large_content)
        
        with patch('mutagen.File') as mock_mutagen:
            mock_audio = MagicMock()
            mock_audio.info.length = 3600  # 1 hour
            mock_audio.info.bitrate = 320
            mock_audio.mime = ['audio/mpeg']
            mock_mutagen.return_value = mock_audio
            
            is_valid, result = validate_audio_file(large_file, "large.mp3")
            
            # Should handle large files gracefully
            assert 'file_size_bytes' in result
            assert result['file_size_bytes'] > 50 * 1024 * 1024  # > 50MB
    
    def test_validate_unsupported_extension(self, mock_mp3_file):
        """Test validation with unsupported file extension."""
        with patch('mutagen.File') as mock_mutagen:
            mock_mutagen.return_value = None
            
            is_valid, result = validate_audio_file(mock_mp3_file, "test.xyz")
            
            assert is_valid is False
            assert result['valid'] is False
            assert result['file_extension'] == '.xyz'
    
    def test_validate_metadata_extraction(self, mock_mp3_file):
        """Test metadata extraction from audio file."""
        with patch('mutagen.File') as mock_mutagen:
            # Mock rich metadata
            mock_audio = MagicMock()
            mock_audio.info.length = 180.5
            mock_audio.info.bitrate = 320
            mock_audio.mime = ['audio/mpeg']
            
            # Mock tags
            mock_audio.tags = {
                'TIT2': ['Test Title'],  # Title
                'TPE1': ['Test Artist'],  # Artist
                'TALB': ['Test Album'],   # Album
                'TCON': ['Electronic'],   # Genre
                'TDRC': ['2024']          # Year
            }
            mock_mutagen.return_value = mock_audio
            
            is_valid, result = validate_audio_file(mock_mp3_file, "test.mp3")
            
            assert is_valid is True
            assert result['valid'] is True
            # Metadata should be extracted if the function supports it
            assert 'duration_seconds' in result
            assert 'quality_kbps' in result
    
    def test_validate_file_size_calculation(self, mock_mp3_file):
        """Test accurate file size calculation."""
        with patch('mutagen.File') as mock_mutagen:
            mock_audio = MagicMock()
            mock_audio.info.length = 180
            mock_audio.info.bitrate = 320
            mock_audio.mime = ['audio/mpeg']
            mock_mutagen.return_value = mock_audio
            
            is_valid, result = validate_audio_file(mock_mp3_file, "test.mp3")
            
            assert is_valid is True
            assert 'file_size_bytes' in result
            assert result['file_size_bytes'] > 0
            
            # File size should be reasonable for the mock data
            expected_size = len(MP3_HEADER + b'\x00' * 1000)
            assert result['file_size_bytes'] == expected_size

class TestAudioMetadataExtraction:
    """Test audio metadata extraction edge cases."""
    
    def test_extract_metadata_missing_tags(self):
        """Test metadata extraction when tags are missing."""
        mock_file = io.BytesIO(MP3_HEADER + b'\x00' * 1000)
        
        with patch('mutagen.File') as mock_mutagen:
            mock_audio = MagicMock()
            mock_audio.info.length = 180
            mock_audio.info.bitrate = 320
            mock_audio.mime = ['audio/mpeg']
            mock_audio.tags = None  # No tags
            mock_mutagen.return_value = mock_audio
            
            is_valid, result = validate_audio_file(mock_file, "notags.mp3")
            
            assert is_valid is True
            assert result['valid'] is True
    
    def test_extract_metadata_unicode_tags(self):
        """Test metadata extraction with Unicode characters."""
        mock_file = io.BytesIO(MP3_HEADER + b'\x00' * 1000)
        
        with patch('mutagen.File') as mock_mutagen:
            mock_audio = MagicMock()
            mock_audio.info.length = 180
            mock_audio.info.bitrate = 320
            mock_audio.mime = ['audio/mpeg']
            
            # Unicode metadata
            mock_audio.tags = {
                'TIT2': ['测试标题'],  # Chinese title
                'TPE1': ['Артист'],   # Cyrillic artist
                'TALB': ['Álbum']     # Accented album
            }
            mock_mutagen.return_value = mock_audio
            
            is_valid, result = validate_audio_file(mock_file, "unicode.mp3")
            
            assert is_valid is True
            assert result['valid'] is True
    
    def test_extract_metadata_malformed_tags(self):
        """Test handling of malformed metadata tags."""
        mock_file = io.BytesIO(MP3_HEADER + b'\x00' * 1000)
        
        with patch('mutagen.File') as mock_mutagen:
            mock_audio = MagicMock()
            mock_audio.info.length = 180
            mock_audio.info.bitrate = 320
            mock_audio.mime = ['audio/mpeg']
            
            # Malformed tags that might cause issues
            mock_audio.tags = {
                'TIT2': [],  # Empty list
                'TPE1': [None],  # None value
                'TALB': ['']  # Empty string
            }
            mock_mutagen.return_value = mock_audio
            
            is_valid, result = validate_audio_file(mock_file, "malformed.mp3")
            
            # Should handle malformed tags gracefully
            assert is_valid is True
            assert result['valid'] is True
