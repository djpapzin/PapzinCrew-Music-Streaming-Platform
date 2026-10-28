import io
import json
from types import SimpleNamespace
from unittest.mock import MagicMock
import pytest
from tools import warm_audio_cache as warm


@pytest.fixture
def job(tmp_path,monkeypatch):
    monkeypatch.setenv('AUDIO_CACHE_DIR',str(tmp_path))
    monkeypatch.setenv('AUDIO_CACHE_WARM_ENABLED','1')
    monkeypatch.setenv('AUDIO_CACHE_FILL_BYTES','10')
    db=MagicMock()
    source='https://s3.us-east-005.backblazeb2.com/bucket/'
    db.query.return_value.filter.return_value.order_by.return_value.all.return_value=[
        SimpleNamespace(id=i,file_path=source+str(i),availability='public') for i in (1,2)]
    session=MagicMock();session.__enter__.return_value=db
    monkeypatch.setattr(warm,'SessionLocal',lambda:session)
    s3=MagicMock();s3.head_object.return_value={'ContentLength':6,'ETag':'"abcdef"'}
    s3.get_object.side_effect=lambda **kwargs:{'Body':io.BytesIO(b'123456')}
    storage=SimpleNamespace(s3=s3,bucket='bucket',endpoint_url='https://s3.us-east-005.backblazeb2.com')
    monkeypatch.setattr(warm,'B2Storage',lambda:storage)
    monkeypatch.setattr(warm.shutil,'disk_usage',lambda root:SimpleNamespace(free=30_000_000_000))
    seed=MagicMock();monkeypatch.setattr(warm,'seed',seed)
    return tmp_path,s3,seed,db


def test_warming_stays_within_daily_reservation_and_does_not_refetch(job):
    root,s3,seed,db=job
    warm.main();warm.main()
    assert s3.get_object.call_count==1 and seed.call_count==1
    assert json.loads(next(root.glob('fill-*.json')).read_text())['reserved_bytes']==6
    assert not (root/'warming.part').exists()


def test_failed_transfer_stops_and_keeps_reservation(job):
    root,s3,seed,db=job
    s3.get_object.side_effect=RuntimeError('download cap reached')
    with pytest.raises(RuntimeError): warm.main()
    assert s3.get_object.call_count==1 and not seed.called
    assert json.loads(next(root.glob('fill-*.json')).read_text())['reserved_bytes']==6


def test_disabled_job_has_no_network_calls(job,monkeypatch):
    root,s3,seed,db=job
    monkeypatch.setenv('AUDIO_CACHE_WARM_ENABLED','0')
    warm.main()
    assert not s3.head_object.called and not s3.get_object.called


def test_nonpublic_never_downloaded_even_if_selected(job):
    root,s3,seed,db=job
    for mix in db.query.return_value.filter.return_value.order_by.return_value.all.return_value:
        mix.availability='unlisted'
    warm.main()
    assert not s3.head_object.called and not s3.get_object.called


@pytest.mark.parametrize('url,expected', [
    ('https://s3.us-east-005.backblazeb2.com/bucket/a%20b.mp3','a b.mp3'),
    ('https://f005.backblazeb2.com/file/bucket/a%20b.mp3','a b.mp3'),
    ('https://f006.backblazeb2.com/file/bucket/a.mp3',None),
    ('https://f005.backblazeb2.com/file/other/a.mp3',None),
    ('https://evil.example/file/bucket/a.mp3',None),
    ('https://f005.backblazeb2.com/file/bucket/a.mp3?x=1',None),
])
def test_source_bucket_boundary(url,expected):
    storage=SimpleNamespace(bucket='bucket',endpoint_url='https://s3.us-east-005.backblazeb2.com')
    assert warm.source_key(url,storage)==expected
