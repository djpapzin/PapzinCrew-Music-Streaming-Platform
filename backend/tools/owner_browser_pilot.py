"""Inactive operator tool: one authenticated browser request, never public intake.

Run only under the explicit approval and prerequisites in docs/owner-browser-pilot.md.
The gateway has no catalog, admin, arbitrary proxy or credential bootstrap routes.
"""
import argparse
import asyncio
import hashlib
import hmac
import json
import logging
import os
from pathlib import Path
import secrets
import subprocess
import sys
import time

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from starlette.concurrency import run_in_threadpool
from starlette.exceptions import HTTPException
from starlette.formparsers import MultiPartException

ORIGIN = 'https://audio.djpapzin.com'
PREFIX = '/intake/pilot'
MAX_BODY = 27 * 1024 * 1024
AUDIO = ('5dcb8b8c0d5e8cfbc593a28a27f26e2c4d86179ff7389f95345e3ab994056257', 26460044)
COVER = ('2a06873538a19bef362d68251acbdfed72756a7ade64d0fb599bb62dcadcf70a', 8042)
TITLE = 'TEST ONLY Large Browser Pilot 20261112'
PAGE = '''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Owner upload pilot</title></head>
<body><h1>Owner upload pilot — TEST ONLY</h1><p>One attempt. Synthetic fixtures only. Community uploads stay paused. Do not retry an uncertain result.</p>
<form id="pilot"><p><label>One-time credential <input id="credential" type="password" autocomplete="off" required></label></p>
<p><label>Synthetic WAV <input id="audio" type="file" accept=".wav" required></label></p>
<p><label>Test cover JPEG <input id="cover" type="file" accept=".jpg,.jpeg" required></label></p>
<button id="submit">Submit one unlisted test</button></form><p id="status" role="status">Not submitted</p>
<script src="/intake/pilot/page.js"></script></body></html>'''
SCRIPT = '''document.getElementById('pilot').addEventListener('submit', e => {
 e.preventDefault(); const button=document.getElementById('submit'); button.disabled=true;
 const data=new FormData(); data.append('file',document.getElementById('audio').files[0]); data.append('cover_art',document.getElementById('cover').files[0]);
 const xhr=new XMLHttpRequest(); xhr.open('POST','/intake/pilot/upload');
 xhr.setRequestHeader('Authorization','Bearer '+document.getElementById('credential').value);
 document.getElementById('credential').value=''; xhr.timeout=900000;
 xhr.upload.onprogress=e=>{document.getElementById('status').textContent=e.lengthComputable?'Uploading '+Math.round(100*e.loaded/e.total)+'%':'Uploading';};
 xhr.onload=()=>{document.getElementById('status').textContent=xhr.status===201?'Saved unlisted: '+xhr.responseText:'STOP — do not retry. HTTP '+xhr.status;};
 xhr.onerror=xhr.ontimeout=()=>{document.getElementById('status').textContent='Uncertain result — STOP. Owner must inspect storage and catalog. Do not retry.';};
 xhr.send(data);
});'''


class TooLarge(MultiPartException):
    def __init__(self):
        super().__init__("Body too large")


