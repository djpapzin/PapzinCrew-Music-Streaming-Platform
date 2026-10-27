"""Revocable, host-only owner sessions. Browser never stores the owner key."""
import hashlib
import hmac
import json
import os
import secrets
import time
from pathlib import Path
from fastapi import HTTPException, Request

COOKIE='__Host-papzin-owner'

def directory(): return Path(os.getenv('OWNER_SESSION_DIR','/var/lib/papzincrew/owner-sessions'))

def require_origin(request:Request):
    allowed={'https://crew.djpapzin.com','https://papzincrew.netlify.app'}
    allowed.update(origin.strip() for origin in os.getenv('OWNER_SESSION_ORIGINS','').split(',') if origin.strip())
    if request.headers.get('origin') not in allowed:
        raise HTTPException(403,'Owner session requests must come from the site itself.')

def key_hash(): return hashlib.sha256(os.getenv('ADMIN_API_KEY','').encode()).hexdigest()

def record_path(token):
    if not token or len(token)!=64 or any(c not in '0123456789abcdef' for c in token): return None
    return directory()/(hashlib.sha256(token.encode()).hexdigest()+'.json')

def valid(request:Request):
    path=record_path(request.cookies.get(COOKIE))
    if path is None or not path.exists(): return False
    try:
        record=json.loads(path.read_text())
        return record['expires']>time.time() and hmac.compare_digest(record['key_hash'],key_hash())
    except (ValueError,KeyError,OSError): return False

def create(remember):
    root=directory();root.mkdir(parents=True,exist_ok=True,mode=0o700)
    # Expired sessions contain only hashes; bound storage and invalidate key rotations.
    for path in root.glob('*.json'):
        try:
            record=json.loads(path.read_text())
            if record['expires']<time.time() or record['key_hash']!=key_hash(): path.unlink(missing_ok=True)
        except (ValueError,KeyError): path.unlink(missing_ok=True)
    if len(list(root.glob('*.json')))>=100: raise HTTPException(503,'Too many remembered devices. Sign out an existing device first.')
    token=secrets.token_hex(32);seconds=30*86400 if remember else 8*3600
    path=record_path(token)
    with path.open('x') as file:
        path.chmod(0o600);json.dump({'expires':time.time()+seconds,'key_hash':key_hash()},file)
    return token,seconds

def revoke(request):
    path=record_path(request.cookies.get(COOKIE))
    if path is not None: path.unlink(missing_ok=True)
