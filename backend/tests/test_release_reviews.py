import json
import stat
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.database import get_db
from app.models.models import Base, Mix, Artist
from app.routers.release_reviews import router
from app.routers.admin import router as admin_router
from app.services import release_reviews as reviews

KEY = {'X-Admin-Api-Key': 'owner-test-secret'}

@pytest.fixture
def setup(tmp_path, monkeypatch):
    monkeypatch.setenv('ADMIN_API_KEY', 'owner-test-secret')
    monkeypatch.setenv('RELEASE_REVIEW_DIR', str(tmp_path/'reviews'))
    monkeypatch.setenv('OWNER_SESSION_DIR', str(tmp_path/'sessions'))
    engine=create_engine(f'sqlite:///{tmp_path / "catalog.db"}', connect_args={'check_same_thread':False})
    Base.metadata.create_all(engine); factory=sessionmaker(bind=engine)
    with factory() as db:
        artist=Artist(name='Guest DJ');db.add(artist);db.flush()
        for id,title,visibility in [(1,'Guest release','unlisted'),(2,'Public mix','public'),(3,'Private mix','private'),(4,'TEST_ONLY_fixture','unlisted')]:
            db.add(Mix(id=id,title=title,availability=visibility,artist_id=artist.id,file_path=f'https://storage.example/{id}.mp3',duration_seconds=150,file_size_mb=5,quality_kbps=320,file_hash=str(id)*64,original_filename=f'{id}.mp3'))
        db.commit()
    def get_test_db():
        with factory() as db: yield db
    app=FastAPI();app.include_router(router);app.include_router(admin_router);app.dependency_overrides[get_db]=get_test_db
    yield TestClient(app,base_url='https://crew.djpapzin.com'),factory,tmp_path
    engine.dispose()

def body(detail, approve=False):
    return dict(fingerprint=detail['fingerprint'],revision=detail['revision'],**{k:True for k in reviews.CHECKS},final_approved=approve,notes='Private musical review',caption='Owner-approved draft',release_time='Friday, SAST; exact time pending')

def test_private_api_and_cookie_origin(setup):
    client,_,tmp=setup
    for path in ['/admin/releases','/admin/releases/1']:
        assert client.get(path).status_code==403
    assert client.put('/admin/releases/1',json={}).status_code==403
    assert not (tmp/'reviews').exists()
    response=client.get('/admin/releases',headers=KEY)
    assert response.headers['cache-control']=='private, no-store'
    assert [x['id'] for x in response.json()['mixes']]==[4,1]
    assert client.post('/admin/session',headers={**KEY,'Origin':'https://crew.djpapzin.com'}).status_code==200
    detail=client.get('/admin/releases/1').json()
    assert client.put('/admin/releases/1',json=body(detail),headers={'Origin':'https://evil.example'}).status_code==403
    assert client.put('/admin/releases/1',json=body(detail),headers={'Origin':'https://crew.djpapzin.com'}).status_code==200

def test_approval_durable_private_optional_tracklist_and_no_catalog_changes(setup):
    client,factory,tmp=setup
    detail=client.get('/admin/releases/1',headers=KEY).json()
    assert not detail['tracklist'] and not detail['cover_art_url']
    approved=client.put('/admin/releases/1',json=body(detail,True),headers=KEY)
    assert approved.status_code==200 and approved.json()['final_approved']
    assert approved.json()['approved_at'] and approved.json()['availability']=='unlisted'
    assert client.get('/admin/releases/1',headers=KEY).json()['final_approved']
    path=tmp/'reviews/1.json'
    assert stat.S_IMODE(path.stat().st_mode)==0o600
    assert stat.S_IMODE(path.parent.stat().st_mode)==0o700
    with factory() as db:
        row=db.get(Mix,1);assert row.availability=='unlisted' and row.title=='Guest release' and not row.tracklist
        assert db.query(Mix).count()==4

