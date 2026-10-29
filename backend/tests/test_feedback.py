from uuid import uuid4
import json
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.routers import feedback

@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setenv('FEEDBACK_DIR',str(tmp_path/'inbox'))
    monkeypatch.setenv('ADMIN_API_KEY','owner-test')
    app=FastAPI();app.include_router(feedback.router)
    return TestClient(app)

def payload(**changes):
    data={'id':str(uuid4()),'message':'Play button did not start the mix','name':'Supa Nova','page':'/track/237?secret=test#private','device':'mobile'}
    data.update(changes);return data

def test_submission_is_private_and_retry_is_idempotent(client):
    data=payload();assert client.post('/feedback',json=data).status_code==201
    assert client.post('/feedback',json=data).status_code==201
    assert client.get('/admin/feedback').status_code==403
    assert client.get('/admin/feedback',headers={'X-Admin-Api-Key':'wrong'}).status_code==403
    reports=client.get('/admin/feedback',headers={'X-Admin-Api-Key':'owner-test'}).json()['reports']
    assert len(reports)==1 and reports[0]['page']=='/track/237'
    assert reports[0]['message']==data['message'] and 'website' not in reports[0]
    path=feedback.directory()/f"{data['id']}.json"
    assert path.stat().st_mode & 0o777==0o600
    assert client.get('/feedback').status_code==405

@pytest.mark.parametrize('changes',[{'message':'  a  '},{'message':'a'*3001},{'id':'../../bad'},{'device':'script'},{'name':'n'*81}])
def test_validation(client,changes):
    assert client.post('/feedback',json=payload(**changes)).status_code==422

def test_body_limit_and_honeypot(client):
    assert client.post('/feedback',content=b'x'*16001).status_code==413
    assert client.post('/feedback',json=payload(website='spam')).status_code==201
    assert not feedback.directory().exists()

def test_rate_cap_is_persistent_and_retries_still_work(client):
    first=payload();assert client.post('/feedback',json=first).status_code==201
    for _ in range(119): assert client.post('/feedback',json=payload()).status_code==201
    assert client.post('/feedback',json=payload()).status_code==429
    assert client.post('/feedback',json=first).status_code==201


@pytest.mark.parametrize('category',['problem','idea','improvement','removal','other'])
def test_categories_and_short_anonymous_messages(client,category):
    data=payload(category=category,message='Nice!',name='')
    assert client.post('/feedback',json=data).status_code==201
    report=client.get('/admin/feedback',headers={'X-Admin-Api-Key':'owner-test'}).json()['reports'][0]
    assert report['category']==category and report['status']=='new' and report['name']==''


def test_only_owner_can_triage_without_changing_message(client):
    data=payload(category='removal');client.post('/feedback',json=data)
    path='/admin/feedback/'+data['id']
    assert client.patch(path,json={'status':'done'}).status_code==403
    headers={'X-Admin-Api-Key':'owner-test'}
    for status in ['reviewed','done','new']:
        response=client.patch(path,json={'status':status},headers=headers)
        assert response.status_code==200
        assert response.json()['report']['status']==status
        assert response.json()['report']['message']==data['message']
    assert client.patch(path,json={'status':'deleted'},headers=headers).status_code==422
    assert client.patch('/admin/feedback/'+str(uuid4()),json={'status':'done'},headers=headers).status_code==404
    assert client.post('/feedback',json=payload(category='invalid')).status_code==422
