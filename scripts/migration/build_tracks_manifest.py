#!/usr/bin/env python3
"""
Build track manifest for DB import from:
- rclone lsjson output
- rclone lsf output
- a local directory walk

Outputs JSON and/or CSV with normalized fields suitable for import_tracks_to_db.py.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Iterable, Optional

AUDIO_EXTS = {".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".wma", ".aiff"}

try:
    import mutagen  # type: ignore
except Exception:
    mutagen = None


@dataclass
class ManifestRow:
    file_path: str
    key: str
    title: str
    original_filename: str
    duration_seconds: int
    file_size_mb: float
    quality_kbps: int
    artist_id: Optional[int] = None


def normalize_title(filename: str) -> str:
    stem = Path(filename).stem
    stem = re.sub(r"[_]+", " ", stem)
    stem = re.sub(r"\s+", " ", stem).strip()
    return stem or filename


def should_include(path_str: str) -> bool:
    return Path(path_str).suffix.lower() in AUDIO_EXTS


def maybe_duration(path: Optional[Path]) -> int:
    if not path or not path.exists() or mutagen is None:
        return 0
    try:
        audio = mutagen.File(str(path))
        if audio is not None and getattr(audio, "info", None) and getattr(audio.info, "length", None):
            return int(float(audio.info.length))
    except Exception:
        pass
    return 0


def from_lsjson(lsjson_path: Path, b2_prefix: str, artist_id: Optional[int], local_root: Optional[Path]) -> list[ManifestRow]:
    raw = json.loads(lsjson_path.read_text(encoding="utf-8"))
    rows: list[ManifestRow] = []
    for item in raw:
        if item.get("IsDir"):
            continue
        p = str(item.get("Path", "")).strip()
        if not p or not should_include(p):
            continue
        key = f"{b2_prefix.rstrip('/')}/{p.lstrip('/')}" if b2_prefix else p
        filename = Path(p).name
        local_candidate = local_root / p if local_root else None
        rows.append(
            ManifestRow(
                file_path=key,
                key=key,
                title=normalize_title(filename),
                original_filename=filename,
                duration_seconds=maybe_duration(local_candidate),
                file_size_mb=round((int(item.get("Size") or 0) / (1024 * 1024)), 4),
                quality_kbps=0,
                artist_id=artist_id,
            )
        )
    return rows


def from_lsf(lsf_path: Path, b2_prefix: str, artist_id: Optional[int], local_root: Optional[Path]) -> list[ManifestRow]:
    rows: list[ManifestRow] = []
    for line in lsf_path.read_text(encoding="utf-8").splitlines():
        p = line.strip()
        if not p or p.endswith("/") or not should_include(p):
            continue
        key = f"{b2_prefix.rstrip('/')}/{p.lstrip('/')}" if b2_prefix else p
        filename = Path(p).name
        local_candidate = local_root / p if local_root else None
        size_mb = 0.0
        if local_candidate and local_candidate.exists():
            size_mb = round(local_candidate.stat().st_size / (1024 * 1024), 4)
        rows.append(
            ManifestRow(
                file_path=key,
                key=key,
                title=normalize_title(filename),
                original_filename=filename,
                duration_seconds=maybe_duration(local_candidate),
                file_size_mb=size_mb,
                quality_kbps=0,
                artist_id=artist_id,
            )
        )
    return rows


def from_local_dir(local_dir: Path, b2_prefix: str, artist_id: Optional[int]) -> list[ManifestRow]:
    rows: list[ManifestRow] = []
    for p in sorted(local_dir.rglob("*")):
        if not p.is_file():
            continue
        rel = p.relative_to(local_dir).as_posix()
        if not should_include(rel):
            continue
        key = f"{b2_prefix.rstrip('/')}/{rel.lstrip('/')}" if b2_prefix else rel
        rows.append(
            ManifestRow(
                file_path=key,
                key=key,
                title=normalize_title(p.name),
                original_filename=p.name,
                duration_seconds=maybe_duration(p),
                file_size_mb=round(p.stat().st_size / (1024 * 1024), 4),
                quality_kbps=0,
                artist_id=artist_id,
            )
        )
    return rows


def dedupe(rows: Iterable[ManifestRow]) -> list[ManifestRow]:
    by_path: dict[str, ManifestRow] = {}
    for row in rows:
        by_path[row.file_path] = row
    return list(by_path.values())


def write_json(rows: list[ManifestRow], out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps([asdict(r) for r in rows], indent=2), encoding="utf-8")


def write_csv(rows: list[ManifestRow], out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "file_path",
        "key",
        "title",
        "original_filename",
        "duration_seconds",
        "file_size_mb",
        "quality_kbps",
        "artist_id",
    ]
    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow(asdict(row))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build tracks manifest for DB import")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--lsjson", type=Path, help="Path to rclone lsjson -R output")
    group.add_argument("--lsf", type=Path, help="Path to rclone lsf -R output")
    group.add_argument("--local-dir", type=Path, help="Local synced directory")

    parser.add_argument("--b2-prefix", default=os.getenv("B2_PREFIX", "audio/migration"), help="Object key prefix")
    parser.add_argument("--artist-id", type=int, default=(int(os.getenv("MIGRATION_ARTIST_ID")) if os.getenv("MIGRATION_ARTIST_ID") else None))
    parser.add_argument("--local-root", type=Path, default=(Path(os.getenv("MIGRATION_LOCAL_ROOT")) if os.getenv("MIGRATION_LOCAL_ROOT") else None), help="Optional local root to resolve duration/size when using lsjson/lsf")

    parser.add_argument("--out-json", type=Path, default=Path("logs/migration/tracks_manifest.json"))
    parser.add_argument("--out-csv", type=Path, default=Path("logs/migration/tracks_manifest.csv"))
    parser.add_argument("--no-json", action="store_true")
    parser.add_argument("--no-csv", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if args.lsjson:
        rows = from_lsjson(args.lsjson, args.b2_prefix, args.artist_id, args.local_root)
    elif args.lsf:
        rows = from_lsf(args.lsf, args.b2_prefix, args.artist_id, args.local_root)
    else:
        rows = from_local_dir(args.local_dir, args.b2_prefix, args.artist_id)

    rows = sorted(dedupe(rows), key=lambda r: r.file_path)

    if not args.no_json:
        write_json(rows, args.out_json)
    if not args.no_csv:
        write_csv(rows, args.out_csv)

    mutagen_state = "enabled" if mutagen is not None else "disabled"
    print(f"Built manifest rows={len(rows)} mutagen={mutagen_state}")
    if not args.no_json:
        print(f"JSON: {args.out_json}")
    if not args.no_csv:
        print(f"CSV : {args.out_csv}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