def create_gateway(secret, expires, latch, uploader, origin=ORIGIN):
    """uploader receives validated spooled files. No production imports in tests."""
    if len(secret) < 32:
        raise ValueError('Use a high-entropy credential')
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    latch = Path(latch)

    @app.middleware('http')
    async def policy(request, call_next):
        if time.time() >= expires:
            return JSONResponse({'detail': 'Pilot expired'}, 410)
        if request.method == 'POST':
            # Reject BEFORE consuming any part of an unauthenticated body.
            auth = request.headers.get('authorization', '')
            if not hmac.compare_digest(auth.encode(), ('Bearer ' + secret).encode()):
                return JSONResponse({'detail': 'Unauthorized'}, 401)
            if request.headers.get('origin') != origin:
                return JSONResponse({'detail': 'Origin rejected'}, 403)
            try:
                length = int(request.headers.get('content-length', '0'))
            except ValueError:
                length = -1
            if length < 0 or length > MAX_BODY:
                return JSONResponse({'detail': 'Body too large'}, 413)
        response = await call_next(request)
        response.headers.update({'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
                                 'Referrer-Policy': 'no-referrer',
                                 'Content-Security-Policy': "default-src 'none'; script-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'"})
        return response

    @app.get(PREFIX, response_class=HTMLResponse)
    async def page():
        return PAGE

    @app.get(PREFIX + '/page.js')
    async def script():
        from starlette.responses import Response
        return Response(SCRIPT, media_type='text/javascript')

    @app.post(PREFIX + '/upload')
    async def upload(request: Request):
        # O_EXCL is atomic across threads/processes and survives worker restarts.
        # Consume the attempt before parsing; failures always require inspection.
        try:
            fd = os.open(latch, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError:
            return JSONResponse({'detail': 'Attempt already consumed; do not retry'}, 409)
        with os.fdopen(fd, 'w') as f:
            f.write('attempt consumed\n'); f.flush(); os.fsync(f.fileno())
        directory_fd = os.open(latch.parent, os.O_RDONLY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
        original_receive = request._receive
        received = 0

        async def bounded_receive():
            nonlocal received
            message = await original_receive()
            received += len(message.get('body', b''))
            if received > MAX_BODY:
                raise TooLarge()
            return message

        request._receive = bounded_receive
        try:
            async with request.form(max_files=2, max_fields=0) as form:
                if len(form.multi_items()) != 2 or set(form.keys()) != {'file', 'cover_art'}:
                    raise ValueError('Exactly two fixture files required')
                for key, (digest, size) in [('file', AUDIO), ('cover_art', COVER)]:
                    f = form[key]
                    if not hasattr(f, 'file'):
                        raise ValueError('Expected file')
                    hasher = hashlib.sha256(); count = 0
                    while chunk := await f.read(65536):
                        count += len(chunk)
                        if count > size:
                            raise ValueError('Fixture too large')
                        hasher.update(chunk)
                    if count != size or hasher.hexdigest() != digest:
                        raise ValueError('Fixture mismatch')
                    await f.seek(0)
                if time.time() >= expires:
                    return JSONResponse({'detail': 'Pilot expired; attempt consumed'}, 410)
                result = await run_in_threadpool(uploader, form['file'].file, form['cover_art'].file)
                if result.get('storage') != 'b2' or result.get('availability') != 'unlisted':
                    raise RuntimeError('Policy failed; inspect storage')
                return JSONResponse({'id': result['id'], 'availability': 'unlisted'}, 201)
        except TooLarge:
            return JSONResponse({'detail': 'Body too large; attempt consumed'}, 413)
        except (ValueError, HTTPException):
            if received > MAX_BODY:
                return JSONResponse({'detail': 'Body too large; attempt consumed'}, 413)
            return JSONResponse({'detail': 'Fixture rejected; attempt consumed'}, 400)
        except Exception:
            # Deliberately never echo storage exceptions, credentials or URLs.
            return JSONResponse({'detail': 'Uncertain result; inspect storage and catalog; do not retry'}, 502)

    return app


def configure_process():
    # Worker configuration must never expand this process's write budget.
    os.environ.update(UPLOADS_ENABLED='1', ENFORCE_B2_ONLY='1',
                      B2_MAX_RETRIES='1', B2_COVER_MAX_RETRIES='1', B2_MAX_ATTEMPTS='0',
                      DB_AUTO_MIGRATE='0', BACKFILL_TRACK_DURATIONS='0')


class B2OnlyCover:
    """Process-local replacement: one cover PUT, no local or AI fallback."""
    def __init__(self, b2):
        self.b2 = b2
        self.attempted = False
        self.url = None

    async def __call__(self, cover_bytes, base_name, upload_dir, source='unknown'):
        if self.attempted:
            raise RuntimeError('Cover attempt already consumed')
        self.attempted = True
        if source != 'uploaded' or not self.b2.is_configured():
            raise RuntimeError('B2 cover required')
        key = f'covers/{base_name}-cover.jpg'
        result = await asyncio.to_thread(self.b2.put_bytes_safe, key, cover_bytes, 'image/jpeg')
        expected = f'{self.b2.endpoint_url}/{self.b2.bucket}/{key}'
        if not result.get('ok') or result.get('url') != expected:
            raise RuntimeError('B2 cover not confirmed; do not retry')
        self.url = expected
        return self.url


def require_finalized_cover(row, cover):
    # TestClient waits for Starlette background processing. Its failures are
    # best-effort in the regular handler, so explicitly inspect the committed row.
    if row is None or not cover.url or row.cover_art_url != cover.url:
        raise RuntimeError('Finalized B2 cover not confirmed; do not retry')
    if row.availability != 'unlisted' or row.title != TITLE or row.file_hash != AUDIO[0]:
        raise RuntimeError('Finalized pilot row does not match policy')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--serve-approved', action='store_true')
    parser.add_argument('--provider-caps-verified', action='store_true')
    parser.add_argument('--state-dir', required=True)
    args = parser.parse_args()
    if not args.serve_approved or not args.provider_caps_verified:
        parser.error('Deployment and single-write approval plus current caps verification required')
    root = Path(args.state_dir)
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    if root.stat().st_mode & 0o077:
        raise RuntimeError('State directory must be private')
    # Never overwrite a credential, reset expiry or clear a consumed attempt.
    credential = root / 'credential'
    fd = os.open(credential, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    secret = secrets.token_urlsafe(48)
    with os.fdopen(fd, 'w') as f:
        f.write(secret)
    pid = subprocess.check_output(['systemctl', 'show', 'papzincrew-backend.service', '-p', 'MainPID', '--value'], text=True).strip()
    env = dict(item.split(b'=', 1) for item in Path('/proc', pid, 'environ').read_bytes().split(b'\0') if b'=' in item)
    if env.get(b'UPLOADS_ENABLED') != b'0':
        raise RuntimeError('Public worker must remain paused')
    os.environ.update({k.decode(): v.decode() for k, v in env.items()})
    configure_process()
    logging.disable(logging.CRITICAL)
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from app.db.database import SessionLocal
    from app.models.models import Mix
    from app.services.b2_storage import B2Storage
    b2 = B2Storage()
    if b2.mode != 's3' or not b2.check_health().get('ok'):
        raise RuntimeError('B2 unavailable')
    with SessionLocal() as db:
        if db.query(Mix.id).filter((Mix.file_hash == AUDIO[0]) | (Mix.title == TITLE)).first():
            raise RuntimeError('Fixture already exists; do not repeat')
    from app.main import app
    from app.routers import uploads
    cover_writer = B2OnlyCover(b2)
    uploads._save_cover_art = cover_writer
    from app.services.ai_art_generator import AIArtGenerator
    AIArtGenerator.generate_cover_art_from_metadata = lambda *a, **k: None
    from fastapi.testclient import TestClient
    client = TestClient(app, raise_server_exceptions=False)

    def uploader(audio, cover):
        response = client.post('/upload', data={'title': TITLE, 'artist_name': 'Papzin Crew QA', 'description': 'TEST ONLY synthetic silence. Never publish.', 'availability': 'unlisted', 'allow_downloads': 'no'}, files={'file': ('test-only-large-pilot.wav', audio, 'audio/wav'), 'cover_art': ('test-only-cover.jpg', cover, 'image/jpeg')})
        if response.status_code != 201:
            raise RuntimeError('Upload not confirmed')
        result = response.json()
        with SessionLocal() as db:
            require_finalized_cover(db.get(Mix, result['id']), cover_writer)
        (root / 'receipt.json').write_text(json.dumps({'id': result['id'], 'availability': result.get('availability'), 'storage': result.get('storage')}))
        (root / 'receipt.json').chmod(0o600)
        return result

    import uvicorn
    uvicorn.run(create_gateway(secret, time.time() + 1200, root / 'attempt', uploader), host='127.0.0.1', port=18883, access_log=False, log_level='critical')


if __name__ == '__main__':
    main()
