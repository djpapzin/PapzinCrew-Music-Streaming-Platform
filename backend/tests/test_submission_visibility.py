"""Public discovery must not expose submissions waiting for owner review."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.database import get_db
from app.models.models import Base, Artist, Mix, Category
from app.routers.tracks import router, _get_db_dyn
from app.routers.artists import router as artists_router
from app.routers.categories import router as categories_router


@pytest.fixture
def submission_catalog():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        artist = Artist(name='Submission DJ')
        category = Category(name='House')
        db.add_all([artist, category])
        db.flush()
        for index, visibility in enumerate(['public', 'unlisted', 'private', 'public']):
            db.add(Mix(title=f'Submission {visibility}', original_filename='test.wav',
                       artist_id=artist.id, duration_seconds=180, file_size_mb=1.0,
                       quality_kbps=320, file_path=f'/uploads/test-{index}.wav',
                       cover_art_url='/uploads/test.jpg', genre='House', availability=visibility,
                       categories=[category]))
        db.commit()
    app = FastAPI()
    app.include_router(router)
    app.include_router(artists_router)
    app.include_router(categories_router)
    def database():
        with Session(engine) as db:
            yield db
    app.dependency_overrides[get_db] = database
    app.dependency_overrides[_get_db_dyn] = database
    with TestClient(app) as client:
        yield client
    engine.dispose()


@pytest.mark.parametrize('url', [
    '/tracks/search?q=Submission', '/tracks/search?artist=Submission',
    '/tracks/search?genre=House', '/tracks/', '/tracks/catalog',
    '/artists/1/tracks', '/categories/1/tracks',
])
def test_discovery_excludes_unreviewed_submissions(submission_catalog, url):
    response = submission_catalog.get(url)
    assert response.status_code == 200
    assert {row['id'] for row in response.json()} == {1, 4}


@pytest.mark.parametrize('url, expected', [
    ('/tracks/?limit=1', 4), ('/tracks/?skip=1&limit=1', 1),
    ('/tracks/search?q=Submission&limit=1', 1),
    ('/tracks/search?q=Submission&page=2&limit=1', 4),
])
def test_visibility_filter_precedes_pagination(submission_catalog, url, expected):
    assert [row['id'] for row in submission_catalog.get(url).json()] == [expected]


def test_unlisted_review_link_remains_available_but_private_is_denied(submission_catalog):
    response = submission_catalog.get('/tracks/2')
    assert response.status_code == 200
    assert response.json()['availability'] == 'unlisted'
    assert response.json()['cover_art_url'] == '/uploads/test.jpg'
    assert submission_catalog.get('/tracks/3').status_code == 401


@pytest.mark.parametrize('url', ['/artists/', '/artists/1', '/categories/', '/categories/1'])
def test_collection_details_do_not_embed_unreviewed_mixes(submission_catalog, url):
    response = submission_catalog.get(url)
    assert response.status_code == 200
    result = response.json()
    collection = result[0] if isinstance(result, list) else result
    assert {row['id'] for row in collection['mixes']} == {1, 4}
