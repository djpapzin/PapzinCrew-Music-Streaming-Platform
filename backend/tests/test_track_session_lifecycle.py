import pytest
from unittest.mock import Mock
from app.routers import tracks


def test_session_stays_open_until_request_finishes(monkeypatch):
    session=Mock()
    def dependency():
        try: yield session
        finally: session.close()
    monkeypatch.setattr(tracks,'get_db',dependency)
    request=tracks._get_db_dyn()
    assert next(request) is session
    session.close.assert_not_called()
    with pytest.raises(StopIteration): next(request)
    session.close.assert_called_once()


def test_session_closes_even_when_request_raises(monkeypatch):
    session=Mock()
    def dependency():
        try: yield session
        finally: session.close()
    monkeypatch.setattr(tracks,'get_db',dependency)
    request=tracks._get_db_dyn();next(request)
    with pytest.raises(RuntimeError): request.throw(RuntimeError('failed request'))
    session.close.assert_called_once()
