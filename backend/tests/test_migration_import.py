import json
from pathlib import Path
import subprocess
import sys

from sqlalchemy import create_engine, text

from app.models.models import Base


def test_reviewed_archive_import_preserves_metadata_and_is_idempotent(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'catalog.db'}"
    engine = create_engine(database_url)
    Base.metadata.create_all(engine)
    manifest = tmp_path / 'manifest.json'
    common = {'duration_seconds': 1800, 'file_size_mb': 30, 'quality_kbps': 128,
              'release_date': None, 'tags': 'migration,tpw-archive-2026-10'}
    rows = [
        {**common, 'title': 'TPW 18', 'file_path': 'https://example.com/tpw18.mp3',
         'file_hash': 'a' * 64, 'artist_name': 'DJ Papzin feat. Fhumu Hush',
         'cover_art_url': 'https://example.com/art.jpg', 'album': 'The Pristine World',
         'genre': 'House', 'year': 2013},
        {**common, 'title': 'Collaboration Mix', 'file_path': 'https://example.com/collab.mp3',
         'file_hash': 'b' * 64, 'artist_name': 'DJ Papzin & Joeyeezi'},
    ]
    manifest.write_text(json.dumps(rows))
    script = Path(__file__).resolve().parents[2] / 'scripts/migration/import_tracks_to_db.py'
    command = [sys.executable, str(script), '--manifest', str(manifest),
               '--database-url', database_url, '--default-artist-name', 'DJ Papzin']

    subprocess.run(command, check=True, capture_output=True)
    with engine.connect() as conn:
        assert conn.execute(text('SELECT COUNT(*) FROM mixes')).scalar() == 0
        assert conn.execute(text('SELECT COUNT(*) FROM artists')).scalar() == 0

    subprocess.run([*command, '--commit'], check=True, capture_output=True)
    with engine.begin() as conn:
        track = conn.execute(text('SELECT m.*, a.name AS artist_name FROM mixes m JOIN artists a ON a.id=m.artist_id WHERE m.title="TPW 18"')).mappings().one()
        assert track['artist_name'] == rows[0]['artist_name']
        for field in ['cover_art_url', 'album', 'genre', 'year', 'file_hash', 'release_date']:
            assert track[field] == rows[0][field]
        conn.execute(text('UPDATE mixes SET play_count=7 WHERE title="TPW 18"'))

    # Same original at another URL must also be skipped, and existing plays preserved.
    rows[0]['file_path'] = 'https://another.example/tpw18.mp3'
    manifest.write_text(json.dumps(rows))
    result = subprocess.run([*command, '--commit'], check=True, capture_output=True, text=True)
    assert 'skipped_existing=2' in result.stdout
    with engine.connect() as conn:
        assert conn.execute(text('SELECT COUNT(*) FROM mixes')).scalar() == 2
        assert conn.execute(text('SELECT play_count FROM mixes WHERE title="TPW 18"')).scalar() == 7
