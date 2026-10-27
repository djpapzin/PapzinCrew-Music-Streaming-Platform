import json
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.routers import usage

@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setenv('ANONYMOUS_STATS_DIR',str(tmp_path/'stats'));monkeypatch.setenv('ADMIN_API_KEY','owner-test')
    app=FastAPI();app.include_router(usage.router);return TestClient(app)

def test_aggregate_stats_are_private_and_store_no_identifiers(client):
    for payload in [{'kind':'visit','device':'mobile'},{'kind':'attempt','mix':237},{'kind':'start','mix':237,'value':2000},{'kind':'start','mix':237,'value':500,'resume':True},{'kind':'failed','mix':237},{'kind':'listen','mix':237,'value':15000}]:
        assert client.post('/usage',json={**payload,'ip':'not-saved','userAgent':'not-saved','name':'not-saved','url':'not-saved'}).status_code==202
    assert client.get('/admin/usage').status_code==403
    data=client.get('/admin/usage',headers={'X-Admin-Api-Key':'owner-test'}).json()['days'][0]
    assert data['visits']==1 and data['devices']=={'mobile':1}
    assert data['mixes']['237']=={'attempts':1,'starts':1,'failures':1,'startup_ms':2000,'startup_samples':1,'startup_buckets':[0,1,0,0,0,0],'listen_ms':15000,'resumes':1}
    raw=next(usage.directory().glob('*.json')).read_text()
    assert 'not-saved' not in raw and 'recent' not in raw

@pytest.mark.parametrize('payload',[{'kind':'unknown'},{'kind':'listen','mix':0},{'kind':'start','mix':1,'value':-1},{'kind':'visit','device':'raw-agent'}])
def test_invalid_events(client,payload): assert client.post('/usage',json=payload).status_code==422

def test_payload_and_listening_caps(client):
    assert client.post('/usage',content='x'*1025).status_code==413
    assert client.post('/usage',json={'kind':'listen','mix':237,'value':120000}).status_code==202
    data=client.get('/admin/usage',headers={'X-Admin-Api-Key':'owner-test'}).json()['days'][0]
    assert data['mixes']['237']['listen_ms']==30000
