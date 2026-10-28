import hashlib
import json
from types import SimpleNamespace
from unittest.mock import MagicMock
import pytest
from tools import import_audio_cache as importer


@pytest.fixture
def importing(tmp_path,monkeypatch):
    data=b'verified mix bytes'
    root=tmp_path/'cache';incoming=tmp_path/'private-input.json'
    job={'id':234,'size':len(data),'file_hash':hashlib.sha256(data).hexdigest(),
         'download_url':'https://dl.dropboxusercontent.com/one-use-test'}
    incoming.write_text(json.dumps([job]));incoming.chmod(0o600)
    monkeypatch.setattr(importer.sys,'argv',['import_audio_cache.py',str(incoming)])
    monkeypatch.setattr(importer,'directory',lambda:root)
    monkeypatch.setattr(importer.shutil,'disk_usage',lambda root:SimpleNamespace(free=30000000000))
    response=MagicMock();response.status_code=200
    response.headers={'Content-Length':str(len(data))};response.iter_content.return_value=iter([data])
    response.__enter__.return_value=response
    download=MagicMock(return_value=response);monkeypatch.setattr(importer.requests,'get',download)
    seed=MagicMock();monkeypatch.setattr(importer,'seed',seed)
    return incoming,root,job,download,seed,response


def test_exact_copy_only_uses_single_get_and_removes_credentials_and_scratch(importing):
    incoming,root,job,download,seed,response=importing
    importer.main()
    assert download.call_count==1 and seed.call_count==1
    assert not incoming.exists() and not list(root.glob('*.part'))
    assert download.call_args.kwargs['allow_redirects'] is False


def test_mismatched_audio_never_reaches_seed(importing):
    incoming,root,job,download,seed,response=importing
    job['file_hash']='0'*64;incoming.write_text(json.dumps([job]))
    importer.main()
    assert not seed.called and not list(root.glob('*.part'))


def test_legacy_record_without_sha_still_requires_authoritative_b2_seed(importing):
    incoming,root,job,download,seed,response=importing
    job['file_hash']=None;incoming.write_text(json.dumps([job]))
    importer.main()
    assert seed.call_count==1


def test_untrusted_download_destination_is_rejected_before_network(importing):
    incoming,root,job,download,seed,response=importing
    job['download_url']='https://example.com/not-dropbox';incoming.write_text(json.dumps([job]))
    with pytest.raises(RuntimeError): importer.main()
    assert not download.called and not seed.called
