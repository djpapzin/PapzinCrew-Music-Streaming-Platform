import os
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.database import get_db
from app.models import models
from app.services.paperclip_client import PaperclipConsumerError

# Setup the TestClient
client = TestClient(app)

# Setup an in-memory SQLite database shared across TestClient requests
SQLALCHEMY_DATABASE_URL = "sqlite://"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Override the get_db dependency to use the shared in-memory database
models.Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="function")
def db_session():
    models.Base.metadata.drop_all(bind=engine)
    models.Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        models.Base.metadata.drop_all(bind=engine)

# --- Test Cases ---

@patch('app.routers.admin.fetch_paperclip_summary')
def test_get_analytics_success(mock_fetch_paperclip_summary, db_session):
    """Test successful retrieval of analytics data with a valid admin key."""
    # Arrange: Add some mock data
    mock_fetch_paperclip_summary.return_value = {
        'initiative_id': 'init-paperclip-admin',
        'initiative_title': 'Admin brief',
        'business_status_summary': 'Paperclip summary is available in admin analytics.',
        'current_tracker_phase': 'review',
        'blocker_summary': 'No blocker.',
        'next_milestone': 'Ship admin snapshot.',
        'risk_flag': 'low',
        'budget_flag': 'within_guardrail',
        'storage_flag': 'healthy',
        'goal_id': 'goal-1',
        'linked_tracker_cards': ['#203'],
        'last_updated': '2026-03-27T20:40:00Z',
        'audit_ref': 'audit-1',
    }
    artist = models.Artist(name="Test Artist")
    db_session.add(artist)
    db_session.commit()
    db_session.refresh(artist)

    db_session.add(
        models.Mix(
            title="Test Mix 1",
            original_filename="test1.mp3",
            artist_id=artist.id,
            duration_seconds=180,
            file_path="/uploads/test1.mp3",
            file_size_mb=5.5,
            quality_kbps=320,
            play_count=100,
            download_count=10,
        )
    )
    db_session.add(
        models.Mix(
            title="Test Mix 2",
            original_filename="test2.mp3",
            artist_id=artist.id,
            duration_seconds=240,
            file_path="/uploads/test2.mp3",
            file_size_mb=2.3,
            quality_kbps=320,
            play_count=50,
            download_count=5,
        )
    )
    db_session.commit()

    # Act: Call the endpoint with the admin key
    admin_key = "test_admin_key"
    os.environ["ADMIN_API_KEY"] = admin_key
    response = client.get("/admin/analytics", headers={"X-Admin-Api-Key": admin_key})

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["total_plays"] == 150
    assert data["total_downloads"] == 15
    assert data["total_storage_mb"] == 7.8
    assert data['paperclip_summary']['initiative_id'] == 'init-paperclip-admin'

    # Cleanup
    del os.environ["ADMIN_API_KEY"]

def test_get_analytics_no_key(db_session):
    """Test that a 403 is returned when no admin key is provided."""
    # Arrange
    os.environ["ADMIN_API_KEY"] = "a_real_key"

    # Act
    response = client.get("/admin/analytics")

    # Assert
    assert response.status_code == 403
    assert "Admin API Key is required" in response.json()["detail"]

    # Cleanup
    del os.environ["ADMIN_API_KEY"]

def test_get_analytics_wrong_key(db_session):
    """Test that a 403 is returned when the wrong admin key is provided."""
    # Arrange
    os.environ["ADMIN_API_KEY"] = "the_real_key"

    # Act
    response = client.get("/admin/analytics", headers={"X-Admin-Api-Key": "wrong_key"})

    # Assert
    assert response.status_code == 403
    assert "Invalid Admin API Key" in response.json()["detail"]

    # Cleanup
    del os.environ["ADMIN_API_KEY"]

def test_get_analytics_empty_db(db_session):
    """Test that analytics are zero when the database is empty."""
    # Arrange
    admin_key = "test_admin_key"
    os.environ["ADMIN_API_KEY"] = admin_key

    # Act
    response = client.get("/admin/analytics", headers={"X-Admin-Api-Key": admin_key})

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["total_plays"] == 0
    assert data["total_downloads"] == 0
    assert data["total_storage_mb"] == 0

    # Cleanup
    del os.environ["ADMIN_API_KEY"]

@patch('app.routers.admin.fetch_paperclip_summary', side_effect=PaperclipConsumerError('boom'))
def test_get_analytics_survives_paperclip_failure(mock_fetch_paperclip_summary, db_session):
    admin_key = 'test_admin_key'
    os.environ['ADMIN_API_KEY'] = admin_key

    response = client.get('/admin/analytics', headers={'X-Admin-Api-Key': admin_key})

    assert response.status_code == 200
    data = response.json()
    assert data['paperclip_summary'] is None

    del os.environ['ADMIN_API_KEY']
