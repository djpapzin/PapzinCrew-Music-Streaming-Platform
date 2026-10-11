import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.models.models import Base
from app.db.database import get_db
from app.routers.auth import router

pytestmark = pytest.mark.filterwarnings("ignore:datetime.datetime.utcnow:DeprecationWarning:jose.jwt")

@pytest.fixture
def client():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    app = FastAPI()
    app.include_router(router)
    def database():
        with Session(engine) as db:
            yield db
    app.dependency_overrides[get_db] = database
    with TestClient(app) as client:
        yield client


def test_register_login_and_authenticated_profile(client):
    payload = {'email': 'demo@example.com', 'username': 'demo_listener', 'password': 'test-password-123'}
    assert client.post('/auth/register', json=payload).status_code == 201
    response = client.post('/auth/login', json={'identifier': 'demo@example.com', 'password': payload['password']})
    assert response.status_code == 200
    profile = client.get('/auth/profile', headers={'Authorization': f"Bearer {response.json()['access_token']}"})
    assert profile.status_code == 200
    assert profile.json()['username'] == 'demo_listener'
    assert 'password_hash' not in profile.json()


def test_invalid_credentials_and_duplicate_registration(client):
    payload = {'email': 'demo@example.com', 'username': 'demo_listener', 'password': 'test-password-123'}
    assert client.post('/auth/register', json=payload).status_code == 201
    assert client.post('/auth/register', json=payload).status_code == 409
    assert client.post('/auth/login', json={'identifier': 'demo@example.com', 'password': 'wrong-password'}).status_code == 401
    assert client.get('/auth/profile').status_code == 401
