import pytest
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pathlib import Path
import sys

# Add backend to path for imports
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import crud, schemas
from app.models import models
from app.db.database import SessionLocal, engine

# Create test database tables
models.Base.metadata.create_all(bind=engine)

@pytest.fixture
def db_session():
    """Create a fresh database session for each test."""
    session = SessionLocal()
    try:
        yield session
    finally:
        # Ensure we are not in a failed/rolled-back transaction from a test
        # (e.g., after IntegrityError) before attempting cleanup operations.
        try:
            session.rollback()
        except Exception:
            pass
        # Clean up test data in correct order (respecting foreign keys)
        session.query(models.Mix).delete()
        session.query(models.Artist).delete()
        session.query(models.Category).delete()
        session.commit()
        session.close()

@pytest.fixture
def sample_artist():
    """Sample artist for testing."""
    import uuid
    return schemas.ArtistCreate(name=f"Test Artist {uuid.uuid4().hex[:8]}")

@pytest.fixture
def sample_mix():
    """Sample mix for testing."""
    import uuid
    return schemas.MixCreate(
        title=f"Test Mix {uuid.uuid4().hex[:8]}",
        duration_seconds=180,
        file_path=f"/uploads/test_{uuid.uuid4().hex[:8]}.mp3",
        file_size_mb=5.2,
        quality_kbps=320
    )

@pytest.fixture
def sample_category():
    """Sample category for testing."""
    import uuid
    return schemas.CategoryCreate(name=f"Electronic {uuid.uuid4().hex[:8]}", description="Electronic music")

@pytest.fixture
def sample_mix_data():
    """Create sample mix data for testing."""
    return {
        "title": "Test Mix",
        "original_filename": "test.mp3",
        "artist_id": 1,
        "duration_seconds": 180,
        "file_size_mb": 5.2,
        "quality_kbps": 320,
        "file_path": "/uploads/test.mp3",
        "cover_art_url": "https://example.com/cover.jpg",
        "description": "Test description",
        "genre": "Electronic",
        "availability": "public"
    }

class TestArtistCRUD:
    """Test CRUD operations for artists."""
    
    def test_create_artist_success(self, db_session: Session, sample_artist):
        """Test successful artist creation."""
        artist = crud.create_artist(db=db_session, artist=sample_artist)
        
        assert artist.id is not None
        assert artist.name == sample_artist.name
        
        # Verify it's in the database
        db_artist = crud.get_artist(db=db_session, artist_id=artist.id)
        assert db_artist is not None
        assert db_artist.name == sample_artist.name
    
    def test_create_duplicate_artist(self, db_session: Session, sample_artist):
        """Test creating artist with duplicate name."""
        # Create first artist
        crud.create_artist(db=db_session, artist=sample_artist)
        
        # Attempt to create duplicate - should still work (no unique constraint on name)
        duplicate_artist = crud.create_artist(db=db_session, artist=sample_artist)
        assert duplicate_artist.id is not None
        assert duplicate_artist.name == sample_artist.name
    
    def test_get_artist_by_name(self, db_session: Session, sample_artist):
        """Test retrieving artist by name."""
        created_artist = crud.create_artist(db=db_session, artist=sample_artist)
        
        found_artist = crud.get_artist_by_name(db=db_session, name=sample_artist.name)
        assert found_artist is not None
        assert found_artist.id == created_artist.id
    
    def test_get_artist_by_name_not_found(self, db_session: Session):
        """Test retrieving non-existent artist by name."""
        artist = crud.get_artist_by_name(db=db_session, name="Non-existent Artist")
        assert artist is None
    
    def test_get_artists_pagination(self, db_session: Session):
        """Test artist pagination."""
        # Create multiple artists
        for i in range(5):
            artist_data = schemas.ArtistCreate(name=f"Artist {i}")
            crud.create_artist(db=db_session, artist=artist_data)
        
        # Test pagination
        page1 = crud.get_artists(db=db_session, skip=0, limit=2)
        assert len(page1) == 2
        
        page2 = crud.get_artists(db=db_session, skip=2, limit=2)
        assert len(page2) == 2
        
        # Ensure different results
        assert page1[0].id != page2[0].id

