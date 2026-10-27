"""Owner-only free providers. Never imports a paid provider or writes catalog rows."""
import fcntl
import json
import math
import os
import re
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import requests
from .tracklist_drafts import DraftError, directory, offset_seconds

PROVIDERS = ('shazamio', 'local', 'manual')


def path(mix_id, provider):
    if provider not in PROVIDERS:
        raise DraftError('Unknown free provider.')
    return directory() / f'{int(mix_id)}-{provider}.json'


def load(mix_id, provider):
    target = path(mix_id, provider)
    return json.loads(target.read_text()) if target.exists() else None


def save(draft):
    target = path(draft['mix_id'], draft['provider'])
    temporary = target.with_suffix('.tmp')
    temporary.write_text(json.dumps(draft))
    temporary.chmod(0o600)
    temporary.replace(target)


def limits():
    return (max(0, min(60, int(os.getenv('FREE_TRACKLIST_SAMPLE_BUDGET', '0')))),
            max(0, min(100 * 1024**2, int(os.getenv('FREE_TRACKLIST_DOWNLOAD_BYTES', '0')))))


def usage():
    target = directory() / 'free-usage.json'
    return json.loads(target.read_text()) if target.exists() else {'samples': 0, 'bytes': 0}


def options():
    samples, byte_budget = limits()
    used = usage()
    allowance = samples > used['samples'] and byte_budget > used['bytes']
    python = Path(os.getenv('FREE_TRACKLIST_PYTHON', '/opt/papzincrew/recognition-venv/bin/python'))
    local_ready = all(Path(os.getenv(key, '/nonexistent')).is_file() for key in
                      ('LOCAL_TRACKLIST_SCRIPT', 'LOCAL_TRACKLIST_DATABASE', 'LOCAL_TRACKLIST_METADATA'))
    return [
        {'id': 'shazamio', 'label': 'ShazamIO (free, unofficial)',
         'enabled': allowance and python.is_file(),
         'note': 'Manual scan: up to 12 samples across the mix. Sends audio fingerprints to Shazam. No API key, billing or automatic retries. Availability is not guaranteed.'},
        {'id': 'local', 'label': 'Local reference library', 'enabled': allowance and local_ready and python.is_file(),
         'note': 'Matches only your private reference library using audfprint. Requires a fingerprint database and artist/title metadata on the VPS; no recognition service receives audio.'},
        {'id': 'manual', 'label': 'DJ / manual suggestions', 'enabled': True,
         'note': 'Paste timestamped identifications from the DJ or your own checks. Saved privately for review; never published here.'},
    ]


def eligible(mix):
    if str(mix.availability).lower() != 'public' or str(mix.title).upper().startswith('TEST'):
        raise DraftError('Only public DJ mixes are eligible; test uploads stay separate.')
    if (mix.tracklist or '').strip() or mix.tracklist_items:
        raise DraftError('This mix already has a tracklist. It will not be replaced.')


def parse_manual(text, duration):
    entries = []
    for line in text.splitlines():
        if not line.strip():
            continue
        match = re.fullmatch(r'\s*(\d{1,3}:\d{2}(?::\d{2})?)\s+(.+?)\s+[—–-]\s+(.+?)\s*', line)
        if not match:
            raise DraftError('Use one entry per line: 00:00 Artist — Title.')
        seconds = offset_seconds(match[1])
        if seconds >= duration or len(match[2]) > 500 or len(match[3]) > 500:
            raise DraftError('Check the timestamp and artist/title lengths.')
        entries.append({'seconds': seconds, 'artist': match[2], 'title': match[3], 'score': None})
    if not entries or len(entries) > 200:
        raise DraftError('Provide between 1 and 200 timestamped entries.')
    return sorted(entries, key=lambda entry: entry['seconds'])


