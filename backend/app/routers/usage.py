"""Anonymous daily aggregates only; never store IPs, agents, URLs or visitor IDs."""
import fcntl
import json
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, ValidationError
from .admin import require_admin_api_key
from ..db.database import get_db
from ..models.models import Mix
from sqlalchemy.orm import Session

router=APIRouter(tags=['usage'])
def directory(): return Path(os.getenv('ANONYMOUS_STATS_DIR','/var/lib/papzincrew/anonymous-stats'))

class Event(BaseModel):
    kind: Literal['visit','attempt','start','failed','listen']
    mix: int = Field(default=0,ge=0,le=10000000)
    value: int = Field(default=0,ge=0,le=120000)
    resume: bool = False
    device: Literal['mobile','desktop','unknown'] = 'unknown'

@router.post('/usage',status_code=202)
async def collect(request:Request):
    raw=bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw)>1024: raise HTTPException(413,'Event too large')
    try: event=Event.model_validate_json(bytes(raw))
    except ValidationError: raise HTTPException(422,'Invalid anonymous event')
    if event.kind!='visit' and not event.mix: raise HTTPException(422,'Mix required')
    root=directory();root.mkdir(parents=True,exist_ok=True,mode=0o700)
    now=datetime.now(timezone.utc);day=now.date().isoformat()
    with (root/'stats.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        path=root/f'{day}.json'
        data=json.loads(path.read_text()) if path.exists() else {'day':day,'events':0,'visits':0,'devices':{},'mixes':{}}
        if data['events']>=50000: raise HTTPException(429,'Daily analytics capacity reached')
        data['events']+=1
        if event.kind=='visit':
            data['visits']+=1;data['devices'][event.device]=data['devices'].get(event.device,0)+1
        else:
            key=str(event.mix)
            if key not in data['mixes'] and len(data['mixes'])>=5000: raise HTTPException(429,'Mix capacity reached')
            mix=data['mixes'].setdefault(key,{'attempts':0,'starts':0,'failures':0,'startup_ms':0,'startup_samples':0,'startup_buckets':[0]*6,'listen_ms':0,'resumes':0})
            if event.kind=='attempt': mix['attempts']+=1
            elif event.kind=='failed': mix['failures']+=1
            elif event.kind=='listen': mix['listen_ms']+=min(event.value,120000)
            elif event.resume: mix['resumes']+=1
            else:
                mix['starts']+=1;mix['startup_ms']+=event.value;mix['startup_samples']+=1
                bucket=next((i for i,bound in enumerate((1000,3000,5000,10000,30000)) if event.value<=bound),5)
                mix['startup_buckets'][bucket]+=1
        temporary=path.with_suffix('.tmp')
        with temporary.open('w') as file:
            os.chmod(temporary,0o600);json.dump(data,file);file.flush();os.fsync(file.fileno())
        temporary.replace(path)
        # Retain daily aggregates for 30 days; no event identifiers are stored.
        cutoff=(now.date()-timedelta(days=29)).isoformat()
        for old in root.glob('????-??-??.json'):
            if old.stem<cutoff: old.unlink()
    return {'accepted':True}

@router.get('/admin/usage')
def stats(_:None=Depends(require_admin_api_key)):
    root=directory();days=[]
    if root.exists():
        with (root/'stats.lock').open('a') as lock:
            fcntl.flock(lock,fcntl.LOCK_SH)
            cutoff=(datetime.now(timezone.utc).date()-timedelta(days=29)).isoformat()
            for path in sorted(root.glob('????-??-??.json')):
                if path.stem>=cutoff:
                    data=json.loads(path.read_text());data.pop('recent',None);data.pop('events',None);days.append(data)
    return {'days':days,'retention_days':30}


@router.get('/admin/downloads')
def download_stats(_:None=Depends(require_admin_api_key), db:Session=Depends(get_db)):
    """Owner-only lifetime request totals; no visitor identities or storage URLs."""
    rows=db.query(Mix.id,Mix.title,Mix.download_count).filter(
        (Mix.availability=='public') | Mix.availability.is_(None)
    ).order_by(Mix.id.desc()).all()
    mixes=[{'id':row.id,'title':row.title,'requests':int(row.download_count or 0)} for row in rows]
    return {'mixes':mixes,'total_requests':sum(row['requests'] for row in mixes),
            'definition':'Download starts, not unique people or confirmed completed files.'}
