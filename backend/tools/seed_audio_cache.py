"""Seed a public mix from a local copy after matching its B2 size and MD5 ETag.

No audio is downloaded and no Backblaze object is written or deleted.
Run manually with the existing backend environment, --mix-id ID --file PATH.
"""
import argparse
import fcntl
import hashlib
import json
import os
import shutil
from urllib.parse import urlparse, unquote
from pathlib import Path
from app.db.database import SessionLocal
from app.models.models import Mix
from app.services.audio_cache import directory, version
from app.services.b2_storage import B2Storage


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mix-id', required=True, type=int)
    parser.add_argument('--file', required=True, type=Path)
    args = parser.parse_args()
    with SessionLocal() as db:
        mix = db.query(Mix).filter(Mix.id == args.mix_id).first()
        if not mix or (mix.availability or 'public') != 'public':
            raise SystemExit('Only current public mixes may be cached')
        source = mix.file_path
    storage = B2Storage()
    origin, endpoint = urlparse(source), urlparse(storage.endpoint_url or '')
    prefix = '/' + (storage.bucket or '') + '/'
    if not storage.s3 or origin.scheme != 'https' or origin.netloc != endpoint.netloc or not origin.path.startswith(prefix):
        raise SystemExit('Source must be in the existing Backblaze bucket')
    size = args.file.stat().st_size
    sha = hashlib.sha256(); md5 = hashlib.md5()
    with args.file.open('rb') as audio:
        for chunk in iter(lambda: audio.read(1024*1024), b''):
            sha.update(chunk); md5.update(chunk)
    head = storage.s3.head_object(Bucket=storage.bucket, Key=unquote(origin.path[len(prefix):]))
    if head['ContentLength'] != size or head['ETag'].strip('"') != md5.hexdigest():
        raise SystemExit('Local copy does not match B2 exactly; cache unchanged')
    root = directory(); root.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (root/'seed.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        manifest = root/'manifest.json'
        data = json.loads(manifest.read_text()) if manifest.exists() else {}
        occupied = sum(p.stat().st_size for p in root.glob('*.audio'))
        target = root/(sha.hexdigest()+'.audio')
        capacity = min(int(os.getenv('AUDIO_CACHE_DISK_BYTES','12000000000')),12000000000)
        if not target.exists():
            if occupied+size > capacity or shutil.disk_usage(root).free-size < 15_000_000_000:
                raise SystemExit('Cache disk safety limit reached')
            temporary = target.with_suffix('.part')
            with args.file.open('rb') as audio, temporary.open('wb') as output:
                os.chmod(temporary,0o600); shutil.copyfileobj(audio,output)
                output.flush(); os.fsync(output.fileno())
            copied = hashlib.sha256()
            with temporary.open('rb') as audio:
                for chunk in iter(lambda: audio.read(1024*1024), b''):
                    copied.update(chunk)
            if copied.hexdigest() != sha.hexdigest():
                temporary.unlink(); raise SystemExit('Copy verification failed')
            temporary.replace(target)
        else:
            existing = hashlib.sha256()
            with target.open('rb') as audio:
                for chunk in iter(lambda: audio.read(1024*1024), b''):
                    existing.update(chunk)
            if existing.hexdigest() != sha.hexdigest():
                raise SystemExit('Existing cached file failed verification; cache unchanged')
        data[str(args.mix_id)] = {'version':version(source),'sha256':sha.hexdigest(),
                                 'size':size,'content_type':head.get('ContentType','audio/mp4')}
        temporary = manifest.with_suffix('.tmp')
        with temporary.open('w') as output:
            os.chmod(temporary,0o600); json.dump(data,output); output.flush(); os.fsync(output.fileno())
        temporary.replace(manifest)
    print(json.dumps({'mix':args.mix_id,'bytes':size,'verified_identical_to_b2':True}))


if __name__ == '__main__':
    main()