def test_missing_checks_and_test_records_cannot_be_approved(setup):
    client,factory,_=setup
    detail=client.get('/admin/releases/1',headers=KEY).json();data=body(detail,True);data['musical_approved']=False
    assert client.put('/admin/releases/1',json=data,headers=KEY).status_code==409
    fixture=client.get('/admin/releases/4',headers=KEY).json();assert fixture['test_only']
    assert client.put('/admin/releases/4',json=body(fixture,True),headers=KEY).status_code==409
    with factory() as db:
        row=db.get(Mix,1);row.file_hash=next(iter(reviews.SYNTHETIC_HASHES));db.commit()
    detail=client.get('/admin/releases/1',headers=KEY).json();assert detail['test_only']
    assert client.put('/admin/releases/1',json=body(detail,True),headers=KEY).status_code==409

@pytest.mark.parametrize('field,value', [('title','Corrected title'),('file_path','https://storage.example/new.mp3'),('cover_art_url','https://storage.example/new.jpg'),('tracklist','Supplied tracklist')])
def test_metadata_change_invalidates_saved_approval_and_old_save(setup,field,value):
    client,factory,_=setup
    detail=client.get('/admin/releases/1',headers=KEY).json()
    old=client.put('/admin/releases/1',json=body(detail,True),headers=KEY).json()
    with factory() as db:
        setattr(db.get(Mix,1),field,value);db.commit()
    fresh=client.get('/admin/releases/1',headers=KEY).json()
    assert fresh['stale'] and not fresh['final_approved'] and not any(fresh['checks'].values())
    assert fresh['notes']=='Private musical review' and fresh['caption']!='Owner-approved draft'
    assert client.put('/admin/releases/1',json=body(old,True),headers=KEY).status_code==409

def test_concurrent_edit_does_not_overwrite_and_invalid_inputs_fail(setup):
    client,_,_=setup
    detail=client.get('/admin/releases/1',headers=KEY).json()
    with ThreadPoolExecutor(2) as pool:
        codes=list(pool.map(lambda _:client.put('/admin/releases/1',json=body(detail),headers=KEY).status_code,range(2)))
    assert sorted(codes)==[200,409]
    data=body(detail);data['revision']=1;data['musical_approved']='yes'
    assert client.put('/admin/releases/1',json=data,headers=KEY).status_code==422
    for id in [2,3]:
        assert client.get(f'/admin/releases/{id}',headers=KEY).status_code==409
    assert client.get('/admin/releases/999',headers=KEY).status_code==404

def test_corrupt_review_fails_closed(setup):
    client,_,tmp=setup
    (tmp/'reviews').mkdir(mode=0o700);(tmp/'reviews/1.json').write_text('[')
    assert client.get('/admin/releases/1',headers=KEY).status_code==503

@pytest.mark.parametrize('digest', [
    '5c85b30bec12fba7a4d8df03892e9f21025fb66225c947aef8dd9a6481a80c1a',
    '15459a591de45769730c0ab70e0488e07d209e193148bb94deec8d6e603bc54f',
    '133bd18bc7b8bc54ea1c0e9db930cbe23e1f8007ff912aaa86dd6e5ef527a46f',
])
def test_renamed_legacy_synthetic_hashes_cannot_be_approved(setup,digest):
    client,factory,tmp=setup
    with factory() as db:
        mix=db.get(Mix,1);mix.file_hash=digest;mix.title='Approved-looking release';mix.original_filename='guest.mp3';db.commit()
    detail=client.get('/admin/releases/1',headers=KEY).json()
    assert detail['test_only'] and not detail['final_approved']
    response=client.put('/admin/releases/1',headers=KEY,json=body(detail,True))
    assert response.status_code==409 and 'Test uploads' in response.json()['detail']
    assert not (tmp/'reviews/1.json').exists()
    with factory() as db: assert db.get(Mix,1).availability=='unlisted'


def test_plural_test_names_are_recognized_without_substring_matches(setup):
    client,factory,_=setup
    with factory() as db:
        artist=db.get(Artist,1);artist.name='Papzin Crew Upload Tests';db.commit()
    assert client.get('/admin/releases/1',headers=KEY).json()['test_only']
    with factory() as db:
        artist=db.get(Artist,1);artist.name='Testament';db.commit()
    assert not client.get('/admin/releases/1',headers=KEY).json()['test_only']
