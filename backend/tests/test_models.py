import pytest
from datetime import datetime, timezone
from pathlib import Path
import sys
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError

# Add backend to path for imports
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.models import models
from app.models.models import Base

# Create in-memory test database
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})

# Enable foreign key constraints for test SQLite
@event.listens_for(test_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture
def db_session():
    """Create a fresh database session for each test."""
    Base.metadata.create_all(bind=test_engine)
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)

class TestMixModel:
    """Test Mix database model."""
    
    def test_mix_creation(self, db_session):
        """Test creating a Mix record."""
        # Create artist first
        artist = models.Artist(name="Test Artist")
        db_session.add(artist)
        db_session.commit()
        
        # Create mix
        mix = models.Mix(
            title="Test Mix",
            original_filename="test.mp3",
            duration_seconds=180,
            file_path="/uploads/test.mp3",
            file_size_mb=5.2,
            quality_kbps=320,
            artist_id=artist.id
        )
        
        db_session.add(mix)
        db_session.commit()
        
        assert mix.id is not None
        assert mix.title == "Test Mix"
        assert mix.artist_id == artist.id
        assert mix.release_date is not None
    
    def test_mix_default_values(self, db_session):
        """Test Mix model default values."""
        artist = models.Artist(name="Test Artist")
        db_session.add(artist)
        db_session.commit()
        
        mix = models.Mix(
            title="Test Mix",
            duration_seconds=180,
            file_path="/uploads/test.mp3",
            file_size_mb=5.2,
            quality_kbps=320,
            artist_id=artist.id
        )
        
        db_session.add(mix)
        db_session.commit()
        
        # Check default values
        assert mix.availability == 'public'
        assert mix.allow_downloads == 'yes'
        assert mix.display_embed == 'yes'
        assert mix.age_restriction == 'all'
        assert isinstance(mix.release_date, datetime)
    
    def test_mix_unique_file_path_constraint(self, db_session):
        """Test that file_path must be unique."""
        artist = models.Artist(name="Test Artist")
        db_session.add(artist)
        db_session.commit()
        
        # Create first mix
        mix1 = models.Mix(
            title="Mix 1",
            duration_seconds=180,
            file_path="/uploads/unique.mp3",
            file_size_mb=5.2,
            quality_kbps=320,
            artist_id=artist.id
        )
        db_session.add(mix1)
        db_session.commit()
        
        # Try to create second mix with same file_path
        mix2 = models.Mix(
            title="Mix 2",
            duration_seconds=240,
            file_path="/uploads/unique.mp3",  # Same path
            file_size_mb=6.0,
            quality_kbps=320,
            artist_id=artist.id
        )
        
        db_session.add(mix2)
        with pytest.raises(IntegrityError):
            db_session.commit()
    
    def test_mix_artist_relationship(self, db_session):
        """Test Mix-Artist relationship."""
        artist = models.Artist(name="Test Artist")
        db_session.add(artist)
        db_session.commit()
        
        mix = models.Mix(
            title="Test Mix",
            duration_seconds=180,
            file_path="/uploads/test.mp3",
            file_size_mb=5.2,
            quality_kbps=320,
            artist_id=artist.id
        )
        
        db_session.add(mix)
        db_session.commit()
        
        # Test relationship
        assert mix.artist.name == "Test Artist"
        assert mix in artist.mixes
    
    def test_mix_foreign_key_constraint(self, db_session):
        """Test that artist_id must reference valid artist."""
        mix = models.Mix(
            title="Test Mix",
            duration_seconds=180,
            file_path="/uploads/test.mp3",
            file_size_mb=5.2,
            quality_kbps=320,
            artist_id=999  # Non-existent artist
        )

        db_session.add(mix)
        with pytest.raises(IntegrityError):
            db_session.commit()
            db_session.flush()  # Force constraint check
    
    def test_mix_timezone_aware_datetime(self, db_session):
        """Test that release_date uses timezone-aware datetime."""
        artist = models.Artist(name="Test Artist")
        db_session.add(artist)
        db_session.commit()
        
        mix = models.Mix(
            title="Test Mix",
            duration_seconds=180,
            file_path="/uploads/test.mp3",
            file_size_mb=5.2,
            quality_kbps=320,
            artist_id=artist.id
        )
        
        db_session.add(mix)
        db_session.commit()
        
        # Check that release_date is timezone-aware
        assert mix.release_date.tzinfo is not None
        assert mix.release_date.tzinfo == timezone.utc

