"""Range-aware delivery from a bounded, pre-seeded VPS cache."""
import fcntl
import json
import os
import re
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from ..db.database import get_db
from ..models.models import Mix
from ..services.audio_cache import directory, entry

router = APIRouter(tags=['cached audio'])


def byte_range(header, size):
    if not header:
        return 0, size - 1, 200
    match = re.fullmatch(r'bytes=(\d*)-(\d*)', header) if len(header) < 128 else None
    if not match or not any(match.groups()):
        raise HTTPException(416, 'Invalid byte range', headers={'Content-Range': f'bytes */{size}'})
    first, last = match.groups()
    if not first:
        length = int(last)
        start, end = max(0, size-length), size-1
        if length == 0:
            start = size
    else:
        start, end = int(first), min(int(last), size-1) if last else size-1
    if start >= size or end < start:
        raise HTTPException(416, 'Range unavailable', headers={'Content-Range': f'bytes */{size}'})
    return start, end, 206


def reserve_egress(length):
    # Reserve the entire response before sending, even if a client disconnects.
    # This deliberately overcounts interrupted transfers and never refunds them.
    root = directory(); month = datetime.now(timezone.utc).strftime('%Y-%m')
    budget = min(int(os.getenv('AUDIO_CACHE_EGRESS_BYTES', '500000000000')), 500000000000)
    with (root / 'egress.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        path = root / f'egress-{month}.json'
        used = json.loads(path.read_text())['reserved_bytes'] if path.exists() else 0
        if used + length > budget:
            raise HTTPException(429, 'Monthly cached playback allowance reached')
        temporary = path.with_suffix('.tmp')
        with temporary.open('w') as output:
            os.chmod(temporary, 0o600)
            json.dump({'month': month, 'reserved_bytes': used+length, 'limit_bytes': budget}, output)
            output.flush(); os.fsync(output.fileno())
        temporary.replace(path)


@router.api_route('/tracks/{mix_id}/cached/{source_version}', methods=['GET', 'HEAD'])
def cached_audio(mix_id: int, source_version: str, request: Request, db: Session = Depends(get_db)):
    if os.getenv('AUDIO_CACHE_SERVE_ENABLED') != '1':
        raise HTTPException(404, 'Cached audio unavailable')
    try:
        mix = db.query(Mix).filter(Mix.id == mix_id).first()
        item = entry(mix_id, mix.file_path, mix.availability) if mix else None
    finally:
        # Never hold a database connection while a listener streams a long mix.
        db.close()
    if not item or source_version != item['version']:
        raise HTTPException(404, 'Cached audio unavailable')
    size = item['size']; etag = '"' + item['sha256'] + '"'
    headers = {'Accept-Ranges': 'bytes', 'ETag': etag,
               'Cache-Control': 'private, max-age=0, must-revalidate',
               'X-Content-Type-Options': 'nosniff', 'X-Audio-Source': 'vps-cache'}
    if request.headers.get('if-none-match') == etag:
        return Response(status_code=304, headers=headers)
    wanted = request.headers.get('range')
    if request.headers.get('if-range') not in (None, etag):
        wanted = None
    start, end, status = byte_range(wanted, size)
    length = end-start+1
    headers['Content-Length'] = str(length)
    if status == 206:
        headers['Content-Range'] = f'bytes {start}-{end}/{size}'
    media_type = item.get('content_type', 'application/octet-stream')
    if request.method == 'HEAD':
        return Response(status_code=status, headers=headers, media_type=media_type)
    reserve_egress(length)
    def chunks():
        with item['path'].open('rb') as audio:
            audio.seek(start); remaining = length
            while remaining:
                chunk = audio.read(min(65536, remaining))
                if not chunk: break
                remaining -= len(chunk)
                yield chunk
    return StreamingResponse(chunks(), status_code=status, headers=headers, media_type=media_type)
