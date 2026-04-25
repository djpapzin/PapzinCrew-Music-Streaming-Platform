#!/usr/bin/env python3
from __future__ import annotations

import concurrent.futures as cf
import os
import subprocess
from dataclasses import dataclass
from typing import Iterable

from sqlalchemy import create_engine, text


@dataclass(frozen=True)
class Track:
    id: int
    file_path: str
    duration_seconds: int | None


def db_url_from_env() -> str:
    url = os.getenv("DATABASE_URL") or os.getenv("SQLALCHEMY_DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL or SQLALCHEMY_DATABASE_URL is required")
    return url


def probe_duration(url: str) -> int:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            url,
        ],
        capture_output=True,
        text=True,
        timeout=180,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"ffprobe failed for {url}")
    return max(1, int(round(float(result.stdout.strip()))))


def load_tracks(engine) -> list[Track]:
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT id, file_path, duration_seconds
                FROM mixes
                WHERE file_path LIKE 'https://s3.us-east-005.backblazeb2.com/%'
                ORDER BY id ASC
                """
            )
        ).fetchall()
    return [Track(id=int(r[0]), file_path=str(r[1]), duration_seconds=(int(r[2]) if r[2] is not None else None)) for r in rows]


def main() -> int:
    engine = create_engine(db_url_from_env(), pool_pre_ping=True)
    tracks = [t for t in load_tracks(engine) if not t.duration_seconds or t.duration_seconds <= 0]
    print(f"tracks_needing_backfill={len(tracks)}", flush=True)
    if not tracks:
        return 0

    results: dict[int, int] = {}
    failures = 0

    with cf.ThreadPoolExecutor(max_workers=8) as pool:
        future_map = {pool.submit(probe_duration, t.file_path): t for t in tracks}
        for idx, future in enumerate(cf.as_completed(future_map), 1):
            track = future_map[future]
            try:
                duration = future.result()
                results[track.id] = duration
                if idx <= 5 or idx % 20 == 0:
                    print(f"probe_ok id={track.id} duration={duration}", flush=True)
            except Exception as exc:
                failures += 1
                print(f"probe_fail id={track.id} err={exc}", flush=True)

    if not results:
        print(f"no_updates failures={failures}", flush=True)
        return 1

    with engine.begin() as conn:
        for track_id, duration in results.items():
            conn.execute(
                text("UPDATE mixes SET duration_seconds = :duration WHERE id = :id"),
                {"duration": duration, "id": track_id},
            )

    print(f"updated={len(results)} failures={failures}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
