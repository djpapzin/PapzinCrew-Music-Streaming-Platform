import os
import sys
import mutagen
from sqlalchemy.orm import Session

# Add the project root to the Python path to allow importing app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import SessionLocal
from app.models import models

UPLOAD_DIR = "uploads"

def fix_cover_art_for_existing_mixes():
    """
    Iterates through all mixes in the database, extracts embedded cover art
    from the audio file, saves it, and updates the database record.
    """
    db: Session = SessionLocal()
    try:
        mixes_to_process = db.query(models.Mix).filter(models.Mix.cover_art_url == None).all()
        
        if not mixes_to_process:
            print("All mixes already have cover art. No action needed.")
            return

        print(f"Found {len(mixes_to_process)} mixes without cover art. Starting process...")

        for mix in mixes_to_process:
            if not mix.file_path or not os.path.exists(mix.file_path):
                print(f"-> Skipping mix '{mix.title}' (ID: {mix.id}) because file does not exist at path: {mix.file_path}")
                continue

            print(f"-> Processing mix: '{mix.title}' (ID: {mix.id})")

            try:
                audio_metadata = mutagen.File(mix.file_path)
                if audio_metadata and 'APIC:' in audio_metadata:
                    artwork = audio_metadata.tags['APIC:'].data
                    
                    base_filename = os.path.splitext(os.path.basename(mix.file_path))[0]
                    cover_art_filename = f"{base_filename}.jpg"
                    cover_art_path = os.path.join(UPLOAD_DIR, cover_art_filename)
                    
                    with open(cover_art_path, 'wb') as img:
                        img.write(artwork)
                    
                    cover_art_url = f'/{UPLOAD_DIR}/{cover_art_filename}'
                    mix.cover_art_url = cover_art_url
                    print(f"  + Successfully extracted and saved cover art to {cover_art_path}")
                    print(f"  + Updating database with URL: {cover_art_url}")
                else:
                    print("  - No 'APIC:' tag found in the audio file's metadata.")

            except Exception as e:
                print(f"  - ERROR processing file {mix.file_path}: {e}")

        db.commit()
        print("\n✅ Cover art processing complete. Changes have been committed to the database.")

    finally:
        db.close()

if __name__ == "__main__":
    fix_cover_art_for_existing_mixes() 