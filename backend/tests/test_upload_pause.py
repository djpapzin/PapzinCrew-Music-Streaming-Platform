import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.services.upload_access import upload_access_guard


@pytest.mark.parametrize('path', ['/upload', '/upload/', '/upload/upload-mix', '/upload/extract-metadata', '/upload/check-duplicate'])
def test_pause_blocks_upload_handlers_before_reading_files(monkeypatch, path):
    monkeypatch.setenv('UPLOADS_ENABLED', '0')
    app = FastAPI()
    app.middleware('http')(upload_access_guard)
    @app.post('/{path:path}')
    def handler(path):
        pytest.fail('Paused upload must not reach its handler')
    response = TestClient(app).post(path, content=b'not a valid upload')
    assert response.status_code == 503
    assert response.headers['cache-control'] == 'no-store'


def test_pause_does_not_block_existing_audio_or_other_routes(monkeypatch):
    monkeypatch.setenv('UPLOADS_ENABLED', '0')
    app = FastAPI()
    app.middleware('http')(upload_access_guard)
    @app.get('/{path:path}')
    def handler(path):
        return {'ok': True}
    client = TestClient(app)
    for path in ['/uploads/existing.mp3', '/tracks/241', '/health']:
        assert client.get(path).status_code == 200
