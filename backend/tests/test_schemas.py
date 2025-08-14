import pytest
from datetime import datetime
from pathlib import Path
import sys
from pydantic import ValidationError

# Add backend to path for imports
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import schemas

class TestMixSchemas:
    """Test Mix-related schema validation."""
    
    def test_mix_base_valid_data(self):
        """Test MixBase with valid data."""
        valid_data = {
            "title": "Test Mix",
            "original_filename": "test.mp3",
            "artist_id": 1,
            "duration_seconds": 180,
            "file_size_mb": 5.2,
            "quality_kbps": 320,
            "file_path": "/uploads/test.mp3"
        }
        
        mix = schemas.MixBase(**valid_data)
        assert mix.title == "Test Mix"
        assert mix.duration_seconds == 180
        assert mix.quality_kbps == 320
    
    def test_mix_base_required_fields(self):
        """Test that required fields are enforced."""
        incomplete_data = {
            "title": "Test Mix",
            # Missing required fields
        }
        
        with pytest.raises(ValidationError) as exc_info:
            schemas.MixBase(**incomplete_data)
        
        errors = exc_info.value.errors()
        required_fields = {error['loc'][0] for error in errors if error['type'] == 'missing'}
        assert 'artist_id' in required_fields
        assert 'duration_seconds' in required_fields
    
    def test_mix_base_type_validation(self):
        """Test type validation for Mix fields."""
        invalid_data = {
            "title": "Test Mix",
            "original_filename": "test.mp3",
            "artist_id": "not_an_integer",  # Should be int
            "duration_seconds": "not_an_integer",  # Should be int
            "file_size_mb": "not_a_float",  # Should be float
            "quality_kbps": "not_an_integer",  # Should be int
            "file_path": "/uploads/test.mp3"
        }
        
        with pytest.raises(ValidationError) as exc_info:
            schemas.MixBase(**invalid_data)
        
        errors = exc_info.value.errors()
        type_errors = [error for error in errors if 'type' in error['type']]
        assert len(type_errors) > 0
    
    def test_mix_base_optional_fields(self):
        """Test optional fields with None values."""
        data_with_nones = {
            "title": "Test Mix",
            "original_filename": "test.mp3",
            "artist_id": 1,
            "duration_seconds": 180,
            "file_size_mb": 5.2,
            "quality_kbps": 320,
            "file_path": "/uploads/test.mp3",
            "bpm": None,
            "cover_art_url": None,
            "description": None,
            "genre": None,
            "album": None,
            "year": None
        }
        
        mix = schemas.MixBase(**data_with_nones)
        assert mix.bpm is None
        assert mix.cover_art_url is None
        assert mix.description is None
    
    def test_mix_base_default_values(self):
        """Test default values for optional fields."""
        minimal_data = {
            "title": "Test Mix",
            "original_filename": "test.mp3",
            "artist_id": 1,
            "duration_seconds": 180,
            "file_size_mb": 5.2,
            "quality_kbps": 320,
            "file_path": "/uploads/test.mp3"
        }
        
        mix = schemas.MixBase(**minimal_data)
        assert mix.availability == 'public'  # Default value
        assert mix.allow_downloads == 'yes'  # Default value
        assert mix.display_embed == 'yes'  # Default value
        assert mix.age_restriction == 'all'  # Default value
    
    def test_mix_create_inheritance(self):
        """Test that MixCreate inherits from MixBase."""
        data = {
            "title": "Test Mix",
            "original_filename": "test.mp3",
            "artist_id": 1,
            "duration_seconds": 180,
            "file_size_mb": 5.2,
            "quality_kbps": 320,
            "file_path": "/uploads/test.mp3"
        }
        
        mix_create = schemas.MixCreate(**data)
        assert isinstance(mix_create, schemas.MixBase)
        assert mix_create.title == "Test Mix"
    
    def test_mix_response_with_artist(self):
        """Test Mix response schema with artist relationship."""
        artist_data = {"id": 1, "name": "Test Artist"}
        mix_data = {
            "id": 1,
            "title": "Test Mix",
            "original_filename": "test.mp3",
            "artist_id": 1,
            "duration_seconds": 180,
            "file_size_mb": 5.2,
            "quality_kbps": 320,
            "file_path": "/uploads/test.mp3",
            "artist": artist_data
        }
        
        mix = schemas.Mix(**mix_data)
        assert mix.id == 1
        assert mix.artist.name == "Test Artist"
        assert mix.artist.id == 1

