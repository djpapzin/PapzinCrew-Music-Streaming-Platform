import os
import re
import sys
import argparse
from pathlib import Path

# Ensure we can import the backend app modules
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db.database import SessionLocal  # type: ignore
from app.models.models import Mix  # type: ignore


def resolve_local_path(file_path: str, upload_dir: str) -> str | None:
    """
    Resolve a local path for an audio file, mirroring logic in app.routers.tracks.stream_track.
    Returns absolute path if found, else None.
    """
    norm_path = (file_path or '').replace('\\', '/').strip()
    if not norm_path:
        return None

    candidates: list[str] = []
    # Original as-is
    candidates.append(file_path)

    # Map /uploads/... or uploads/... to the actual UPLOAD_DIR
    if norm_path.startswith('/uploads/'):
        rel = norm_path.split('/uploads/', 1)[1]
        candidates.append(os.path.join(upload_dir, rel))
    if norm_path.startswith('uploads/'):
        rel = norm_path.split('uploads/', 1)[1]
        candidates.append(os.path.join(upload_dir, rel))

    # Basename inside UPLOAD_DIR
    candidates.append(os.path.join(upload_dir, os.path.basename(norm_path)))

    for p in candidates:
        try:
            if p and os.path.exists(p):
                return os.path.abspath(p)
        except Exception:
            pass

    # Fallback: numbered variants like *_1.mp3 -> choose highest *_N.mp3
    base_name = os.path.basename(norm_path)
    m = re.match(r"^(.+?)_(\d+)(\.[^\.]+)$", base_name)
    if m:
        prefix = m.group(1) + "_"
        ext = m.group(3)
        try:
            matches: list[tuple[int, str]] = []
            for fname in os.listdir(upload_dir):
                if fname.startswith(prefix) and fname.endswith(ext):
                    pattern = r"^.+?_(\\d+)" + re.escape(ext) + r"$"
                    m2 = re.match(pattern, fname)
                    if m2:
                        try:
                            matches.append((int(m2.group(1)), fname))
                        except Exception:
                            pass
            if matches:
                matches.sort(key=lambda x: x[0], reverse=True)
                return os.path.abspath(os.path.join(upload_dir, matches[0][1]))
        except Exception:
            pass

    return None


def main():
    parser = argparse.ArgumentParser(description='Scan and optionally prune unplayable tracks (missing local files).')
    parser.add_argument('--delete', action='store_true', help='Delete unplayable DB rows (destructive).')
    parser.add_argument('--upload-dir', default=os.getenv('UPLOAD_DIR', 'uploads'), help='Upload directory (default from env or "uploads").')
    args = parser.parse_args()

    upload_dir = args.upload_dir
    os.makedirs(upload_dir, exist_ok=True)

    session = SessionLocal()
    try:
        mixes = session.query(Mix).order_by(Mix.id.asc()).all()
        unplayable: list[Mix] = []
        playable_count = 0

        for mx in mixes:
            fp = (mx.file_path or '').strip()
            if not fp:
                unplayable.append(mx)
                print(f"[UNPLAYABLE] id={mx.id} title={mx.title!r} reason=no file_path")
                continue

            if fp.startswith('http://') or fp.startswith('https://'):
                # Consider B2/remote playable (CORS handled separately)
                playable_count += 1
                print(f"[OK-REMOTE] id={mx.id} title={mx.title!r} url={fp}")
                continue

            resolved = resolve_local_path(fp, upload_dir)
            if resolved:
                playable_count += 1
                print(f"[OK-LOCAL]  id={mx.id} title={mx.title!r} path={resolved}")
            else:
                unplayable.append(mx)
                print(f"[UNPLAYABLE] id={mx.id} title={mx.title!r} reason=missing file; file_path={fp}")

        print('\nSummary:')
        print(f"  Total tracks:    {len(mixes)}")
        print(f"  Playable tracks: {playable_count}")
        print(f"  Unplayable:      {len(unplayable)}")

        if args.delete and unplayable:
            print(f"\nDeleting {len(unplayable)} unplayable tracks from DB...")
            for mx in unplayable:
                session.delete(mx)
            session.commit()
            print("Done.")
        elif args.delete:
            print("No unplayable tracks to delete.")

    finally:
        session.close()


if __name__ == '__main__':
    main()
