#!/usr/bin/env python3
"""
Delete a track by ID - removes B2 files, local cover art, and database entry.
Usage: python delete_track.py <track_id>
"""
import os
import sys
import argparse
from pathlib import Path

# Add backend to path
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db.database import SessionLocal
from app.models.models import Mix
from app.services.b2_storage import B2Storage

def delete_track(track_id: int):
    """Delete a track completely - B2 files, local files, and DB entry."""
    session = SessionLocal()
    try:
        # Get the track
        mix = session.query(Mix).filter(Mix.id == track_id).first()
        if not mix:
            print(f"❌ Track {track_id} not found in database")
            return False
        
        print(f"🎵 Found track: '{mix.title}' by {mix.artist.name if mix.artist else 'Unknown'}")
        
        # Delete B2 audio file if it exists
        audio_deleted = False
        if mix.file_path and (mix.file_path.startswith('http://') or mix.file_path.startswith('https://')):
            try:
                b2 = B2Storage()
                if b2.is_configured():
                    audio_key = b2.extract_key_from_url(mix.file_path)
                    if audio_key:
                        audio_deleted = b2.delete_file(audio_key)
                        if audio_deleted:
                            print(f"✅ Deleted B2 audio file: {audio_key}")
                        else:
                            print(f"⚠️  Failed to delete B2 audio file: {audio_key}")
                    else:
                        print(f"⚠️  Could not extract B2 key from: {mix.file_path}")
                else:
                    print("⚠️  B2 not configured, skipping audio deletion")
            except Exception as e:
                print(f"❌ Error deleting B2 audio: {e}")
        
        # Delete local cover art if it exists
        cover_deleted = False
        if mix.cover_art_url and mix.cover_art_url.startswith('/uploads/'):
            try:
                upload_dir = os.getenv('UPLOAD_DIR', 'uploads')
                # Remove leading /uploads/ to get relative path
                relative_path = mix.cover_art_url[9:]  # Remove '/uploads/'
                local_cover_path = os.path.join(upload_dir, relative_path)
                
                if os.path.exists(local_cover_path):
                    os.remove(local_cover_path)
                    cover_deleted = True
                    print(f"✅ Deleted local cover art: {local_cover_path}")
                else:
                    print(f"⚠️  Local cover art not found: {local_cover_path}")
            except Exception as e:
                print(f"❌ Error deleting local cover: {e}")
        
        # Delete database entry
        try:
            session.delete(mix)
            session.commit()
            print(f"✅ Deleted database entry for track {track_id}")
        except Exception as e:
            session.rollback()
            print(f"❌ Error deleting database entry: {e}")
            return False
        
        print(f"🎉 Successfully deleted track {track_id}: '{mix.title}'")
        return True
        
    except Exception as e:
        session.rollback()
        print(f"❌ Unexpected error: {e}")
        return False
    finally:
        session.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Delete a track by ID")
    parser.add_argument("track_id", type=int, help="Track ID to delete")
    args = parser.parse_args()
    
    success = delete_track(args.track_id)
    sys.exit(0 if success else 1)
