import json
import time
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.routers.admin import router
from app.services import owner_sessions as sessions

@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setenv('ADMIN_API_KEY','owner-test-secret')
    monkeypatch.setenv('OWNER_SESSION_DIR',str(tmp_path/'sessions'))
    app=FastAPI();app.include_router(router)
    return TestClient(app,base_url='https://crew.djpapzin.com')

def login(client,remember=True):
    return client.post('/admin/session',params={'remember':str(remember).lower()},headers={'Origin':'https://crew.djpapzin.com','X-Admin-Api-Key':'owner-test-secret'})

def test_remembered_session_is_secure_private_and_revoked(client):
    assert not client.get('/admin/session').json()['authenticated']
    response=login(client)
    assert response.status_code==200
    cookie=response.headers['set-cookie']
    assert 'HttpOnly' in cookie and 'Secure' in cookie and 'SameSite=strict' in cookie and 'Max-Age=2592000' in cookie
    assert 'Domain=' not in cookie and 'Path=/' in cookie
    assert client.get('/admin/session').json()['authenticated']
    token=client.cookies.get(sessions.COOKIE)
    raw=next(sessions.directory().glob('*.json')).read_text()
    assert token not in raw and 'owner-test-secret' not in raw
    assert client.delete('/admin/session',headers={'Origin':'https://evil.example'}).status_code==403
    assert client.delete('/admin/session',headers={'Origin':'https://crew.djpapzin.com'}).status_code==200
    assert not client.get('/admin/session').json()['authenticated']
    client.cookies.set(sessions.COOKIE,token)
    assert not client.get('/admin/session').json()['authenticated']


def test_bad_keys_and_cross_site_login_are_rejected(client):
    assert client.post('/admin/session',headers={'Origin':'https://crew.djpapzin.com','X-Admin-Api-Key':'wrong'}).status_code==403
    assert client.post('/admin/session',headers={'Origin':'https://evil.example','X-Admin-Api-Key':'owner-test-secret'}).status_code==403
    assert client.post('/admin/session',headers={'X-Admin-Api-Key':'owner-test-secret'}).status_code==403


def test_short_session_expiry_and_key_rotation(client,monkeypatch):
    response=login(client,False)
    assert 'Max-Age=' not in response.headers['set-cookie']
    path=next(sessions.directory().glob('*.json'));data=json.loads(path.read_text());data['expires']=time.time()-1;path.write_text(json.dumps(data))
    assert not client.get('/admin/session').json()['authenticated']
    login(client)
    monkeypatch.setenv('ADMIN_API_KEY','rotated-key')
    assert not client.get('/admin/session').json()['authenticated']


def test_cookie_protects_private_routes_and_mutations_require_origin(client):
    from fastapi import Depends
    from app.routers.admin import require_admin_api_key
    @client.app.get('/admin/test-private')
    def read(_=Depends(require_admin_api_key)): return {'private':True}
    @client.app.post('/admin/test-private')
    def write(_=Depends(require_admin_api_key)): return {'private':True}
    assert client.get('/admin/test-private').status_code==403
    login(client)
    response=client.get('/admin/test-private')
    assert response.status_code==200 and response.headers['cache-control']=='private, no-store'
    assert client.post('/admin/test-private').status_code==403
    assert client.post('/admin/test-private',headers={'Origin':'https://crew.djpapzin.com'}).status_code==200
