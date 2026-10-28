"""Conservative once-daily cache fill; B2's account-level $0 caps stay authoritative.

Downloads at most 500 MB/day, never on a listener's cache miss. Reservations are
not refunded on errors. Any transfer failure stops the run; no immediate retry.
"""
import fcntl
import json
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, unquote
from app.db.database import SessionLocal
from app.models.models import Mix
from app.services.audio_cache import directory, entry
from app.services.b2_storage import B2Storage
from tools.seed_audio_cache import main as seed


def main():
    if os.getenv('AUDIO_CACHE_WARM_ENABLED') != '1':
        print('Cache warming disabled'); return
    root=directory();root.mkdir(parents=True,exist_ok=True,mode=0o700)
    with (root/'warm.lock').open('a') as lock:
        try: fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError: return
        budget=min(int(os.getenv('AUDIO_CACHE_FILL_BYTES','500000000')),500000000)
        day=datetime.now(timezone.utc).date().isoformat();ledger=root/f'fill-{day}.json'
        used=json.loads(ledger.read_text())['reserved_bytes'] if ledger.exists() else 0
        storage=B2Storage()
        if not storage.s3: raise RuntimeError('Existing B2 configuration unavailable')
        with SessionLocal() as db:
            mixes=[(m.id,m.file_path,m.availability) for m in db.query(Mix)
                   .filter((Mix.availability=='public') | (Mix.availability.is_(None)))
                   .order_by(Mix.play_count.desc(),Mix.id).all()]
        for ident,source,visibility in mixes:
            if used>=budget: break
            if (visibility or 'public')!='public': continue
            if entry(ident,source,visibility): continue
            origin=urlparse(source or '');endpoint=urlparse(storage.endpoint_url or '')
            prefix='/'+(storage.bucket or '')+'/'
            if origin.scheme!='https' or origin.netloc!=endpoint.netloc or not origin.path.startswith(prefix): continue
            key=unquote(origin.path[len(prefix):])
            head=storage.s3.head_object(Bucket=storage.bucket,Key=key)
            size=head['ContentLength']
            # Single-part MD5 ETags are required for a byte-exact seed.
            if '-' in head['ETag'] or not size or size>budget-used: continue
            occupied=sum(p.stat().st_size for p in root.glob('*.audio'))
            if occupied+size>12000000000 or shutil.disk_usage(root).free-2*size<15000000000: break
            used+=size
            temporary=ledger.with_suffix('.tmp')
            with temporary.open('w') as output:
                os.chmod(temporary,0o600);json.dump({'day':day,'reserved_bytes':used,'limit_bytes':budget},output)
                output.flush();os.fsync(output.fileno())
            temporary.replace(ledger)
            scratch=root/'warming.part'
            try:
                response=storage.s3.get_object(Bucket=storage.bucket,Key=key,IfMatch=head['ETag'])
                try:
                    with scratch.open('wb') as output:
                        os.chmod(scratch,0o600);remaining=size
                        while remaining:
                            chunk=response['Body'].read(min(1048576,remaining))
                            if not chunk: raise RuntimeError('Incomplete audio transfer')
                            output.write(chunk);remaining-=len(chunk)
                finally: response['Body'].close()
                sys.argv=['seed_audio_cache.py','--mix-id',str(ident),'--file',str(scratch)]
                seed()
            except BaseException:
                print(json.dumps({'mix':ident,'warming_stopped':True,'reservation_kept':True}))
                raise
            finally:
                scratch.unlink(missing_ok=True)
        print(json.dumps({'day':day,'reserved_download_bytes':used,'daily_limit_bytes':budget}))


if __name__=='__main__': main()
