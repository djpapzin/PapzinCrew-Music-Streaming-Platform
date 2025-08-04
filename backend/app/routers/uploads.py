import os
import shutil
import re
import tempfile
import base64
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session
from typing import List, Optional
import mutagen
from mutagen.mp3 import MP3
from mutagen.id3 import ID3NoHeaderError

from .. import schemas, crud
from ..db.database import get_db
from ..models import models

router = APIRouter(prefix="/upload", tags=["upload"])

UPLOAD_DIR = "uploads"

# Make sure the upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)

def sanitize_filename(filename: str) -> str:
    """Removes invalid characters from a filename."""
    return re.sub(r'[\\/*?:"<>|]', "", filename)

def get_unique_filepath(db: Session, directory: str, filename:str) -> str:
    """
    Generates a unique file path by checking both the filesystem and the database,
    and appending a number if the file already exists.
    """
    sanitized = sanitize_filename(filename)
    base, extension = os.path.splitext(sanitized)
    counter = 1
    new_filepath = os.path.join(directory, sanitized)

    while os.path.exists(new_filepath):
        # Check filesystem only, skip database check to avoid query issues
        new_filepath = os.path.join(directory, f"{base}-{counter}{extension}")
        counter += 1
        # Add safety limit to prevent infinite loop
        if counter > 1000:
            break
    
    return new_filepath