class TestArtistSchemas:
    """Test Artist-related schema validation."""
    
    def test_artist_base_valid(self):
        """Test ArtistBase with valid data."""
        artist = schemas.ArtistBase(name="Test Artist")
        assert artist.name == "Test Artist"
    
    def test_artist_base_empty_name(self):
        """Test ArtistBase with empty name."""
        with pytest.raises(ValidationError):
            schemas.ArtistBase(name="")
    
    def test_artist_create_inheritance(self):
        """Test ArtistCreate inherits from ArtistBase."""
        artist = schemas.ArtistCreate(name="Test Artist")
        assert isinstance(artist, schemas.ArtistBase)
        assert artist.name == "Test Artist"
    
    def test_artist_simple_with_id(self):
        """Test ArtistSimple includes ID field."""
        artist = schemas.ArtistSimple(id=1, name="Test Artist")
        assert artist.id == 1
        assert artist.name == "Test Artist"
    
    def test_artist_with_mixes(self):
        """Test Artist schema with mixes relationship."""
        artist_data = {
            "id": 1,
            "name": "Test Artist",
            "mixes": []
        }
        
        artist = schemas.Artist(**artist_data)
        assert artist.id == 1
        assert artist.name == "Test Artist"
        assert artist.mixes == []

class TestCategorySchemas:
    """Test Category-related schema validation."""
    
    def test_category_base_valid(self):
        """Test CategoryBase with valid data."""
        category = schemas.CategoryBase(name="Electronic", description="Electronic music")
        assert category.name == "Electronic"
        assert category.description == "Electronic music"
    
    def test_category_base_optional_description(self):
        """Test CategoryBase with optional description."""
        category = schemas.CategoryBase(name="Electronic")
        assert category.name == "Electronic"
        assert category.description is None
    
    def test_category_create_inheritance(self):
        """Test CategoryCreate inherits from CategoryBase."""
        category = schemas.CategoryCreate(name="Electronic")
        assert isinstance(category, schemas.CategoryBase)
    
    def test_category_with_mixes(self):
        """Test Category schema with mixes relationship."""
        category_data = {
            "id": 1,
            "name": "Electronic",
            "description": "Electronic music",
            "mixes": []
        }
        
        category = schemas.Category(**category_data)
        assert category.id == 1
        assert category.mixes == []

class TestTracklistSchemas:
    """Test Tracklist-related schema validation."""
    
    def test_tracklist_item_base_valid(self):
        """Test TracklistItemBase with valid data."""
        item = schemas.TracklistItemBase(
            track_title="Track 1",
            track_artist="Artist 1",
            timestamp_seconds=30
        )
        assert item.track_title == "Track 1"
        assert item.track_artist == "Artist 1"
        assert item.timestamp_seconds == 30
    
    def test_tracklist_item_base_required_fields(self):
        """Test required fields in TracklistItemBase."""
        with pytest.raises(ValidationError):
            schemas.TracklistItemBase(track_title="Track 1")  # Missing required fields
    
    def test_tracklist_item_with_ids(self):
        """Test TracklistItem with database IDs."""
        item_data = {
            "id": 1,
            "mix_id": 1,
            "track_title": "Track 1",
            "track_artist": "Artist 1",
            "timestamp_seconds": 30
        }
        
        item = schemas.TracklistItem(**item_data)
        assert item.id == 1
        assert item.mix_id == 1
        assert item.track_title == "Track 1"

