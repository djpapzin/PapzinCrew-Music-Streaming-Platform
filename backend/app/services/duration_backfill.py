from __future__ import annotations

import asyncio
import concurrent.futures as cf
import logging
import os
import subprocess
from urllib.parse import urlsplit, urlunsplit, quote

from sqlalchemy import text

from ..db.database import engine

logger = logging.getLogger(__name__)


def _duration_backfill_enabled() -> bool:
    return os.getenv("BACKFILL_TRACK_DURATIONS", "0").strip().lower() in {"1", "true", "yes", "on"}


def _normalize_probe_url(url: str) -> str:
    parts = urlsplit(url)
    quoted_path = quote(parts.path, safe="/%")
    return urlunsplit((parts.scheme, parts.netloc, quoted_path, parts.query, parts.fragment))


def _probe_duration(url: str) -> int:
    probe_url = _normalize_probe_url(url)
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            probe_url,
        ],
        capture_output=True,
        text=True,
        timeout=180,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"ffprobe failed for {url}")
    return max(1, int(round(float(result.stdout.strip()))))


def _load_tracks_needing_duration() -> list[tuple[int, str]]:
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT id, file_path
                FROM mixes
                WHERE COALESCE(duration_seconds, 0) = 0
                  AND file_path LIKE 'https://s3.us-east-005.backblazeb2.com/%'
                ORDER BY id ASC
                """
            )
        ).fetchall()
    return [(int(row[0]), str(row[1])) for row in rows]


def _backfill_sync() -> tuple[int, int]:
    tracks = _load_tracks_needing_duration()
    if not tracks:
        return 0, 0

    logger.info("duration_backfill_start tracks=%s", len(tracks))
    updated = 0
    failures = 0

    with cf.ThreadPoolExecutor(max_workers=8) as pool:
        future_map = {pool.submit(_probe_duration, url): (track_id, url) for track_id, url in tracks}
        results: list[tuple[int, int]] = []
        for future in cf.as_completed(future_map):
            track_id, url = future_map[future]
            try:
                duration = future.result()
                results.append((track_id, duration))
                updated += 1
            except Exception as exc:
                failures += 1
                logger.warning("duration_backfill_probe_failed track_id=%s url=%s error=%s", track_id, url, exc)

    if results:
        with engine.begin() as conn:
            for track_id, duration in results:
                conn.execute(
                    text("UPDATE mixes SET duration_seconds = :duration WHERE id = :id"),
                    {"duration": duration, "id": track_id},
                )

    logger.info("duration_backfill_complete updated=%s failures=%s", updated, failures)
    return updated, failures


async def maybe_backfill_missing_track_durations() -> None:
    if not _duration_backfill_enabled():
        return

    try:
        updated, failures = await asyncio.to_thread(_backfill_sync)
        logger.info("duration_backfill_summary updated=%s failures=%s", updated, failures)
    except Exception:
        logger.exception("duration_backfill_crashed")
