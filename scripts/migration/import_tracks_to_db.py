#!/usr/bin/env python3
"""
Import migration manifest rows into mixes table.
Idempotent: skips rows where file_path already exists.

Default mode is dry-run. Use --commit to persist changes.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine


def db_url_from_env() -> str:
    url = (
        os.getenv("SQLALCHEMY_DATABASE_URL")
        or os.getenv("DATABASE_URL")
        or os.getenv("INTERNAL_DATABASE_URL")
    )
    if url and url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg2://", 1)
    if url:
        return url

    backend_dir = Path(__file__).resolve().parents[2] / "backend"
    return f"sqlite:///{backend_dir}/papzin_crew.db"


def load_manifest(path: Path) -> list[dict[str, Any]]:
    if path.suffix.lower() == ".json":
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, list):
            raise ValueError("JSON manifest must be a list of objects")
        return data

    rows: list[dict[str, Any]] = []
    with path.open("r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(dict(row))
    return rows


def parse_int(value: Any, default: int = 0) -> int:
    if value is None or value == "":
        return default
    try:
        return int(float(value))
    except Exception:
        return default


def parse_float(value: Any, default: float = 0.0) -> float:
    if value is None or value == "":
        return default
    try:
        return float(value)
    except Exception:
        return default


def ensure_artist_id(conn, requested_artist_id: int | None, artist_name: str) -> int:
    if requested_artist_id is not None:
        exists = conn.execute(text("SELECT id FROM artists WHERE id = :id"), {"id": requested_artist_id}).fetchone()
        if not exists:
            raise ValueError(f"Artist id {requested_artist_id} does not exist in artists table")
        return requested_artist_id

    row = conn.execute(text("SELECT id FROM artists WHERE name = :name LIMIT 1"), {"name": artist_name}).fetchone()
    if row:
        return int(row[0])

    inserted = conn.execute(
        text("INSERT INTO artists (name) VALUES (:name) RETURNING id"),
        {"name": artist_name},
    ).fetchone()
    if inserted and inserted[0]:
        return int(inserted[0])

    # SQLite fallback for environments where RETURNING may vary
    row = conn.execute(text("SELECT id FROM artists WHERE name = :name LIMIT 1"), {"name": artist_name}).fetchone()
    if not row:
        raise RuntimeError("Failed to create/find default artist")
    return int(row[0])


def main() -> int:
    parser = argparse.ArgumentParser(description="Import migration manifest rows into mixes table")
    parser.add_argument("--manifest", type=Path, required=True, help="JSON or CSV manifest from build_tracks_manifest.py")
    parser.add_argument("--database-url", default=db_url_from_env())
    parser.add_argument("--artist-id", type=int, default=(int(os.getenv("MIGRATION_ARTIST_ID")) if os.getenv("MIGRATION_ARTIST_ID") else None))
    parser.add_argument("--default-artist-name", default=os.getenv("MIGRATION_DEFAULT_ARTIST_NAME", "PapzinCrew Migration"))
    parser.add_argument("--base-public-url", default=os.getenv("B2_PUBLIC_BASE_URL", ""), help="Optional public URL prefix; if set, stored file_path will be URL")
    parser.add_argument("--release-date", default=datetime.now(timezone.utc).isoformat())
    parser.add_argument("--commit", action="store_true", help="Persist changes; otherwise dry-run")
    args = parser.parse_args()

    manifest = load_manifest(args.manifest)
    if not manifest:
        print("No rows found in manifest.")
        return 0

    engine: Engine = create_engine(args.database_url, pool_pre_ping=True)

    inserted = 0
    skipped_existing = 0
    skipped_invalid = 0

    with engine.begin() as conn:
        default_artist_id = ensure_artist_id(conn, args.artist_id, args.default_artist_name)

        for row in manifest:
            src_file_path = str(row.get("file_path") or row.get("key") or "").strip()
            if not src_file_path:
                skipped_invalid += 1
                continue

            file_path = src_file_path
            if args.base_public_url:
                file_path = f"{args.base_public_url.rstrip('/')}/{src_file_path.lstrip('/')}"

            exists = conn.execute(
                text("SELECT id FROM mixes WHERE file_path = :file_path LIMIT 1"),
                {"file_path": file_path},
            ).fetchone()
            if exists:
                skipped_existing += 1
                continue

            title = str(row.get("title") or Path(src_file_path).stem).strip() or "Untitled"
            original_filename = str(row.get("original_filename") or Path(src_file_path).name)
            duration_seconds = parse_int(row.get("duration_seconds"), 0)
            file_size_mb = parse_float(row.get("file_size_mb"), 0.0)
            quality_kbps = parse_int(row.get("quality_kbps"), 0)
            artist_id = parse_int(row.get("artist_id"), default_artist_id)

            payload = {
                "title": title,
                "original_filename": original_filename,
                "duration_seconds": duration_seconds,
                "file_path": file_path,
                "cover_art_url": None,
                "file_size_mb": file_size_mb,
                "quality_kbps": quality_kbps,
                "release_date": args.release_date,
                "description": None,
                "tracklist": None,
                "tags": "migration",
                "genre": None,
                "album": None,
                "year": None,
                "availability": "public",
                "allow_downloads": "yes",
                "display_embed": "yes",
                "age_restriction": "all",
                "play_count": 0,
                "download_count": 0,
                "artist_id": artist_id,
            }

            if args.commit:
                conn.execute(
                    text(
                        """
                        INSERT INTO mixes (
                          title, original_filename, duration_seconds, file_path, cover_art_url,
                          file_size_mb, quality_kbps, release_date, description, tracklist,
                          tags, genre, album, year, availability, allow_downloads,
                          display_embed, age_restriction, play_count, download_count, artist_id
                        ) VALUES (
                          :title, :original_filename, :duration_seconds, :file_path, :cover_art_url,
                          :file_size_mb, :quality_kbps, :release_date, :description, :tracklist,
                          :tags, :genre, :album, :year, :availability, :allow_downloads,
                          :display_embed, :age_restriction, :play_count, :download_count, :artist_id
                        )
                        """
                    ),
                    payload,
                )

            inserted += 1

        if not args.commit:
            conn.rollback()

    mode = "COMMIT" if args.commit else "DRY-RUN"
    print(f"[{mode}] rows_total={len(manifest)} would_insert={inserted} skipped_existing={skipped_existing} skipped_invalid={skipped_invalid}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
