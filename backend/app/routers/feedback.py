"""Small private beta-feedback inbox; no email service or public report listing."""
import fcntl
import json
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, ValidationError, field_validator
from .admin import require_admin_api_key

router = APIRouter(tags=['feedback'])


def directory():
    return Path(os.getenv('FEEDBACK_DIR', '/var/lib/papzincrew/feedback'))


class Feedback(BaseModel):
    id: UUID
    message: str = Field(min_length=10, max_length=3000)
    name: str = Field(default='', max_length=80)
    page: str = Field(default='/', max_length=250)
    device: str = Field(default='unknown', pattern='^(mobile|desktop|unknown)$')
    website: str = Field(default='', max_length=200)  # Honeypot, not stored.

    @field_validator('message')
    @classmethod
    def trim_message(cls, value):
        if len(value.strip()) < 10:
            raise ValueError('Please describe the problem in at least 10 characters.')
        return value.strip()

    @field_validator('page')
    @classmethod
    def safe_page(cls, value):
        # Never store URL queries/fragments, tokens or an external URL.
        value = value.split('?', 1)[0].split('#', 1)[0]
        if not value.startswith('/') or value.startswith('//'):
            return '/'
        return value


@router.post('/feedback', status_code=201)
async def submit_feedback(request: Request):
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > 16000:
            raise HTTPException(413, 'Feedback is too large.')
    try:
        report = Feedback.model_validate_json(bytes(raw))
    except ValidationError:
        raise HTTPException(422, 'Add a problem description (10–3000 characters); name is optional.')
    if report.website:
        return {'id': str(report.id)}
    root = directory(); root.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (root / 'inbox.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        target = root / f'{report.id}.json'
        if target.exists():
            return {'id': str(report.id)}  # Safe retry after an uncertain connection.
        files = list(root.glob('*.json'))
        now = datetime.now(timezone.utc)
        if len(files) >= 1000:
            raise HTTPException(503, 'Feedback inbox is full. Please try later.')
        recent = sum(datetime.fromisoformat(json.loads(file.read_text())['created_at']) > now - timedelta(hours=1) for file in files)
        if recent >= 30:
            raise HTTPException(429, 'Too many reports right now. Please try again later.')
        data = report.model_dump(mode='json', exclude={'website'})
        data['created_at'] = now.isoformat()
        temporary = target.with_suffix('.tmp')
        with temporary.open('w') as file:
            os.chmod(temporary, 0o600)
            json.dump(data, file); file.flush(); os.fsync(file.fileno())
        temporary.replace(target)
    return {'id': str(report.id)}


@router.get('/admin/feedback')
def list_feedback(_: None = Depends(require_admin_api_key)):
    root = directory()
    if not root.exists():
        return {'reports': []}
    with (root / 'inbox.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_SH)
        reports = [json.loads(file.read_text()) for file in root.glob('*.json')]
    return {'reports': sorted(reports, key=lambda report: report['created_at'], reverse=True)[:100]}
