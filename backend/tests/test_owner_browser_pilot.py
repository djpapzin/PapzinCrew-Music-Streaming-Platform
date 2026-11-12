"""Pilot authentication, byte limits and durable one-attempt policy."""
import hashlib
import importlib.util
from pathlib import Path
import time
from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient
import pytest
spec = importlib.util.spec_from_file_location('pilot', Path(__file__).parents[1] / 'tools/owner_browser_pilot.py')
pilot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pilot)
SECRET = 'private-test-credential-' * 3
HEADERS = {'Authorization': 'Bearer ' + SECRET, 'Origin': pilot.ORIGIN}

@pytest.fixture
def gateway(tmp_path, monkeypatch):
    for name, data in [('AUDIO', b'local synthetic audio'), ('COVER', b'local synthetic cover')]:
        monkeypatch.setattr(pilot, name, (hashlib.sha256(data).hexdigest(), len(data)))
    calls = []
    def uploader(a, c):
        calls.append((a.read(), c.read()))
        return {'id': 99, 'storage': 'b2', 'availability': 'unlisted'}
    latch = tmp_path / 'attempt'
    return TestClient(pilot.create_gateway(SECRET, time.time() + 60, latch, uploader)), calls, latch, uploader

def files(audio=b'local synthetic audio'):
    return {'file': ('a.wav', audio, 'audio/wav'), 'cover_art': ('c.jpg', b'local synthetic cover', 'image/jpeg')}

def test_auth_origin_expiry_before_latch(gateway):
    client, calls, latch, uploader = gateway
    for headers, status in [({}, 401), ({'Authorization': 'Bearer wrong'}, 401), ({**HEADERS, 'Origin': 'https://evil.example'}, 403)]:
        assert client.post(pilot.PREFIX + '/upload', content=b'not multipart', headers=headers).status_code == status
        assert not latch.exists()
    expired = TestClient(pilot.create_gateway(SECRET, time.time() - 1, latch, uploader))
    assert expired.post(pilot.PREFIX + '/upload', files=files(), headers=HEADERS).status_code == 410
    assert not calls and not latch.exists()

def test_declared_size_before_attempt(gateway):
    client, calls, latch, _ = gateway
    assert client.post(pilot.PREFIX + '/upload', content=b'x', headers={**HEADERS, 'Content-Length': str(pilot.MAX_BODY + 1)}).status_code == 413
    assert not calls and not latch.exists()

def test_stream_limit_without_content_length(gateway, monkeypatch):
    client, calls, latch, _ = gateway
    monkeypatch.setattr(pilot, 'MAX_BODY', 10)
    response = client.post(pilot.PREFIX + '/upload', content=iter([b'--abc\r\n', b'x' * 50]), headers={**HEADERS, 'Content-Type': 'multipart/form-data; boundary=abc'})
    assert response.status_code == 413
    assert not calls and latch.exists()

def test_exact_files_one_attempt_and_restart(gateway):
    client, calls, latch, uploader = gateway
    response = client.post(pilot.PREFIX + '/upload', files=files(), headers=HEADERS)
    assert response.status_code == 201 and response.json() == {'id': 99, 'availability': 'unlisted'}
    assert calls == [(b'local synthetic audio', b'local synthetic cover')]
    restarted = TestClient(pilot.create_gateway(SECRET, time.time() + 60, latch, uploader))
    assert restarted.post(pilot.PREFIX + '/upload', files=files(), headers=HEADERS).status_code == 409
    assert len(calls) == 1

def test_concurrent_only_one_write(gateway):
    client, calls, _, _ = gateway
    with ThreadPoolExecutor(max_workers=2) as pool:
        codes = list(pool.map(lambda _: client.post(pilot.PREFIX + '/upload', files=files(), headers=HEADERS).status_code, range(2)))
    assert sorted(codes) == [201, 409] and len(calls) == 1

def test_wrong_hash_consumes_attempt(gateway):
    client, calls, latch, _ = gateway
    assert client.post(pilot.PREFIX + '/upload', files=files(b'wrong'), headers=HEADERS).status_code == 400
    assert not calls and latch.exists()
    assert client.post(pilot.PREFIX + '/upload', files=files(), headers=HEADERS).status_code == 409

