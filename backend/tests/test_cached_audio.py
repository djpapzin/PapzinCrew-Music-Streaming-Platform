import hashlib
import json
from types import SimpleNamespace
from unittest.mock import MagicMock
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.routers import cached_audio
from app.services import audio_cache


@pytest.fixture
def cache(tmp_path, monkeypatch):
    monkeypatch.setenv('ANONYMOUS_STATS_DIR',str(tmp_path/'stats'))
    monkeypatch.setenv('AUDIO_CACHE_DIR',str(tmp_path))
    monkeypatch.setenv('AUDIO_CACHE_SERVE_ENABLED','1')
    monkeypatch.setenv('AUDIO_DOWNLOADS_ENABLED','1')
    monkeypatch.setenv('AUDIO_CACHE_EGRESS_BYTES','10000')
    data=b'0123456789'*100
    sha=hashlib.sha256(data).hexdigest(); source='https://s3.us-east-005.backblazeb2.com/bucket/mix.m4a'
    item={'sha256':sha,'version':audio_cache.version(source),'size':len(data),'content_type':'audio/mp4'}
    (tmp_path/(sha+'.audio')).write_bytes(data)
    (tmp_path/'manifest.json').write_text(json.dumps({'234':item}))
    mix=SimpleNamespace(file_path=source,availability='public')
    db=MagicMock();db.query.return_value.filter.return_value.first.return_value=mix
    app=FastAPI();app.include_router(cached_audio.router)
    app.dependency_overrides[cached_audio.get_db]=lambda:db
    client=TestClient(app);url='/tracks/234/cached/'+item['version']
    return client,url,tmp_path,mix,db,data,item


def test_range_head_and_identity(cache):
    client,url,root,mix,db,data,item=cache
    response=client.head(url,headers={'Range':'bytes=100-199'})
    assert response.status_code==206 and response.content==b''
    assert response.headers['content-range']=='bytes 100-199/1000'
    assert not list(root.glob('egress-*.json'))
    response=client.get(url,headers={'Range':'bytes=100-199'})
    assert response.status_code==206 and response.content==data[100:200]
    assert response.headers['x-audio-source']=='vps-cache'
    assert db.close.called
    response=client.get(url,headers={'Range':'bytes=-7'})
    assert response.content==data[-7:]
    assert client.get(url).content==data


@pytest.mark.parametrize('availability',['private','unlisted','test'])
def test_nonpublic_never_served_or_advertised(cache,availability,monkeypatch):
    client,url,root,mix,db,data,item=cache
    mix.availability=availability
    monkeypatch.setenv('AUDIO_CACHE_PUBLIC_BASE','https://audio.djpapzin.com')
    assert client.get(url).status_code==404
    assert audio_cache.public_url(234,mix.file_path,availability) is None


def test_changed_source_missing_file_and_disabled_cache_fail_closed(cache,monkeypatch):
    client,url,root,mix,db,data,item=cache
    mix.file_path+='?changed'
    assert client.get(url).status_code==404
    mix.file_path=mix.file_path.removesuffix('?changed')
    monkeypatch.setenv('AUDIO_CACHE_SERVE_ENABLED','0')
    assert client.get(url).status_code==404
    monkeypatch.setenv('AUDIO_CACHE_SERVE_ENABLED','1')
    (root/(item['sha256']+'.audio')).write_bytes(b'broken')
    assert client.get(url).status_code==404


def test_monthly_budget_is_reserved_before_streaming_and_never_exceeded(cache,monkeypatch):
    client,url,root,mix,db,data,item=cache
    monkeypatch.setenv('AUDIO_CACHE_EGRESS_BYTES','1500')
    assert client.get(url).status_code==200
    assert client.get(url).status_code==429
    assert client.head(url).status_code==200
    ledger=json.loads(next(root.glob('egress-*.json')).read_text())
    assert ledger['reserved_bytes']==1000


@pytest.mark.parametrize('header',['bytes=1000-','bytes=20-10','bytes=0-1,5-6','bytes=-0','bytes=-','bytes='+'9'*200+'-'])
def test_invalid_ranges_do_not_consume_budget(cache,header):
    client,url,root,*_=cache
    response=client.get(url,headers={'Range':header})
    assert response.status_code==416
    assert response.headers['content-range']=='bytes */1000'
    assert not list(root.glob('egress-*.json'))


def test_etag_revalidation_and_if_range(cache):
    client,url,root,mix,db,data,item=cache
    etag='"'+item['sha256']+'"'
    assert client.get(url,headers={'If-None-Match':etag}).status_code==304
    response=client.get(url,headers={'Range':'bytes=0-9','If-Range':'"old"'})
    assert response.status_code==200 and response.content==data


def test_catalog_url_requires_both_feature_flags_and_current_cached_file(cache,monkeypatch):
    client,url,root,mix,db,data,item=cache
    assert audio_cache.public_url(234,mix.file_path,'public') is None
    monkeypatch.setenv('AUDIO_CACHE_PUBLIC_BASE','https://audio.djpapzin.com')
    assert audio_cache.public_url(234,mix.file_path,'public')=='https://audio.djpapzin.com'+url
    monkeypatch.setenv('AUDIO_CACHE_SERVE_ENABLED','0')
    assert audio_cache.public_url(234,mix.file_path,'public') is None


def test_download_requires_permission_and_reserves_same_egress_budget(cache):
    client,url,root,mix,db,data,item=cache
    assert client.get(url+'?download=1').status_code==404
    mix.allow_downloads='yes';mix.title='DJ mix / café\r\nUnsafe'
    response=client.head(url+'?download=1')
    assert response.status_code==200 and response.content==b''
    assert response.headers['content-disposition'].startswith('attachment;')
    assert 'filename*=UTF-8' in response.headers['content-disposition']
    assert not list(root.glob('egress-*.json')) and not db.commit.called
    response=client.get(url+'?download=1')
    assert response.status_code==200 and response.content==data
    assert db.commit.call_count==1
    assert json.loads(next(root.glob('egress-*.json')).read_text())['reserved_bytes']==len(data)
    response=client.get(url+'?download=1',headers={'Range':'bytes=500-'})
    assert response.status_code==206 and response.content==data[500:]
    assert db.commit.call_count==1


@pytest.mark.parametrize('visibility',['unlisted','private','test'])
def test_download_never_exposes_nonpublic_cached_files(cache,visibility):
    client,url,root,mix,db,data,item=cache
    mix.allow_downloads='yes';mix.availability=visibility
    assert client.get(url+'?download=1').status_code==404
    assert not db.commit.called and not list(root.glob('egress-*.json'))


def test_paused_downloads_block_old_links_but_keep_streaming(cache,monkeypatch):
    client,url,root,mix,db,data,item=cache
    mix.allow_downloads='yes'
    monkeypatch.delenv('AUDIO_DOWNLOADS_ENABLED',raising=False)
    for method in (client.get,client.head):
        response=method(url+'?download=1')
        assert response.status_code==503
    assert not list(root.glob('egress-*.json')) and not db.commit.called
    assert client.get(url).content==data
