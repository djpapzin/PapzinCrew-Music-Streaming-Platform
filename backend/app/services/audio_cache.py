"""Pre-verified public audio only. No request can fetch or alter a B2 object."""
import hashlib
import json
import os
import re
from pathlib import Path


def directory():
    return Path(os.getenv('AUDIO_CACHE_DIR', '/var/lib/papzincrew/audio-cache'))


def version(source):
    return hashlib.sha256(source.encode()).hexdigest()[:24]


def manifest():
    try:
        return json.loads((directory()/'manifest.json').read_text())
    except (OSError, ValueError):
        return {}


def entry(mix_id, source, availability, snapshot=None):
    if (availability or 'public') != 'public' or not source:
        return None
    try:
        root = directory()
        item = (manifest() if snapshot is None else snapshot).get(str(mix_id))
        if not item or item['version'] != version(source):
            return None
        if not re.fullmatch(r'[a-f0-9]{64}', item['sha256']):
            return None
        path = root / (item['sha256'] + '.audio')
        if not path.is_file() or path.stat().st_size != item['size'] or item['size'] <= 0:
            return None
        return {**item, 'path': path}
    except (OSError, ValueError, KeyError, TypeError):
        return None


def public_url(mix_id, source, availability, snapshot=None):
    base = os.getenv('AUDIO_CACHE_PUBLIC_BASE', '').rstrip('/')
    if not base or os.getenv('AUDIO_CACHE_SERVE_ENABLED') != '1' or not entry(mix_id, source, availability, snapshot):
        return None
    return f'{base}/tracks/{mix_id}/cached/{version(source)}'