class TestArtistModel:
    """Test Artist database model."""
    
    def test_artist_creation(self, db_session):
        """Test creating an Artist record."""
        artist = models.Artist(name="Test Artist")
        
        db_session.add(artist)
        db_session.commit()
        
        assert artist.id is not None
        assert artist.name == "Test Artist"
    
    def test_artist_mixes_relationship(self, db_session):
        """Test Artist-Mixes relationship."""
        artist = models.Artist(name="Test Artist")
        db_session.add(artist)
        db_session.commit()
        
        # Create multiple mixes for the artist
        mix1 = models.Mix(
            title="Mix 1",
            duration_seconds=180,
            file_path="/uploads/mix1.mp3",
            file_size_mb=5.2,
            quality_kbps=320,
            artist_id=artist.id
        )
        
        mix2 = models.Mix(
            title="Mix 2",
            duration_seconds=240,
            file_path="/uploads/mix2.mp3",
            file_size_mb=6.0,
            quality_kbps=320,
            artist_id=artist.id
        )
        
        db_session.add_all([mix1, mix2])
        db_session.commit()
        
        # Test relationship
        assert len(artist.mixes) == 2
        assert mix1 in artist.mixes
        assert mix2 in artist.mixes
    
    def test_artist_name_not_null(self, db_session):
        """Test that artist name cannot be null."""
        artist = models.Artist(name=None)
        
        db_session.add(artist)
        with pytest.raises(IntegrityError):
            db_session.commit()

class TestCategoryModel:
    """Test Category database model."""
    
    def test_category_creation(self, db_session):
        """Test creating a Category record."""
        category = models.Category(
            name="Electronic",
            description="Electronic music category"
        )
        
        db_session.add(category)
        db_session.commit()
        
        assert category.id is not None
        assert category.name == "Electronic"
        assert category.description == "Electronic music category"
    
    def test_category_optional_description(self, db_session):
        """Test that category description is optional."""
        category = models.Category(name="Rock")
        
        db_session.add(category)
        db_session.commit()
        
        assert category.id is not None
        assert category.name == "Rock"
        assert category.description is None

class TestTracklistItemModel:
    """Test TracklistItem database model."""
    
    def test_tracklist_item_creation(self, db_session):
        """Test creating a TracklistItem record."""
        # Create artist and mix first
        artist = models.Artist(name="Test Artist")
        db_session.add(artist)
        db_session.commit()
        
        mix = models.Mix(
            title="Test Mix",
            duration_seconds=180,
            file_path="/uploads/test.mp3",
            file_size_mb=5.2,
            quality_kbps=320,
            artist_id=artist.id
        )
        db_session.add(mix)
        db_session.commit()
        
        # Create tracklist item
        tracklist_item = models.TracklistItem(
            track_title="Track 1",
            track_artist="Artist 1",
            timestamp_seconds=30,
            mix_id=mix.id
        )
        
        db_session.add(tracklist_item)
        db_session.commit()
        
        assert tracklist_item.id is not None
        assert tracklist_item.track_title == "Track 1"
        assert tracklist_item.mix_id == mix.id
    
    def test_tracklist_item_mix_relationship(self, db_session):
        """Test TracklistItem-Mix relationship."""
        artist = models.Artist(name="Test Artist")
        db_session.add(artist)
        db_session.commit()
        
        mix = models.Mix(
            title="Test Mix",
            duration_seconds=180,
            file_path="/uploads/test.mp3",
            file_size_mb=5.2,
            quality_kbps=320,
            artist_id=artist.id
        )
        db_session.add(mix)
        db_session.commit()
        
        tracklist_item = models.TracklistItem(
            track_title="Track 1",
            track_artist="Artist 1",
            timestamp_seconds=30,
            mix_id=mix.id
        )
        
        db_session.add(tracklist_item)
        db_session.commit()
        
        # Test relationships
        assert tracklist_item.mix.title == "Test Mix"
        assert tracklist_item in mix.tracklist_items
    
    def test_tracklist_item_cascade_delete(self, db_session):
        """Test that tracklist items are deleted when mix is deleted."""
        artist = models.Artist(name="Test Artist")
        db_session.add(artist)
        db_session.commit()
        
        mix = models.Mix(
            title="Test Mix",
            duration_seconds=180,
            file_path="/uploads/test.mp3",
            file_size_mb=5.2,
            quality_kbps=320,
            artist_id=artist.id
        )
        db_session.add(mix)
        db_session.commit()
        
        tracklist_item = models.TracklistItem(
            track_title="Track 1",
            track_artist="Artist 1",
            timestamp_seconds=30,
            mix_id=mix.id
        )
        
        db_session.add(tracklist_item)
        db_session.commit()
        
        tracklist_item_id = tracklist_item.id
        
        # Delete mix
        db_session.delete(mix)
        db_session.commit()
        
        # Tracklist item should be deleted due to cascade
        deleted_item = db_session.query(models.TracklistItem).filter(
            models.TracklistItem.id == tracklist_item_id
        ).first()
        assert deleted_item is None

