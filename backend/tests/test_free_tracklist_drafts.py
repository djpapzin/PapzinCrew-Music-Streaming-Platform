from types import SimpleNamespace
from unittest.mock import Mock
import json
import pytest
from app.services import free_tracklist_drafts as free
from app.services import tracklist_drafts as audd


@pytest.fixture(autouse=True)
def setup(tmp_path, monkeypatch):
    monkeypatch.setenv('TRACKLIST_DRAFT_DIR', str(tmp_path / 'drafts'))
    monkeypatch.setenv('FREE_TRACKLIST_PYTHON', '/usr/bin/python3')
    monkeypatch.setenv('FREE_TRACKLIST_SAMPLE_BUDGET', '24')
    monkeypatch.setenv('FREE_TRACKLIST_DOWNLOAD_BYTES', str(20 * 1024**2))
    for key in ('LOCAL_TRACKLIST_SCRIPT', 'LOCAL_TRACKLIST_DATABASE', 'LOCAL_TRACKLIST_METADATA'):
        monkeypatch.delenv(key, raising=False)


def mix(**changes):
    values = dict(id=237, title='DJ Mix', availability='public', tracklist='', tracklist_items=[],
                  file_path='https://s3.us-east-005.backblazeb2.com/bucket/audio.m4a',
                  file_size_mb=9, duration_seconds=1074)
    values.update(changes)
    return SimpleNamespace(**values)


@pytest.mark.parametrize('provider', free.PROVIDERS)
@pytest.mark.parametrize('changes', [{'tracklist': 'Original'}, {'tracklist_items': [object()]},
                                   {'availability': 'unlisted'}, {'availability': 'private'}, {'title': 'TEST sample'}])
def test_guard_all_providers(provider, changes):
    with pytest.raises(free.DraftError): free.prepare(mix(**changes), provider, '00:00 Artist — Song')
    assert free.load(237, provider) is None


def test_manual_stays_private_and_all_provider_drafts_are_preserved():
    free.directory().mkdir()
    legacy = {'mix_id': 237, 'entries': [{'title': 'AudD candidate'}]}
    audd.save(legacy)
    original = mix()
    draft, work = free.prepare(original, 'manual', '00:30 Artist — Song\n00:00 DJ - Intro')
    assert not work and draft['state'] == 'ready'
    assert [e['seconds'] for e in draft['entries']] == [0, 30]
    assert free.prepare(original, 'manual', '00:00 Other — Replacement') == (draft, False)
    assert audd.load(237) == legacy
    assert original.tracklist == '' and not original.tracklist_items
    assert not (free.directory() / 'free-usage.json').exists()


@pytest.mark.parametrize('text', ['bad entry', '99:00 Artist — Song', '', '00:00 Artist'])
def test_manual_invalid(text):
    with pytest.raises(free.DraftError): free.prepare(mix(), 'manual', text)


def test_scan_reserves_once_and_never_uses_audd(monkeypatch):
    post = Mock(); monkeypatch.setattr(free.requests, 'post', post)
    original = mix()
    draft, created = free.prepare(original, 'shazamio')
    assert created and len(draft['offsets']) == 12
    assert draft['offsets'][0] == 0 and draft['offsets'][-1] == 1062
    assert free.prepare(original, 'shazamio') == (draft, False)
    response = Mock(); response.__enter__ = Mock(return_value=response); response.__exit__ = Mock()
    response.status_code = 200; response.iter_content.return_value = [b'test audio']
    monkeypatch.setattr(free.requests, 'get', Mock(return_value=response))
    result = Mock(returncode=0, stdout=json.dumps([{'seconds': 0, 'artist': 'Artist', 'title': 'Song', 'score': None}]))
    worker = Mock(return_value=result); monkeypatch.setattr(free.subprocess, 'run', worker)
    monkeypatch.setenv('AUDD_API_TOKEN', 'never-transmit-me')
    free.run(237, 'shazamio', original.file_path)
    assert free.load(237, 'shazamio')['state'] == 'ready'
    assert free.usage() == {'samples': 12, 'bytes': 9 * 1024**2}
    post.assert_not_called()
    assert 'AUDD_API_TOKEN' not in worker.call_args.kwargs['env']
    assert audd.load(237) is None and original.tracklist == ''


def test_failures_do_not_retry_or_refund(monkeypatch):
    free.prepare(mix(), 'shazamio')
    get = Mock(side_effect=RuntimeError('secret'))
    monkeypatch.setattr(free.requests, 'get', get)
    free.run(237, 'shazamio', mix().file_path)
    assert get.call_count == 1
    assert free.load(237, 'shazamio')['state'] == 'failed'
    assert 'secret' not in free.load(237, 'shazamio')['error']
    assert free.usage()['samples'] == 12
    assert free.prepare(mix(), 'shazamio')[1] is False


def test_allowance_and_local_library_fail_closed(monkeypatch):
    with pytest.raises(free.DraftError): free.prepare(mix(), 'local')
    monkeypatch.setenv('FREE_TRACKLIST_SAMPLE_BUDGET', '0')
    with pytest.raises(free.DraftError): free.prepare(mix(), 'shazamio')
    assert free.prepare(mix(), 'manual', '00:00 DJ — Song')[0]['state'] == 'ready'


def test_api_owner_auth_and_audd_off(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.routers.admin import router
    monkeypatch.setenv('ADMIN_API_KEY', 'owner-test-key')
    app = FastAPI(); app.include_router(router); client = TestClient(app)
    assert client.get('/admin/tracklist-drafts/237?provider=manual').status_code == 403
    headers = {'X-Admin-Api-Key': 'owner-test-key'}
    assert client.get('/admin/tracklist-drafts/237?provider=manual', headers=headers).json()['enabled']
    assert client.get('/admin/tracklist-drafts/237?provider=bad', headers=headers).status_code == 400
