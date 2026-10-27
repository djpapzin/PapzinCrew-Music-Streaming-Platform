"""Manual, bounded AudD scans. Drafts never write catalog tracklists."""
import fcntl
import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import requests


class DraftError(Exception):
    pass


def directory():
    return Path(os.getenv('TRACKLIST_DRAFT_DIR', '/var/lib/papzincrew/tracklist-drafts'))


def settings():
    token = os.getenv('AUDD_API_TOKEN', '')
    budget = max(0, min(300, int(os.getenv('AUDD_FREE_REQUEST_BUDGET', '0'))))
    byte_budget = max(0, min(100 * 1024**2, int(os.getenv('AUDD_FREE_DOWNLOAD_BYTES', '0'))))
    return token, budget, byte_budget


def load(mix_id):
    path = directory() / f'{int(mix_id)}.json'
    return json.loads(path.read_text()) if path.exists() else None


def save(draft):
    path = directory() / f"{draft['mix_id']}.json"
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(draft))
    temporary.chmod(0o600)
    temporary.replace(path)


def reserve(chunks, byte_count):
    _, budget, byte_budget = settings()
    directory().mkdir(parents=True, exist_ok=True, mode=0o700)
    with (directory() / 'usage.json').open('a+') as file:
        fcntl.flock(file, fcntl.LOCK_EX)
        file.seek(0)
        usage = json.loads(file.read() or '{"requests":0,"bytes":0}')
        if usage['requests'] + chunks > budget or usage['bytes'] + byte_count > byte_budget:
            raise DraftError('Free scan budget exhausted. No request was sent.')
        usage['requests'] += chunks
        usage['bytes'] += byte_count
        file.seek(0); file.truncate(); json.dump(usage, file); file.flush(); os.fsync(file.fileno())
    # Failed/uncertain requests remain reserved: never retry automatically.


def prepare(mix):
    directory().mkdir(parents=True, exist_ok=True, mode=0o700)
    with (directory() / 'prepare.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        return _prepare(mix)


def _prepare(mix):
    if str(mix.availability).lower() != 'public' or str(mix.title).upper().startswith('TEST'):
        raise DraftError('Only public DJ mixes can be scanned; test uploads stay separate.')
    if (mix.tracklist or '').strip() or mix.tracklist_items:
        raise DraftError('This mix already has a tracklist. It will not be replaced.')
    existing = load(mix.id)
    if existing:
        return existing, False
    token, budget, byte_budget = settings()
    if not token or not budget or not byte_budget:
        raise DraftError('Scanning is disabled until AudD free credits and download allowance are configured.')
    parsed = urlparse(mix.file_path or '')
    if parsed.scheme != 'https' or not (parsed.hostname or '').endswith('.backblazeb2.com') or parsed.query or parsed.username:
        raise DraftError('Only existing public Backblaze audio is supported.')
    byte_count = math.ceil(float(mix.file_size_mb) * 1024**2)
    if byte_count <= 0 or byte_count > byte_budget:
        raise DraftError('This file exceeds the configured free download allowance.')
    chunks = min(30, max(1, math.ceil(float(mix.duration_seconds) / 60)))
    directory().mkdir(parents=True, exist_ok=True, mode=0o700)
    draft = {'mix_id': mix.id, 'mix_title': mix.title, 'state': 'queued', 'provider': 'AudD',
             'created_at': datetime.now(timezone.utc).isoformat(), 'chunks': chunks,
             'note': 'Sampled draft: up to the first 30 minutes, one 12-second sample per minute. Times are first detections, not exact transitions. Review all matches.',
             'entries': []}
    save(draft)
    try:
        reserve(chunks, byte_count)
    except Exception:
        draft.update(state='failed', error='Free scan budget unavailable. No provider request was sent.')
        save(draft)
        raise DraftError(draft['error'])
    return draft, True


def offset_seconds(value):
    parts = str(value).split(':')
    if len(parts) not in (2, 3):
        raise ValueError('Invalid offset')
    total = 0
    for part in parts:
        total = total * 60 + float(part)
    if not math.isfinite(total) or total < 0:
        raise ValueError('Invalid offset')
    return int(total)


def parse_entries(payload):
    if payload.get('status') != 'success' or not isinstance(payload.get('result'), list):
        raise DraftError('AudD did not return a successful scan. No automatic retry was made.')
    entries = []
    previous = set()
    for chunk in sorted(payload['result'], key=lambda c: offset_seconds(c['offset'])):
        seconds = offset_seconds(chunk['offset'])
        current = set()
        for song in chunk.get('songs') or []:
            title, artist = str(song.get('title') or '').strip(), str(song.get('artist') or '').strip()
            if not title or not artist:
                continue
            key = (artist.casefold(), title.casefold())
            if key not in previous and key not in current:
                score = song.get('score')
                entries.append({'seconds': seconds, 'artist': artist[:500], 'title': title[:500],
                                'score': score if isinstance(score, (int, float)) and 0 <= score <= 100 else None})
            current.add(key)
        previous = current
    return entries


def run(mix_id, audio_url):
    draft = load(mix_id)
    try:
        draft['state'] = 'scanning'; save(draft)
        token, _, _ = settings()
        response = requests.post('https://enterprise.audd.io/', data={
            'api_token': token, 'url': audio_url, 'skip': '4', 'every': '1',
            'limit': str(draft['chunks']), 'accurate_offsets': 'true',
        }, timeout=(10, 180), allow_redirects=False)
        response.raise_for_status()
        draft['entries'] = parse_entries(response.json())
        draft['state'] = 'ready' if draft['entries'] else 'no_matches'
    except Exception:
        draft.update(state='failed', error='The scan failed or timed out. Credits remain reserved; no automatic retry was made.')
    save(draft)