class TestMixCategoryAssociation:
    """Test Mix-Category many-to-many relationship."""
    
    def test_mix_category_association(self, db_session):
        """Test associating mixes with categories."""
        # Create artist
        artist = models.Artist(name="Test Artist")
        db_session.add(artist)
        db_session.commit()
        
        # Create mix
        mix = models.Mix(
            title="Electronic Mix",
            duration_seconds=180,
            file_path="/uploads/electronic.mp3",
            file_size_mb=5.2,
            quality_kbps=320,
            artist_id=artist.id
        )
        db_session.add(mix)
        
        # Create categories
        electronic = models.Category(name="Electronic")
        dance = models.Category(name="Dance")
        db_session.add_all([electronic, dance])
        db_session.commit()
        
        # Associate mix with categories
        mix.categories.append(electronic)
        mix.categories.append(dance)
        db_session.commit()
        
        # Test associations
        assert len(mix.categories) == 2
        assert electronic in mix.categories
        assert dance in mix.categories
        assert mix in electronic.mixes
        assert mix in dance.mixes
    
    def test_category_multiple_mixes(self, db_session):
        """Test that categories can have multiple mixes."""
        artist = models.Artist(name="Test Artist")
        db_session.add(artist)
        db_session.commit()
        
        # Create multiple mixes
        mix1 = models.Mix(
            title="Mix 1",
            duration_seconds=180,
            file_path="/uploads/mix1.mp3",
            file_size_mb=5.2,
            quality_kbps=320,
            artist_id=artist.id
        )
        
        mix2 = models.Mix(
            title="Mix 2",
            duration_seconds=240,
            file_path="/uploads/mix2.mp3",
            file_size_mb=6.0,
            quality_kbps=320,
            artist_id=artist.id
        )
        
        db_session.add_all([mix1, mix2])
        
        # Create category
        electronic = models.Category(name="Electronic")
        db_session.add(electronic)
        db_session.commit()
        
        # Associate both mixes with category
        electronic.mixes.append(mix1)
        electronic.mixes.append(mix2)
        db_session.commit()
        
        # Test associations
        assert len(electronic.mixes) == 2
        assert mix1 in electronic.mixes
        assert mix2 in electronic.mixes

class TestModelValidationConstraints:
    """Test model validation and constraints."""
    
    def test_mix_required_fields(self, db_session):
        """Test that Mix required fields are enforced."""
        artist = models.Artist(name="Test Artist")
        db_session.add(artist)
        db_session.commit()
        
        # Try to create mix without required fields
        incomplete_mix = models.Mix(
            # Missing title, duration_seconds, etc.
            artist_id=artist.id
        )
        
        db_session.add(incomplete_mix)
        with pytest.raises(IntegrityError):
            db_session.commit()
    
    def test_artist_required_name(self, db_session):
        """Test that Artist name is required."""
        # Try to create artist without name
        artist = models.Artist()  # No name provided
        
        db_session.add(artist)
        with pytest.raises(IntegrityError):
            db_session.commit()
    
    def test_tracklist_item_required_fields(self, db_session):
        """Test that TracklistItem required fields are enforced."""
        artist = models.Artist(name="Test Artist")
        db_session.add(artist)
        db_session.commit()
        
        mix = models.Mix(
            title="Test Mix",
            duration_seconds=180,
            file_path="/uploads/test.mp3",
            file_size_mb=5.2,
            quality_kbps=320,
            artist_id=artist.id
        )
        db_session.add(mix)
        db_session.commit()
        
        # Try to create tracklist item without required fields
        incomplete_item = models.TracklistItem(
            mix_id=mix.id
            # Missing track_title, track_artist, timestamp_seconds
        )
        
        db_session.add(incomplete_item)
        with pytest.raises(IntegrityError):
            db_session.commit()

class TestModelIndexes:
    """Test database indexes and performance considerations."""
    
    def test_mix_title_index(self, db_session):
        """Test that Mix title is indexed for search performance."""
        # This test verifies the index exists by checking table metadata
        mix_table = models.Mix.__table__
        title_column = mix_table.c.title
        
        # Check if title column is indexed
        assert title_column.index is True
    
    def test_mix_id_primary_key_index(self, db_session):
        """Test that primary key is properly indexed."""
        mix_table = models.Mix.__table__
        id_column = mix_table.c.id
        
        # Primary key should be indexed
        assert id_column.primary_key is True
        assert id_column.index is True
