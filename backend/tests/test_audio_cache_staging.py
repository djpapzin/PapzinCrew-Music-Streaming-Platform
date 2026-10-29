import hashlib
import json
from types import SimpleNamespace
from unittest.mock import MagicMock
import pytest
from tools import seed_audio_cache as seed
from app.services import audio_cache


def test_reviewed_unlisted_seed_stays_invisible_and_does_not_publish(tmp_path,monkeypatch):
    payload=b'checked original quality audio'
    source='https://s3.us-east-005.backblazeb2.com/bucket/audio.m4a'
    audio=tmp_path/'original.m4a';audio.write_bytes(payload)
    root=tmp_path/'cache';monkeypatch.setenv('AUDIO_CACHE_DIR',str(root))
    monkeypatch.setenv('AUDIO_CACHE_PUBLIC_BASE','https://audio.djpapzin.com')
    monkeypatch.setenv('AUDIO_CACHE_SERVE_ENABLED','1')
    mix=SimpleNamespace(file_path=source,availability='unlisted')
    db=MagicMock();db.query.return_value.filter.return_value.first.return_value=mix
    session=MagicMock();session.__enter__.return_value=db
    monkeypatch.setattr(seed,'SessionLocal',lambda:session)
    s3=MagicMock();s3.head_object.return_value={'ContentLength':len(payload),'ETag':hashlib.md5(payload).hexdigest(),'ContentType':'audio/mp4'}
    monkeypatch.setattr(seed,'B2Storage',lambda:SimpleNamespace(s3=s3,bucket='bucket',endpoint_url='https://s3.us-east-005.backblazeb2.com'))
    monkeypatch.setattr(seed.shutil,'disk_usage',lambda _:SimpleNamespace(free=30_000_000_000))
    argv=['seed','--mix-id','999','--file',str(audio)]
    monkeypatch.setattr('sys.argv',argv)
    with pytest.raises(SystemExit): seed.main()
    assert not s3.head_object.called
    monkeypatch.setattr('sys.argv',argv+['--reviewed-unlisted']);seed.main()
    assert json.loads((root/'manifest.json').read_text())['999']['size']==len(payload)
    assert mix.availability=='unlisted' and not db.commit.called
    assert audio_cache.public_url(999,source,'unlisted') is None
    assert audio_cache.entry(999,source,'unlisted') is None
    assert audio_cache.public_url(999,source,'public') is not None
    assert not s3.get_object.called and not s3.put_object.called
