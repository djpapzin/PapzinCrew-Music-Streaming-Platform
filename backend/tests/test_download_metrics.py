import hashlib
import json
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine,text
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.db.database import get_db
from app.models.models import Base,Artist,Mix
from app.routers import usage,cached_audio,tracks
from app.services.audio_cache import version

@pytest.fixture
def download_client(tmp_path,monkeypatch):
    monkeypatch.setenv('ADMIN_API_KEY','owner-test')
    monkeypatch.setenv('AUDIO_CACHE_DIR',str(tmp_path))
    monkeypatch.setenv('AUDIO_CACHE_SERVE_ENABLED','1')
    monkeypatch.setenv('AUDIO_DOWNLOADS_ENABLED','1')
    monkeypatch.setenv('AUDIO_CACHE_PUBLIC_BASE','https://audio.djpapzin.com')
    engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
    Base.metadata.create_all(engine)
    source='https://s3.us-east-005.backblazeb2.com/bucket/demo.mp3'
    data=b'demo-audio'*100;digest=hashlib.sha256(data).hexdigest()
    (tmp_path/(digest+'.audio')).write_bytes(data)
    (tmp_path/'manifest.json').write_text(json.dumps({'241':{'sha256':digest,'version':version(source),'size':len(data),'content_type':'audio/mpeg'}}))
    with Session(engine) as db:
        db.add(Artist(id=1,name='Guest DJ'))
        for ident,visibility in ((241,'public'),(242,'unlisted')):
            db.add(Mix(id=ident,title='Guest 48' if ident==241 else 'Private test',artist_id=1,duration_seconds=60,file_size_mb=1,quality_kbps=128,file_path=source if ident==241 else source+'?test',availability=visibility,allow_downloads='yes',download_count=88 if ident==242 else 0))
        db.commit();db.execute(text('UPDATE mixes SET download_count=NULL WHERE id=241'));db.commit()
    app=FastAPI();app.include_router(usage.router);app.include_router(cached_audio.router);app.include_router(tracks.router)
    def database():
        with Session(engine) as db:yield db
    app.dependency_overrides[get_db]=database
    app.dependency_overrides[tracks._get_db_dyn]=database
    return TestClient(app),engine,'/tracks/241/cached/'+version(source),data

def test_owner_download_counts_exclude_private_uploads(download_client):
    client,engine,url,data=download_client
    assert client.get('/admin/downloads').status_code==403
    assert client.get('/tracks/241/stats').status_code==403
    result=client.get('/admin/downloads',headers={'X-Admin-Api-Key':'owner-test'}).json()
    assert result['mixes']==[{'id':241,'title':'Guest 48','requests':0}]
    assert result['total_requests']==0

def test_download_requests_count_get_starts_not_head_resumes_or_redirects(download_client):
    client,engine,url,data=download_client
    def count():
        with Session(engine) as db:return db.get(Mix,241).download_count
    assert client.head(url+'?download=1').status_code==200
    assert client.get(url+'?download=1',headers={'Range':'bytes=500-'}).status_code==206
    assert count() is None
    result=client.get('/tracks/241/download',follow_redirects=False)
    assert result.status_code==307 and result.headers['location'].startswith('https://audio.djpapzin.com/')
    assert count() is None
    result=client.get(url+'?download=1')
    assert result.content==data and 'attachment;' in result.headers['content-disposition']
    assert count()==1
    assert client.get('/admin/downloads',headers={'X-Admin-Api-Key':'owner-test'}).json()['total_requests']==1
    assert client.get('/tracks/242/download',follow_redirects=False).status_code==404
