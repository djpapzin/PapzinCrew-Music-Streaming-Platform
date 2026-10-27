"""Isolated free recognition process. No database access or paid API client."""
import asyncio
import json
import re
import subprocess
import sys
from pathlib import Path


def sample(audio, offset):
    target = audio.parent / 'sample.wav'
    subprocess.run(['/usr/bin/ffmpeg', '-nostdin', '-v', 'error', '-y', '-ss', str(offset),
                    '-i', str(audio), '-t', '12', '-vn', '-ac', '1', '-ar', '16000',
                    '-threads', '1', str(target)], check=True, capture_output=True, timeout=30)
    return target


async def shazam(audio, config):
    from shazamio import Shazam
    from shazamio.client import HTTPClient
    from aiohttp_retry import ExponentialRetry
    client = Shazam(http_client=HTTPClient(retry_options=ExponentialRetry(attempts=1)),
                    segment_duration_seconds=12)
    entries = []; previous = None
    for index, offset in enumerate(config['offsets']):
        if index:
            await asyncio.sleep(3)
        result = await asyncio.wait_for(client.recognize(str(sample(audio, offset))), timeout=20)
        track = result.get('track') or {}
        artist, title = track.get('subtitle'), track.get('title')
        key = (artist, title)
        if artist and title and key != previous:
            entries.append({'seconds': offset, 'artist': str(artist)[:500], 'title': str(title)[:500], 'score': None})
        previous = key if artist and title else None
    return entries


def local(audio, config):
    metadata = json.loads(Path(config['LOCAL_TRACKLIST_METADATA']).read_text())
    entries = []; previous = None
    for offset in config['offsets']:
        output = subprocess.run([sys.executable, config['LOCAL_TRACKLIST_SCRIPT'], 'match',
                                 '--dbase', config['LOCAL_TRACKLIST_DATABASE'], '--find-time-range',
                                 '--max-matches', '1', '--verbose', '1', str(sample(audio, offset))],
                                check=True, capture_output=True, text=True, timeout=30).stdout
        current = None
        for line in output.splitlines():
            match = re.search(r'Matched\s+[\d.]+ s starting at\s+([\d.]+) s in .+ to time\s+[\d.]+ s in (.+) with\s+(\d+) of\s+\d+ common hashes', line)
            if not match or int(match[3]) < 10:
                continue
            track = metadata.get(match[2])
            if not track or not track.get('artist') or not track.get('title'):
                continue
            current = (str(track['artist'])[:500], str(track['title'])[:500])
            if current != previous:
                entries.append({'seconds': offset + int(float(match[1])), 'artist': current[0], 'title': current[1], 'score': None})
        previous = current
    return entries


if __name__ == '__main__':
    audio, config = Path(sys.argv[1]), json.loads(sys.argv[2])
    entries = asyncio.run(shazam(audio, config)) if config['provider'] == 'shazamio' else local(audio, config)
    print(json.dumps(entries))
