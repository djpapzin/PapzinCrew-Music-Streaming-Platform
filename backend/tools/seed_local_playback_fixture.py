#!/usr/bin/env python3
"""Seed a tiny local-only playback fixture for Papzin & Crew.

Safe-by-default behavior:
- Uses a local SQLite DB path (does not touch remote DBs)
- Uses backend/uploads for the playable file
- Is idempotent for artist/mix id=1
- Copies an existing local audio source when provided/found
- Falls back to generating a 1-second WAV tone when no source is available

Example:
  python backend/tools/seed_local_playback_fixture.py \
    --db backend/dev_playback.sqlite \
    --upload-dir backend/uploads
"""

from __future__ import annotations

import argparse
import math
import os
import shutil
import sqlite3
import struct
import wave
from pathlib import Path


DEFAULT_TITLE = "Papzin Test Tone"
DEFAULT_ARTIST = "Papzin Local Fixture"
DEFAULT_FILENAME = "papzin-test-tone.wav"


def ensure_schema(con: sqlite3.Connection) -> None:
    con.executescript(
        """
        PRAGMA foreign_keys=ON;
        CREATE TABLE IF NOT EXISTS artists (
          id INTEGER PRIMARY KEY,
          name VARCHAR NOT NULL
        );
        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY,
          name VARCHAR NOT NULL UNIQUE,
          description VARCHAR
        );
        CREATE TABLE IF NOT EXISTS mixes (
          id INTEGER PRIMARY KEY,
          title VARCHAR NOT NULL,
          original_filename VARCHAR,
          duration_seconds INTEGER NOT NULL,
          file_path VARCHAR NOT NULL UNIQUE,
          file_hash VARCHAR(64),
          cover_art_url VARCHAR,
          file_size_mb FLOAT NOT NULL,
          quality_kbps INTEGER NOT NULL,
          bpm INTEGER,
          release_date DATETIME,
          description VARCHAR,
          tracklist VARCHAR,
          tags VARCHAR,
          genre VARCHAR,
          album VARCHAR,
          year INTEGER,
          availability VARCHAR DEFAULT 'public',
          allow_downloads VARCHAR DEFAULT 'yes',
          display_embed VARCHAR DEFAULT 'yes',
          age_restriction VARCHAR DEFAULT 'all',
          play_count INTEGER DEFAULT 0,
          download_count INTEGER DEFAULT 0,
          artist_id INTEGER NOT NULL,
          FOREIGN KEY(artist_id) REFERENCES artists(id)
        );
        CREATE TABLE IF NOT EXISTS mix_category (
          mix_id INTEGER NOT NULL,
          category_id INTEGER NOT NULL,
          PRIMARY KEY (mix_id, category_id),
          FOREIGN KEY(mix_id) REFERENCES mixes(id),
          FOREIGN KEY(category_id) REFERENCES categories(id)
        );
        CREATE TABLE IF NOT EXISTS tracklist_items (
          id INTEGER PRIMARY KEY,
          track_title VARCHAR NOT NULL,
          track_artist VARCHAR NOT NULL,
          timestamp_seconds INTEGER NOT NULL,
          mix_id INTEGER NOT NULL,
          FOREIGN KEY(mix_id) REFERENCES mixes(id)
        );
        CREATE INDEX IF NOT EXISTS ix_mixes_id ON mixes (id);
        CREATE INDEX IF NOT EXISTS ix_mixes_title ON mixes (title);
        CREATE INDEX IF NOT EXISTS ix_mixes_file_hash ON mixes (file_hash);
        CREATE INDEX IF NOT EXISTS ix_artists_id ON artists (id);
        CREATE INDEX IF NOT EXISTS ix_artists_name ON artists (name);
        """
    )


def generate_tone_wav(path: Path, seconds: float = 1.0, sample_rate: int = 44100, frequency: float = 440.0) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    amplitude = 16000
    total_frames = int(seconds * sample_rate)
    with wave.open(str(path), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        for i in range(total_frames):
            sample = int(amplitude * math.sin(2 * math.pi * frequency * (i / sample_rate)))
            wav_file.writeframes(struct.pack("<h", sample))


def materialize_audio(destination: Path, source: Path | None) -> str:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if source and source.exists():
        shutil.copy2(source, destination)
        return f"copied:{source}"
    generate_tone_wav(destination)
    return "generated:1s-440hz-wav"


def seed(db_path: Path, upload_dir: Path, source_audio: Path | None) -> dict:
    upload_dir.mkdir(parents=True, exist_ok=True)
    audio_path = upload_dir / DEFAULT_FILENAME
    audio_source = materialize_audio(audio_path, source_audio)

    con = sqlite3.connect(db_path)
    try:
        ensure_schema(con)
        cur = con.cursor()
        cur.execute("INSERT OR IGNORE INTO artists (id, name) VALUES (1, ?)", (DEFAULT_ARTIST,))
        cur.execute(
            """
            INSERT INTO mixes (
              id,title,original_filename,duration_seconds,file_path,cover_art_url,file_size_mb,
              quality_kbps,genre,album,year,availability,allow_downloads,display_embed,
              age_restriction,play_count,download_count,artist_id,description,tags
            ) VALUES (
              1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
            )
            ON CONFLICT(id) DO UPDATE SET
              title=excluded.title,
              original_filename=excluded.original_filename,
              duration_seconds=excluded.duration_seconds,
              file_path=excluded.file_path,
              cover_art_url=excluded.cover_art_url,
              file_size_mb=excluded.file_size_mb,
              quality_kbps=excluded.quality_kbps,
              genre=excluded.genre,
              album=excluded.album,
              year=excluded.year,
              availability=excluded.availability,
              allow_downloads=excluded.allow_downloads,
              display_embed=excluded.display_embed,
              age_restriction=excluded.age_restriction,
              artist_id=excluded.artist_id,
              description=excluded.description,
              tags=excluded.tags
            """,
            (
                DEFAULT_TITLE,
                audio_path.name,
                1,
                f"/uploads/{audio_path.name}",
                None,
                round(audio_path.stat().st_size / (1024 * 1024), 4),
                1411,
                "test",
                "Local Fixture",
                2026,
                "public",
                "yes",
                "yes",
                "all",
                0,
                0,
                1,
                "Local-only playback verification fixture",
                "fixture,local,test",
            ),
        )
        con.commit()
        count = cur.execute("SELECT COUNT(*) FROM mixes").fetchone()[0]
        mix = cur.execute("SELECT id, title, file_path FROM mixes WHERE id=1").fetchone()
    finally:
        con.close()

    return {
        "db_path": str(db_path),
        "upload_dir": str(upload_dir),
        "audio_path": str(audio_path),
        "audio_source": audio_source,
        "mix_count": count,
        "fixture_mix": mix,
    }


def parse_args() -> argparse.Namespace:
    repo_backend = Path(__file__).resolve().parents[1]
    workspace_tmp_audio = repo_backend.parents[2] / "tmp" / DEFAULT_FILENAME
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=str(repo_backend / "dev_playback.sqlite"))
    parser.add_argument("--upload-dir", default=str(repo_backend / "uploads"))
    parser.add_argument("--source-audio", default=str(workspace_tmp_audio))
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    result = seed(
        db_path=Path(args.db).resolve(),
        upload_dir=Path(args.upload_dir).resolve(),
        source_audio=Path(args.source_audio).resolve() if args.source_audio else None,
    )
    print(result)