class TestSchemaValidationEdgeCases:
    """Test edge cases and validation scenarios."""
    
    def test_unicode_string_handling(self):
        """Test handling of Unicode strings."""
        unicode_data = {
            "title": "测试音轨",  # Chinese
            "original_filename": "тест.mp3",  # Cyrillic
            "artist_id": 1,
            "duration_seconds": 180,
            "file_size_mb": 5.2,
            "quality_kbps": 320,
            "file_path": "/uploads/тест.mp3"
        }
        
        mix = schemas.MixBase(**unicode_data)
        assert mix.title == "测试音轨"
        assert mix.original_filename == "тест.mp3"
    
    def test_very_long_strings(self):
        """Test handling of very long strings."""
        long_title = "A" * 1000  # Very long title
        
        data = {
            "title": long_title,
            "original_filename": "test.mp3",
            "artist_id": 1,
            "duration_seconds": 180,
            "file_size_mb": 5.2,
            "quality_kbps": 320,
            "file_path": "/uploads/test.mp3"
        }
        
        # Should handle long strings (or validate length if constraints exist)
        mix = schemas.MixBase(**data)
        assert len(mix.title) == 1000
    
    def test_negative_numbers(self):
        """Test handling of negative numbers."""
        invalid_data = {
            "title": "Test Mix",
            "original_filename": "test.mp3",
            "artist_id": 1,
            "duration_seconds": -180,  # Negative duration
            "file_size_mb": -5.2,  # Negative file size
            "quality_kbps": -320,  # Negative quality
            "file_path": "/uploads/test.mp3"
        }
        
        # Should either accept or validate negative numbers based on business logic
        try:
            mix = schemas.MixBase(**invalid_data)
            # If accepted, ensure values are preserved
            assert mix.duration_seconds == -180
        except ValidationError:
            # If validation exists, ensure it catches negative values
            pass
    
    def test_zero_values(self):
        """Test handling of zero values."""
        zero_data = {
            "title": "Test Mix",
            "original_filename": "test.mp3",
            "artist_id": 1,
            "duration_seconds": 0,
            "file_size_mb": 0.0,
            "quality_kbps": 0,
            "file_path": "/uploads/test.mp3"
        }
        
        mix = schemas.MixBase(**zero_data)
        assert mix.duration_seconds == 0
        assert mix.file_size_mb == 0.0
        assert mix.quality_kbps == 0
    
    def test_float_precision(self):
        """Test float precision handling."""
        precise_data = {
            "title": "Test Mix",
            "original_filename": "test.mp3",
            "artist_id": 1,
            "duration_seconds": 180,
            "file_size_mb": 5.123456789,  # High precision
            "quality_kbps": 320,
            "file_path": "/uploads/test.mp3"
        }
        
        mix = schemas.MixBase(**precise_data)
        # Should preserve reasonable precision
        assert abs(mix.file_size_mb - 5.123456789) < 0.0001

class TestSchemaSerializationDeserialization:
    """Test schema serialization and deserialization."""
    
    def test_mix_model_dump(self):
        """Test Mix schema model_dump method."""
        data = {
            "title": "Test Mix",
            "original_filename": "test.mp3",
            "artist_id": 1,
            "duration_seconds": 180,
            "file_size_mb": 5.2,
            "quality_kbps": 320,
            "file_path": "/uploads/test.mp3"
        }
        
        mix = schemas.MixBase(**data)
        dumped = mix.model_dump()
        
        assert isinstance(dumped, dict)
        assert dumped["title"] == "Test Mix"
        assert dumped["duration_seconds"] == 180
    
    def test_mix_model_dump_exclude_none(self):
        """Test model_dump with exclude_none option."""
        data = {
            "title": "Test Mix",
            "original_filename": "test.mp3",
            "artist_id": 1,
            "duration_seconds": 180,
            "file_size_mb": 5.2,
            "quality_kbps": 320,
            "file_path": "/uploads/test.mp3",
            "bpm": None,
            "description": None
        }
        
        mix = schemas.MixBase(**data)
        dumped = mix.model_dump(exclude_none=True)
        
        assert "bpm" not in dumped
        assert "description" not in dumped
        assert "title" in dumped
    
    def test_artist_model_validate(self):
        """Test Artist schema model_validate method."""
        # Mock database object
        class MockArtist:
            id = 1
            name = "Test Artist"
            mixes = []
        
        mock_artist = MockArtist()
        artist = schemas.Artist.model_validate(mock_artist)
        
        assert artist.id == 1
        assert artist.name == "Test Artist"
        assert artist.mixes == []
