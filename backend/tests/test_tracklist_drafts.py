from types import SimpleNamespace
from unittest.mock import Mock
import pytest
from app.services import tracklist_drafts as drafts

@pytest.fixture(autouse=True)
def configured(tmp_path, monkeypatch):
    monkeypatch.setenv('TRACKLIST_DRAFT_DIR', str(tmp_path / 'drafts'))
    monkeypatch.setenv('AUDD_API_TOKEN', 'fake-test-token')
    monkeypatch.setenv('AUDD_FREE_REQUEST_BUDGET', '40')
    monkeypatch.setenv('AUDD_FREE_DOWNLOAD_BYTES', str(30 * 1024**2))


def mix(**changes):
    values=dict(id=237,title='DJ Mix',availability='public',tracklist='',tracklist_items=[],
                file_path='https://s3.us-east-005.backblazeb2.com/bucket/mix.m4a',file_size_mb=10,duration_seconds=1200)
    values.update(changes)
    return SimpleNamespace(**values)

@pytest.mark.parametrize('changes',[{'tracklist':'Existing credits'}, {'tracklist_items':[object()]},
                                  {'availability':'unlisted'}, {'availability':'private'}, {'title':'TEST private upload'},
                                  {'file_path':'http://localhost/internal'}, {'file_size_mb':1000}])
def test_blocks_existing_tracklists_tests_and_unapproved_urls(changes):
    with pytest.raises(drafts.DraftError): drafts.prepare(mix(**changes))
    assert drafts.load(237) is None


def test_disabled_without_free_allowances(monkeypatch):
    monkeypatch.delenv('AUDD_API_TOKEN')
    with pytest.raises(drafts.DraftError, match='disabled'): drafts.prepare(mix())


def test_reserves_budget_and_existing_draft_never_scans_twice():
    draft, created=drafts.prepare(mix())
    assert created and draft['chunks']==20
    same, created=drafts.prepare(mix())
    assert not created and same==draft
    import json
    usage=json.loads((drafts.directory()/'usage.json').read_text())
    assert usage=={'requests':20,'bytes':10*1024**2}
    with pytest.raises(drafts.DraftError): drafts.reserve(21,0)
    with pytest.raises(drafts.DraftError): drafts.reserve(1,21*1024**2)


def test_normalizes_sample_offsets_and_repeated_matches():
    song=lambda title:{'artist':'Artist','title':title,'score':95,'timecode':'20:00'}
    result=drafts.parse_entries({'status':'success','result':[
        {'offset':'00:00','songs':[song('A'),song('B')]},
        {'offset':'01:00','songs':[song('A')]},
        {'offset':'02:00','songs':[song('C')]},
        {'offset':'03:00','songs':[song('A')]},
    ]})
    assert [(e['seconds'],e['title']) for e in result]==[(0,'A'),(0,'B'),(120,'C'),(180,'A')]


def test_scan_writes_only_draft_and_preserves_mix(monkeypatch):
    original=mix(); drafts.prepare(original)
    response=Mock(); response.json.return_value={'status':'success','result':[{'offset':'01:00','songs':[{'artist':'DJ','title':'Song','score':90}]}]}
    post=Mock(return_value=response);monkeypatch.setattr(drafts.requests,'post',post)
    drafts.run(237,original.file_path)
    assert drafts.load(237)['state']=='ready'
    assert original.tracklist=='' and original.tracklist_items==[]
    assert post.call_args.kwargs['data']['limit']=='20'
    assert post.call_args.kwargs['allow_redirects'] is False


def test_failures_are_saved_without_retry_or_budget_refund(monkeypatch):
    drafts.prepare(mix())
    post=Mock(side_effect=RuntimeError('secret-token-must-not-appear'))
    monkeypatch.setattr(drafts.requests,'post',post)
    drafts.run(237,mix().file_path)
    draft=drafts.load(237)
    assert draft['state']=='failed' and 'secret' not in draft['error']
    assert post.call_count==1
    assert drafts.prepare(mix())[1] is False


def test_owner_auth_and_existing_tracklist_are_enforced(tmp_path, monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from sqlalchemy.pool import StaticPool
    from app.routers.admin import router
    from app.db.database import get_db
    from app.models.models import Base, Artist, Mix
    monkeypatch.setenv('ADMIN_API_KEY','private-test-owner-key')
    monkeypatch.delenv('AUDD_API_TOKEN')
    engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        artist=Artist(name='DJ');db.add(artist);db.flush()
        db.add(Mix(id=237,title='Mix',artist_id=artist.id,duration_seconds=60,file_path=mix().file_path,
                   file_size_mb=10,quality_kbps=320,availability='public',tracklist='Original credits'))
        db.commit()
    app=FastAPI();app.include_router(router)
    def dependency():
        with Session(engine) as db: yield db
    # Other legacy tests patch the module's get_db symbol during collection.
    # Override the callable actually captured by each route at registration.
    for route in app.routes:
        for dep in getattr(getattr(route, 'dependant', None), 'dependencies', []):
            if dep.name == 'db':
                app.dependency_overrides[dep.call] = dependency
    client=TestClient(app)
    assert client.get('/admin/tracklist-drafts/237').status_code==403
    headers={'X-Admin-Api-Key':'private-test-owner-key'}
    assert client.get('/admin/tracklist-drafts/237',headers=headers).json()=={'enabled':False,'draft':None}
    assert client.post('/admin/tracklist-drafts/237',headers=headers).status_code==409
    with Session(engine) as db: assert db.get(Mix,237).tracklist=='Original credits'
