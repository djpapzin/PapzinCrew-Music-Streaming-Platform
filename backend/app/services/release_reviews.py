"""Private owner checklist; never writes catalog metadata or publishes a mix."""
import fcntl
import hashlib
import json
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, StrictBool

# Verified synthetic fixtures: live controlled tests and legacy silent probes.
# Keep hashes protected even if titles, artist credit or filenames are renamed.
SYNTHETIC_HASHES = {
    '48852a8cc9cb8a37a28d23a4c0f609da481bf7b6ccf8a6c7746990062636aec1',
    '5dcb8b8c0d5e8cfbc593a28a27f26e2c4d86179ff7389f95345e3ab994056257',
    '5c85b30bec12fba7a4d8df03892e9f21025fb66225c947aef8dd9a6481a80c1a',
    '15459a591de45769730c0ab70e0488e07d209e193148bb94deec8d6e603bc54f',
    '133bd18bc7b8bc54ea1c0e9db930cbe23e1f8007ff912aaa86dd6e5ef527a46f',
}
CHECKS = ('audio_ready', 'title_credit_approved', 'presentation_approved', 'playback_verified', 'musical_approved')


class ReviewChange(BaseModel):
    model_config = ConfigDict(extra='forbid')
    fingerprint: str = Field(pattern=r'^[a-f0-9]{64}$')
    revision: int = Field(ge=0)
    audio_ready: StrictBool = False
    title_credit_approved: StrictBool = False
    presentation_approved: StrictBool = False
    playback_verified: StrictBool = False
    musical_approved: StrictBool = False
    final_approved: StrictBool = False
    notes: str = Field(default='', max_length=3000)
    caption: str = Field(default='', max_length=3000)
    release_time: str = Field(default='', max_length=100)


def directory():
    return Path(os.getenv('RELEASE_REVIEW_DIR', '/var/lib/papzincrew/release-reviews'))


def snapshot(mix):
    return {'id': mix.id, 'title': mix.title or '',
            'artist': mix.artist.name if mix.artist else '',
            'audio': mix.file_path or '', 'file_hash': mix.file_hash or '',
            'cover': mix.cover_art_url or '', 'duration': mix.duration_seconds or 0,
            'tracklist': mix.tracklist or '', 'availability': mix.availability,
            'original_filename': mix.original_filename or ''}


def fingerprint(data):
    return hashlib.sha256(json.dumps(data, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def is_test(data):
    text = ' '.join(str(data[k]) for k in ('title', 'artist', 'original_filename'))
    return data['file_hash'] in SYNTHETIC_HASHES or bool(re.search(r'\b(tests?|synthetic|fixtures?|qa)\b', text.replace('_', ' '), re.I))


def _read(path):
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text())
        if not isinstance(data, dict):
            raise ValueError('Review must be an object')
        return data
    except (ValueError, OSError):
        raise HTTPException(503, 'The saved release review could not be read. Keep your notes and contact the owner.')


def present(data, saved):
    current = fingerprint(data)
    stale = bool(saved and saved.get('fingerprint') != current)
    effective = {} if stale else saved
    link = f"https://crew.djpapzin.com/track/{data['id']}"
    caption = f"Let’s Cruize!\n{data['title']}\nMixed by {data['artist']}\nListen: {link}"
    blocked = is_test(data)
    checks = {key: bool(effective.get(key, False)) for key in CHECKS}
    return {'id': data['id'], 'title': data['title'], 'artist': data['artist'],
            'cover_art_url': data['cover'], 'duration_seconds': data['duration'],
            'tracklist': data['tracklist'], 'availability': data['availability'],
            'review_url': link, 'fingerprint': current, 'revision': saved.get('revision', 0),
            'stale': stale, 'test_only': blocked, 'checks': checks,
            'notes': saved.get('notes', ''), 'caption': (saved.get('caption') if not stale else '') or caption,
            'release_time': saved.get('release_time', ''),
            'final_approved': bool(effective.get('final_approved') and not blocked and all(checks.values())),
            'approved_at': effective.get('approved_at'), 'updated_at': saved.get('updated_at')}


def load(mix):
    root = directory()
    if not root.exists():
        return present(snapshot(mix), {})
    with (root / 'reviews.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_SH)
        return present(snapshot(mix), _read(root / f'{mix.id}.json'))


def save(mix, change):
    root = directory(); root.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (root / 'reviews.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        path = root / f'{mix.id}.json'
        prior = _read(path)
        data = snapshot(mix)
        if change.revision != prior.get('revision', 0) or change.fingerprint != fingerprint(data):
            raise HTTPException(409, 'This mix or review changed. Reload the review before saving; keep your notes.')
        if change.final_approved:
            if is_test(data):
                raise HTTPException(409, 'Test uploads stay unlisted and cannot receive final release approval.')
            if not data['audio'] or not data['title'].strip() or not data['artist'].strip() or not data['duration']:
                raise HTTPException(409, 'Audio, title, guest credit and a verified duration are required.')
            if not all(getattr(change, key) for key in CHECKS):
                raise HTTPException(409, 'Complete the technical checks and DJ Papzin’s musical review first.')
        now = datetime.now(timezone.utc).isoformat()
        record = change.model_dump()
        record.update(revision=change.revision + 1, updated_at=now,
                      approved_at=now if change.final_approved else None)
        fd, name = tempfile.mkstemp(prefix=f'.{mix.id}-', dir=root)
        try:
            with os.fdopen(fd, 'w') as file:
                json.dump(record, file); file.flush(); os.fsync(file.fileno())
            os.replace(name, path)
            directory_fd = os.open(root, os.O_RDONLY)
            try: os.fsync(directory_fd)
            finally: os.close(directory_fd)
        finally:
            Path(name).unlink(missing_ok=True)
        return present(data, record)