@router.post("/extract-metadata")
async def extract_metadata(file: UploadFile = File(...)):
    """
    Extract metadata from an audio file without saving it permanently.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    # Create a temporary file to analyze
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
        try:
            # Copy uploaded file to temporary file
            shutil.copyfileobj(file.file, temp_file)
            temp_file.flush()
            
            # Extract metadata
            try:
                audio = mutagen.File(temp_file.name)
                if audio is None:
                    raise HTTPException(status_code=400, detail="Invalid audio file")
                
                # Initialize metadata dictionary
                metadata = {
                    "title": "",
                    "artist": "",
                    "album": "",
                    "year": None,
                    "genre": "",
                    "duration_seconds": 0,
                    "bitrate": 0,
                    "file_size_mb": 0,
                    "cover_art": None
                }
                
                # Extract basic info
                if hasattr(audio, 'info'):
                    metadata["duration_seconds"] = int(audio.info.length) if audio.info.length else 0
                    metadata["bitrate"] = int(audio.info.bitrate / 1000) if hasattr(audio.info, 'bitrate') and audio.info.bitrate else 0
                
                # Get file size
                metadata["file_size_mb"] = round(os.path.getsize(temp_file.name) / (1024 * 1024), 2)
                
                # Extract tags based on file type
                if audio.tags:
                    # Try common tag formats
                    title_tags = ['TIT2', 'TITLE', '\xa9nam']
                    artist_tags = ['TPE1', 'ARTIST', '\xa9ART']
                    album_tags = ['TALB', 'ALBUM', '\xa9alb']
                    year_tags = ['TDRC', 'DATE', '\xa9day', 'TYER']
                    genre_tags = ['TCON', 'GENRE', '\xa9gen']
                    
                    for tag in title_tags:
                        if tag in audio.tags:
                            metadata["title"] = str(audio.tags[tag][0]) if isinstance(audio.tags[tag], list) else str(audio.tags[tag])
                            break
                    
                    for tag in artist_tags:
                        if tag in audio.tags:
                            metadata["artist"] = str(audio.tags[tag][0]) if isinstance(audio.tags[tag], list) else str(audio.tags[tag])
                            break
                    
                    for tag in album_tags:
                        if tag in audio.tags:
                            metadata["album"] = str(audio.tags[tag][0]) if isinstance(audio.tags[tag], list) else str(audio.tags[tag])
                            break
                    
                    for tag in year_tags:
                        if tag in audio.tags:
                            year_str = str(audio.tags[tag][0]) if isinstance(audio.tags[tag], list) else str(audio.tags[tag])
                            try:
                                # Extract year from date string (e.g., "2023-01-01" -> 2023)
                                metadata["year"] = int(year_str[:4]) if len(year_str) >= 4 else None
                            except (ValueError, TypeError):
                                pass
                            break
                    
                    for tag in genre_tags:
                        if tag in audio.tags:
                            metadata["genre"] = str(audio.tags[tag][0]) if isinstance(audio.tags[tag], list) else str(audio.tags[tag])
                            break
                
                # Extract cover art
                try:
                    if audio.tags:
                        # Try different cover art tag formats
                        cover_art_data = None
                        
                        # For MP3 files (ID3 tags)
                        if 'APIC:' in audio.tags:
                            cover_art_data = audio.tags['APIC:'].data
                        elif 'APIC' in audio.tags:
                            cover_art_data = audio.tags['APIC'].data
                        # For MP4/M4A files
                        elif 'covr' in audio.tags:
                            cover_art_data = audio.tags['covr'][0]
                        # For FLAC files
                        elif hasattr(audio, 'pictures') and audio.pictures:
                            cover_art_data = audio.pictures[0].data
                        
                        if cover_art_data:
                            # Convert to base64 for frontend display
                            cover_art_base64 = base64.b64encode(cover_art_data).decode('utf-8')
                            metadata["cover_art"] = f"data:image/jpeg;base64,{cover_art_base64}"
                            
                except Exception as e:
                    print(f"Could not extract cover art: {e}")
                
                # If no title found, use filename without extension
                if not metadata["title"]:
                    metadata["title"] = os.path.splitext(file.filename)[0]
                
                return metadata
                
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Error extracting metadata: {str(e)}")
                
        finally:
            # Clean up temporary file
            try:
                os.unlink(temp_file.name)
            except OSError:
                pass

@router.post("", response_model=schemas.Mix, status_code=201)
async def upload_mix(
    title: str = Form(...),
    artist_name: str = Form(...),
    album: Optional[str] = Form(None),
    year: Optional[int] = Form(None),
    description: Optional[str] = Form(None),
    tracklist: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    genre: Optional[str] = Form(None),
    availability: Optional[str] = Form('public'),
    allow_downloads: Optional[str] = Form('yes'),
    display_embed: Optional[str] = Form('yes'),
    age_restriction: Optional[str] = Form('all'),
    file: UploadFile = File(...),
    cover_art: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """
    Upload a new mix file with metadata.
    """
    # Check if artist exists or create a new one
    db_artist = crud.get_artist_by_name(db, name=artist_name)
    if db_artist is None:
        artist_data = schemas.ArtistCreate(name=artist_name)
        db_artist = crud.create_artist(db, artist=artist_data)

    # Sanitize and create a descriptive filename
    file_extension = os.path.splitext(file.filename)[1]
    descriptive_filename = f"{artist_name} - {title}{file_extension}"
    file_path = get_unique_filepath(db, UPLOAD_DIR, descriptive_filename)
    unique_filename = os.path.basename(file_path)
    
    # Save the file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save the uploaded file: {e}"
        )
    
    # Extract metadata from the file
    try:
        audio = MP3(file_path)
        duration_seconds = int(audio.info.length)
        file_size_mb = os.path.getsize(file_path) / (1024 * 1024)  # Convert bytes to MB
        quality_kbps = int(audio.info.bitrate / 1000)  # Convert to kbps
        
        # Extract BPM if available
        bpm = None
        if audio.tags and 'TBPM' in audio.tags:
            try:
                bpm_str = str(audio.tags['TBPM'])
                bpm = int(float(bpm_str))
                print(f"Extracted BPM: {bpm}")
            except (ValueError, TypeError) as e:
                print(f"Error parsing BPM: {e}")
    except Exception as e:
        # If metadata extraction fails, use default values
        print(f"Metadata extraction error: {e}")
        duration_seconds = 0
        file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
        quality_kbps = 0
        bpm = None
    
    # Handle cover art
    cover_art_filename = None
    unique_base_name = os.path.splitext(unique_filename)[0]

    if cover_art:
        cover_art_extension = os.path.splitext(cover_art.filename)[1] if cover_art.filename else '.jpg'
        cover_art_filename = f"{unique_base_name}{cover_art_extension}"
        cover_art_path = os.path.join(UPLOAD_DIR, cover_art_filename)
        with open(cover_art_path, 'wb') as img:
            shutil.copyfileobj(cover_art.file, img)
    else:
        # Try to extract from metadata if not uploaded
        try:
            audio_metadata = mutagen.File(file_path)
            if audio_metadata and 'APIC:' in audio_metadata:
                artwork = audio_metadata.tags['APIC:'].data
                cover_art_filename = f"{unique_base_name}.jpg"
                cover_art_path = os.path.join(UPLOAD_DIR, cover_art_filename)
                with open(cover_art_path, 'wb') as img:
                    img.write(artwork)
        except Exception as e:
            print(f"Could not extract cover art from metadata: {e}")

    # Create mix in database
    mix_data = schemas.MixCreate(
        title=title,
        original_filename=file.filename,
        artist_id=db_artist.id,
        duration_seconds=duration_seconds,
        file_size_mb=file_size_mb,
        quality_kbps=quality_kbps,
        bpm=bpm,
        file_path=file_path,
        cover_art_url=f'/{UPLOAD_DIR}/{cover_art_filename}' if cover_art_filename else None,
        description=description,
        tracklist=tracklist,
        tags=tags,
        genre=genre,
        album=album,
        year=year,
        availability=availability,
        allow_downloads=allow_downloads,
        display_embed=display_embed,
        age_restriction=age_restriction
    )
    
    return crud.create_mix(db=db, mix=mix_data) 