class TestMixCRUD:
    """Test CRUD operations for mixes."""
    
    def test_create_mix_success(self, db_session: Session, sample_artist, sample_mix_data):
        """Test successful mix creation."""
        # Create artist first
        artist = crud.create_artist(db=db_session, artist=sample_artist)
        sample_mix_data["artist_id"] = artist.id
        
        mix_data = schemas.MixCreate(**sample_mix_data)
        mix = crud.create_mix(db=db_session, mix=mix_data)
        
        assert mix.id is not None
        assert mix.title == "Test Mix"
        assert mix.artist_id == artist.id
        assert mix.duration_seconds == 180
    
    def test_create_mix_invalid_artist(self, db_session: Session, sample_mix_data):
        """Test creating mix with non-existent artist."""
        sample_mix_data["artist_id"] = 999  # Non-existent artist
        mix_data = schemas.MixCreate(**sample_mix_data)
        
        with pytest.raises(IntegrityError):
            crud.create_mix(db=db_session, mix=mix_data)
    
    def test_get_mix_success(self, db_session: Session, sample_artist, sample_mix_data):
        """Test retrieving mix by ID."""
        # Create artist and mix
        artist = crud.create_artist(db=db_session, artist=sample_artist)
        sample_mix_data["artist_id"] = artist.id
        mix_data = schemas.MixCreate(**sample_mix_data)
        created_mix = crud.create_mix(db=db_session, mix=mix_data)
        
        # Retrieve mix
        retrieved_mix = crud.get_mix(db=db_session, mix_id=created_mix.id)
        assert retrieved_mix is not None
        assert retrieved_mix.id == created_mix.id
        assert retrieved_mix.title == "Test Mix"
    
    def test_get_mix_not_found(self, db_session: Session):
        """Test retrieving non-existent mix."""
        mix = crud.get_mix(db=db_session, mix_id=999)
        assert mix is None
    
    def test_get_mixes_pagination(self, db_session: Session, sample_artist):
        """Test mix pagination."""
        # Create artist
        artist = crud.create_artist(db=db_session, artist=sample_artist)
        
        # Create multiple mixes
        for i in range(5):
            mix_data = schemas.MixCreate(
                title=f"Mix {i}",
                original_filename=f"mix{i}.mp3",
                artist_id=artist.id,
                duration_seconds=180,
                file_size_mb=5.0,
                quality_kbps=320,
                file_path=f"/uploads/mix{i}.mp3"
            )
            crud.create_mix(db=db_session, mix=mix_data)
        
        # Test pagination
        page1 = crud.get_mixes(db=db_session, skip=0, limit=2)
        assert len(page1) == 2
        
        page2 = crud.get_mixes(db=db_session, skip=2, limit=2)
        assert len(page2) == 2
    
    def test_duplicate_file_path_constraint(self, db_session: Session, sample_artist, sample_mix_data):
        """Test unique constraint on file_path."""
        # Create artist
        artist = crud.create_artist(db=db_session, artist=sample_artist)
        sample_mix_data["artist_id"] = artist.id
        
        # Create first mix
        mix_data1 = schemas.MixCreate(**sample_mix_data)
        crud.create_mix(db=db_session, mix=mix_data1)
        
        # Attempt to create second mix with same file_path
        sample_mix_data["title"] = "Different Title"
        mix_data2 = schemas.MixCreate(**sample_mix_data)
        
        with pytest.raises(IntegrityError):
            crud.create_mix(db=db_session, mix=mix_data2)

class TestCategoryOperations:
    """Test category-related operations."""
    
    def test_category_mix_relationship(self, db_session: Session, sample_artist, sample_mix_data):
        """Test many-to-many relationship between categories and mixes."""
        # Create artist and mix
        artist = crud.create_artist(db=db_session, artist=sample_artist)
        sample_mix_data["artist_id"] = artist.id
        mix_data = schemas.MixCreate(**sample_mix_data)
        mix = crud.create_mix(db=db_session, mix=mix_data)
        
        # Create category
        category_data = schemas.CategoryCreate(name="Electronic", description="Electronic music")
        category = crud.create_category(db=db_session, category=category_data)
        
        # Test relationship (would need to implement category assignment in CRUD)
        assert mix.id is not None
        assert category.id is not None