def test_failure_no_secret_no_retry(tmp_path, monkeypatch):
    monkeypatch.setattr(pilot, 'AUDIO', (hashlib.sha256(b'a').hexdigest(), 1))
    monkeypatch.setattr(pilot, 'COVER', (hashlib.sha256(b'c').hexdigest(), 1))
    def failing(*_):
        raise RuntimeError('secret-storage-url')
    client = TestClient(pilot.create_gateway(SECRET, time.time() + 60, tmp_path / 'attempt', failing))
    response = client.post(pilot.PREFIX + '/upload', files={'file': ('a.wav', b'a'), 'cover_art': ('c.jpg', b'c')}, headers=HEADERS)
    assert response.status_code == 502 and 'secret-storage-url' not in response.text
    assert client.post(pilot.PREFIX + '/upload', files=files(), headers=HEADERS).status_code == 409

def test_page_no_secret_no_proxy(gateway):
    client, _, _, _ = gateway
    response = client.get(pilot.PREFIX)
    assert response.status_code == 200 and SECRET not in response.text
    assert response.headers['cache-control'] == 'no-store'
    assert 'frame-ancestors' in response.headers['content-security-policy']
    assert client.get(pilot.PREFIX + '/page.js').status_code == 200
    assert client.post('/upload', headers=HEADERS).status_code == 404
    assert client.get('/docs').status_code == 404


def test_inherited_cover_retry_settings_are_overridden(monkeypatch):
    monkeypatch.setenv('B2_COVER_MAX_RETRIES', '8')
    monkeypatch.setenv('B2_MAX_RETRIES', '8')
    monkeypatch.setenv('B2_MAX_ATTEMPTS', '8')
    # Record all changed environment keys so this isolated test restores them.
    import os
    for key in ['UPLOADS_ENABLED', 'ENFORCE_B2_ONLY', 'DB_AUTO_MIGRATE', 'BACKFILL_TRACK_DURATIONS']:
        monkeypatch.setenv(key, os.environ.get(key, '0'))
    pilot.configure_process()
    assert os.environ['B2_COVER_MAX_RETRIES'] == '1'
    assert os.environ['B2_MAX_RETRIES'] == '1'
    assert os.environ['B2_MAX_ATTEMPTS'] == '0'


@pytest.mark.parametrize('outcome', ['failure', 'timeout', 'success'])
def test_cover_never_falls_back_or_retries(tmp_path, outcome):
    import asyncio
    class Storage:
        endpoint_url = 'https://storage.example'
        bucket = 'test'
        calls = 0
        def is_configured(self):
            return True
        def put_bytes_safe(self, key, data, content_type):
            self.calls += 1
            if outcome == 'timeout':
                raise TimeoutError('ambiguous PUT')
            return {'ok': outcome == 'success', 'url': f'{self.endpoint_url}/{self.bucket}/{key}'}
    storage = Storage()
    writer = pilot.B2OnlyCover(storage)
    if outcome == 'success':
        assert asyncio.run(writer(b'cover', 'fixture', str(tmp_path), source='uploaded')).startswith('https://storage.example/test/')
        assert writer.url
    else:
        with pytest.raises((RuntimeError, TimeoutError)):
            asyncio.run(writer(b'cover', 'fixture', str(tmp_path), source='uploaded'))
        assert writer.url is None
    assert not list(tmp_path.iterdir())
    with pytest.raises(RuntimeError):
        asyncio.run(writer(b'cover', 'fixture', str(tmp_path), source='uploaded'))
    assert storage.calls == 1


def test_finalized_row_requires_confirmed_b2_cover():
    from types import SimpleNamespace
    cover = SimpleNamespace(url=None)
    row = SimpleNamespace(cover_art_url='/uploads/local.jpg', availability='unlisted', title=pilot.TITLE, file_hash=pilot.AUDIO[0])
    with pytest.raises(RuntimeError):
        pilot.require_finalized_cover(row, cover)
    cover.url = 'https://storage.example/test/covers/confirmed.jpg'
    with pytest.raises(RuntimeError):
        pilot.require_finalized_cover(row, cover)
    row.cover_art_url = cover.url
    pilot.require_finalized_cover(row, cover)
    row.availability = 'public'
    with pytest.raises(RuntimeError):
        pilot.require_finalized_cover(row, cover)
