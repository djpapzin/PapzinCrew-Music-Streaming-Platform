import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.database import get_db
from app.models.models import Base, Mix, Artist
from app.routers.sharing_packs import router
from app.routers.admin import router as admin_router
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

def test_owner_only_public_queue_and_pack(setup):
    client,factory,_=setup
    assert client.get('/admin/sharing').status_code==403
    assert client.get('/admin/sharing/2').status_code==403
    assert [m['id'] for m in client.get('/admin/sharing',headers=KEY).json()['mixes']]==[2]
    pack=client.get('/admin/sharing/2',headers=KEY).json()
    assert pack['url']=='https://crew.djpapzin.com/track/2'
    assert 'storage.example' not in str(pack)
    for id in (1,3,4,99):assert client.get(f'/admin/sharing/{id}',headers=KEY).status_code==404
    with factory() as db:
        row=db.get(Mix,4);row.availability='public';db.commit()
    assert client.get('/admin/sharing/4',headers=KEY).status_code==404

def test_fresh_metadata_visibility_and_missing_credit(setup):
    client,factory,_=setup
    first=client.get('/admin/sharing/2',headers=KEY).json()
    with factory() as db:
        row=db.get(Mix,2);row.title='Updated';row.artist.name='';db.commit()
    updated=client.get('/admin/sharing/2',headers=KEY).json()
    assert updated['fingerprint']!=first['fingerprint']
    assert updated['artist']=='MISSING: artist credit'
    assert 'Updated' in updated['short']
    with factory() as db:
        row=db.get(Mix,2);row.availability='unlisted';db.commit()
    assert client.get('/admin/sharing/2',headers=KEY).status_code==404