def prepare(mix, provider, text=''):
    path(mix.id, provider)
    directory().mkdir(parents=True, exist_ok=True, mode=0o700)
    with (directory() / 'free-prepare.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        eligible(mix)
        existing = load(mix.id, provider)
        if existing:
            return existing, False
        option = next(option for option in options() if option['id'] == provider)
        if not option['enabled']:
            raise DraftError('This free option is unavailable or its free download/sample allowance is exhausted.')
        draft = {'mix_id': mix.id, 'mix_title': mix.title, 'provider': provider,
                 'state': 'queued', 'created_at': datetime.now(timezone.utc).isoformat(),
                 'note': 'Private, unverified suggestions. Sample times are first detections, not exact transitions. Review every identification.', 'entries': []}
        if provider == 'manual':
            draft.update(state='ready', entries=parse_manual(text, float(mix.duration_seconds)))
        else:
            parsed = urlparse(mix.file_path or '')
            if parsed.scheme != 'https' or not (parsed.hostname or '').endswith('.backblazeb2.com') or parsed.query or parsed.username:
                raise DraftError('Only existing public Backblaze audio is supported.')
            size = float(mix.file_size_mb)
            duration = float(mix.duration_seconds)
            if not math.isfinite(size) or not math.isfinite(duration) or size <= 0 or duration <= 12:
                raise DraftError('Valid file size and duration are required.')
            byte_count = math.ceil(size * 1024**2)
            count = min(12, max(1, math.ceil(duration / 90)))
            used = usage(); sample_budget, byte_budget = limits()
            if used['samples'] + count > sample_budget or used['bytes'] + byte_count > byte_budget:
                raise DraftError('Free allowance exhausted. No audio or fingerprints were sent.')
            used['samples'] += count; used['bytes'] += byte_count
            # Reserve conservatively even on failure. Never refund/retry uncertain work.
            target = directory() / 'free-usage.json'
            with target.open('w') as file:
                target.chmod(0o600)
                json.dump(used, file); file.flush(); os.fsync(file.fileno())
            draft.update(download_limit_bytes=byte_count,
                         offsets=[int(index * max(0, duration - 12) / max(1, count - 1)) for index in range(count)])
        save(draft)
        return draft, provider != 'manual'


def run(mix_id, provider, audio_url):
    draft = load(mix_id, provider)
    try:
        # Serialize recognition across mixes, keeping CPU/memory bounded on the VPS.
        with (directory() / 'free-worker.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            draft['state'] = 'scanning'; save(draft)
            with tempfile.TemporaryDirectory(prefix='tracklist-') as temporary:
                audio = Path(temporary) / 'source.audio'
                received = 0
                with requests.get(audio_url, stream=True, timeout=(10, 30), allow_redirects=False) as response:
                    response.raise_for_status()
                    if response.status_code != 200:
                        raise DraftError('Audio redirects are not allowed.')
                    with audio.open('wb') as file:
                        for chunk in response.iter_content(64 * 1024):
                            received += len(chunk)
                            if received > draft['download_limit_bytes']:
                                raise DraftError('Audio exceeds its reserved free allowance.')
                            file.write(chunk)
                if not received:
                    raise DraftError('Audio download was empty.')
                config = {'provider': provider, 'offsets': draft['offsets']}
                if provider == 'local':
                    config.update({key: os.environ[key] for key in
                                   ('LOCAL_TRACKLIST_SCRIPT', 'LOCAL_TRACKLIST_DATABASE', 'LOCAL_TRACKLIST_METADATA')})
                # Isolated dependencies and no backend secrets inherited by recognition code.
                result = subprocess.run([os.getenv('FREE_TRACKLIST_PYTHON', '/opt/papzincrew/recognition-venv/bin/python'),
                                         str(Path(__file__).with_name('tracklist_worker.py')), str(audio), json.dumps(config)],
                                        capture_output=True, text=True, timeout=420,
                                        env={'PATH': '/usr/bin:/bin', 'HOME': temporary})
                if result.returncode:
                    raise DraftError('Free recognition failed or was rate limited. No automatic retry was made.')
                entries = json.loads(result.stdout)
                if not isinstance(entries, list) or len(entries) > 200:
                    raise DraftError('Invalid recognition result.')
                draft.update(entries=entries, state='ready' if entries else 'no_matches')
    except Exception as exc:
        message = str(exc) if isinstance(exc, DraftError) else type(exc).__name__
        draft.update(state='failed', error=f'{message} Free allowance remains reserved; existing tracklists are unchanged.')
    save(draft)
