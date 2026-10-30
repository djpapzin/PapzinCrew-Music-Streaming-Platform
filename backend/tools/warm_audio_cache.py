"""Conservative once-daily cache fill; B2's account-level $0 caps stay authoritative.

Downloads at most 500 MB/day, never on a listener's cache miss. Reservations are
not refunded on errors. Any transfer failure stops the run; no immediate retry.
"""
import fcntl
import json
import os
import shutil
import sys
from botocore.exceptions import ClientError
from datetime import datetime, timezone
from pathlib import Path
from app.db.database import SessionLocal
from app.models.models import Mix
from app.services.audio_cache import directory, entry
from app.services.b2_storage import B2Storage
from tools.seed_audio_cache import main as seed, source_key


def failure_priorities():
    """Prioritize reported playback failures in the existing daily fill budget."""
    root=Path(os.getenv('ANONYMOUS_STATS_DIR','/var/lib/papzincrew/anonymous-stats'))
    counts={}
    try:
        paths=sorted(root.glob('????-??-??.json'))[-2:]
    except OSError:
        return counts
    for path in paths:
        try:
            for ident, stats in json.loads(path.read_text()).get('mixes',{}).items():
                counts[int(ident)]=counts.get(int(ident),0)+int(stats.get('failures',0))
        except (OSError,ValueError,TypeError):
            continue
    return counts


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
        priorities=failure_priorities()
        mixes.sort(key=lambda item:-priorities.get(item[0],0))
        for ident,source,visibility in mixes:
            if used>=budget: break
            if (visibility or 'public')!='public': continue
            if entry(ident,source,visibility): continue
            key=source_key(source,storage)
            if key is None: continue
            try:
                head=storage.s3.head_object(Bucket=storage.bucket,Key=key)
            except ClientError as error:
                if error.response.get('ResponseMetadata',{}).get('HTTPStatusCode') == 404 or error.response.get('Error',{}).get('Code') in ('404','NoSuchKey','NotFound'):
                    print(json.dumps({'mix':ident,'warming_skipped':True,'reason':'source_missing'}),flush=True)
                    continue
                # Authentication, quota and other service failures still stop
                # the run; do not retry transfers or relax the free allowance.
                raise
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
