import os
import re
import sys
import argparse
import time
import uuid
from pathlib import Path
from typing import Optional

# Ensure backend app modules are importable
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db.database import SessionLocal  # type: ignore
from app.models.models import Mix  # type: ignore
from app.services.b2_storage import B2Storage  # type: ignore


def sanitize_for_key(s: str) -> str:
    s = (s or "").lower()
    s = re.sub(r"[^a-z0-9\-]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s or "track"


def resolve_local_path(file_path: str, upload_dir: str) -> Optional[str]:
    norm = (file_path or "").replace("\\", "/").strip()
    if not norm:
        return None

    candidates = []
    candidates.append(file_path)
    if norm.startswith("/uploads/"):
        rel = norm.split("/uploads/", 1)[1]
        candidates.append(os.path.join(upload_dir, rel))
    if norm.startswith("uploads/"):
        rel = norm.split("uploads/", 1)[1]
        candidates.append(os.path.join(upload_dir, rel))
    candidates.append(os.path.join(upload_dir, os.path.basename(norm)))

    for p in candidates:
        try:
            if p and os.path.exists(p):
                return os.path.abspath(p)
        except Exception:
            pass
    return None


def migrate_one(session, mix: Mix, upload_dir: str, dry_run: bool = False, key_prefix: str = "audio") -> bool:
    fp = (mix.file_path or "").strip()
    if not fp or fp.startswith("http://") or fp.startswith("https://"):
        # Already remote or empty
        return False

    local_path = resolve_local_path(fp, upload_dir)
    if not local_path or not os.path.exists(local_path):
        print(f"[SKIP] id={mix.id} title={mix.title!r} reason=missing local file; file_path={fp}")
        return False

    # Prepare B2 key
    artist_name = getattr(getattr(mix, 'artist', None), 'name', '') or ''
    base = f"{artist_name} - {mix.title}".strip(" -")
    clean_base = sanitize_for_key(base)
    ext = os.path.splitext(local_path)[1] or ".mp3"
    ts = int(time.time())
    suffix = str(uuid.uuid4())[:8]
    key = f"{key_prefix}/{clean_base}-{ts}-{suffix}{ext}"

    # Read bytes
    with open(local_path, "rb") as f:
        data = f.read()

    b2 = B2Storage()
    if not b2.is_configured():
        print("[ERR] B2 not configured. Aborting.")
        return False

    print(f"[PUT] id={mix.id} key={key} size={len(data)}B from={local_path}")
    res = b2.put_bytes_safe(key, data, content_type="audio/mpeg")
    if not res.get("ok"):
        print(f"[ERR] upload failed code={res.get('error_code')} detail={res.get('detail')}")
        return False

    url = res.get("url")
    print(f"[OK]  uploaded -> {url}")
    if dry_run:
        print("[DRY] skipping DB update")
        return True

    # Update DB
    mix.file_path = url
    session.add(mix)
    session.commit()
    print(f"[OK]  DB updated id={mix.id} file_path -> B2 URL")
    return True


def main():
    parser = argparse.ArgumentParser(description="Migrate mixes that reference local files to B2 and update DB file_path to B2 URL.")
    parser.add_argument("--id", type=int, help="Migrate a single mix by ID")
    parser.add_argument("--all", action="store_true", help="Migrate all mixes that reference local files")
    parser.add_argument("--dry-run", action="store_true", help="Do not modify DB; just show actions")
    parser.add_argument("--upload-dir", default=os.getenv("UPLOAD_DIR", "uploads"), help="Local uploads directory")
    parser.add_argument("--key-prefix", default="audio", help="B2 key prefix (default: audio)")
    args = parser.parse_args()

    session = SessionLocal()
    try:
        if args.id:
            mix = session.query(Mix).filter(Mix.id == args.id).first()
            if not mix:
                print(f"No mix found with id={args.id}")
                return
            migrate_one(session, mix, args.upload_dir, dry_run=args.dry_run, key_prefix=args.key_prefix)
            return

        if args.all:
            mixes = session.query(Mix).order_by(Mix.id.asc()).all()
            migrated = 0
            for mx in mixes:
                fp = (mx.file_path or "").strip()
                if fp and not (fp.startswith("http://") or fp.startswith("https://")):
                    if migrate_one(session, mx, args.upload_dir, dry_run=args.dry_run, key_prefix=args.key_prefix):
                        migrated += 1
            print(f"Done. Migrated {migrated} mixes.")
            return

        print("Nothing to do. Pass --id <N> or --all. Use --dry-run to preview.")
    finally:
        session.close()


if __name__ == "__main__":
    main()
