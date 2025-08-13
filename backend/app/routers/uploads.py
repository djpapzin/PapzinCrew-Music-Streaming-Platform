import os
import shutil
import re
import tempfile
import base64
import mimetypes
import hashlib
from io import BytesIO
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from typing import List, Optional, Dict, Any, Tuple
import mutagen
from mutagen.mp3 import MP3, HeaderNotFoundError
from mutagen.id3 import ID3NoHeaderError
from pathlib import Path
from fastapi.responses import JSONResponse
from difflib import SequenceMatcher
import asyncio
import time
import logging

logger = logging.getLogger(__name__)

# Simple terminal print helper (toggle with ENABLE_UPLOAD_PRINTS=1/0)
ENABLE_UPLOAD_PRINTS = os.getenv("ENABLE_UPLOAD_PRINTS", "0").lower() in ("1", "true", "yes")
def termprint(msg: str) -> None:
    if ENABLE_UPLOAD_PRINTS:
        try:
            logger.info(msg)
        except Exception:
            pass

# python-magic is optional on Windows; fall back gracefully if unavailable
try:  # pragma: no cover - environment dependent
    import magic  # type: ignore
    HAS_MAGIC = True
except Exception:  # pragma: no cover - environment dependent
    magic = None  # type: ignore
    HAS_MAGIC = False

from .. import schemas, crud
from ..db.database import get_db
from ..models import models
from ..services.ai_art_generator import AIArtGenerator
from ..services.b2_storage import B2Storage

router = APIRouter(prefix="/upload", tags=["upload"])

async def _save_cover_art(cover_bytes: bytes, base_name: str, upload_dir: str, source: str = "unknown") -> str:
    """
    Save cover art to B2 storage first, with local fallback.
    Returns the public URL of the saved cover art.
    """
    try:
        # Generate unique cover art filename
        cover_extension = ".jpg"  # Default to JPG for cover art
        cover_filename = f"{base_name}-cover{cover_extension}"
        cover_key = f"covers/{cover_filename}"
        
        # Try B2 upload first
        b2 = B2Storage()
        public_cover_url = None
        
        if b2.is_configured():
            logger.info("🎨 Uploading cover art to B2 storage (%s, %d bytes)", source, len(cover_bytes))
            try:
                b2_timeout = float(os.getenv('B2_PUT_TIMEOUT', '20'))
                result = await asyncio.wait_for(
                    asyncio.to_thread(
                        b2.put_bytes_safe,
                        cover_key,
                        cover_bytes,
                        "image/jpeg"
                    ),
                    timeout=b2_timeout
                )
                if result.get("ok"):
                    public_cover_url = result.get("url")
                    logger.info("✅ Cover art uploaded to B2: %s", public_cover_url)
                else:
                    logger.warning("⚠️ B2 cover upload failed: %s", result.get("detail"))
            except asyncio.TimeoutError:
                logger.warning("⚠️ B2 cover upload timed out")
            except Exception as e:
                logger.warning("⚠️ B2 cover upload error: %s", e)
        
        # Fallback to local storage if B2 fails
        if not public_cover_url:
            logger.info("📁 Saving cover art locally (%s, %d bytes)", source, len(cover_bytes))
            try:
                # Ensure upload directory exists
                if not os.path.exists(upload_dir):
                    os.makedirs(upload_dir)
                
                # Save to local filesystem
                local_cover_path = os.path.join(upload_dir, cover_filename)
                with open(local_cover_path, "wb") as f:
                    f.write(cover_bytes)
                
                public_cover_url = f"/uploads/{cover_filename}"
                logger.info("✅ Cover art saved locally: %s", public_cover_url)
            except Exception as e:
                logger.error("🚨 Failed to save cover art locally: %s", e)
                return None
        
        return public_cover_url
        
    except Exception as e:
        logger.error("🚨 Error in _save_cover_art: %s", e)
        return None

def extract_metadata_from_file(file: UploadFile) -> dict:
    """
    Extract metadata from an audio file using mutagen (in-memory, no temp files).
    Returns a dictionary with the extracted metadata.
    """
    # Read bytes without consuming the stream for callers
    try:
        file.file.seek(0)
        data = file.file.read()
        file.file.seek(0)
    except Exception as e:
        logger.warning("Failed reading upload bytes for metadata: %s", e)
        data = b""

    metadata = {}
    try:
        audio = mutagen.File(BytesIO(data), easy=True)
        if audio is not None:
            metadata = {
                'title': audio.get('title', [''])[0],
                'artist': audio.get('artist', [''])[0],
                'album': audio.get('album', [''])[0],
                'tracknumber': audio.get('tracknumber', [''])[0],
                'genre': audio.get('genre', [''])[0],
                'date': audio.get('date', [''])[0],
                'duration': int(audio.info.length) if hasattr(audio, 'info') and hasattr(audio.info, 'length') else 0,
            }
            # Clean up metadata (remove empty values)
            metadata = {k: v for k, v in metadata.items() if v}
    except Exception as e:
        logger.warning("Error extracting metadata: %s", e)
        metadata = {}

    # Fallbacks: derive missing artist/title from filename
    stem = Path(file.filename).stem
    if not metadata.get('artist'):
        name_clean = re.sub(r'\s*[\[\(].*?[\]\)]\s*', ' ', stem).strip()
        for sep in [' - ', ' – ', '-', '–', '—', '|', '•']:
            if sep in name_clean:
                parts = name_clean.split(sep)
                if len(parts) >= 2 and parts[0].strip():
                    metadata['artist'] = parts[0].strip()
                    break
    if not metadata.get('title'):
        metadata['title'] = stem

    return metadata

@router.post("/extract-metadata")
async def extract_metadata(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Extract metadata from an audio file.
    Used by the frontend to pre-fill the upload form.
    """
    try:
        # Validate the file
        is_valid, validation_result = validate_audio_file(file, lightweight=True)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=validation_result.get('message', 'Invalid audio file')
            )
        
        # Extract metadata with timeout; fall back to filename stem
        try:
            metadata = await asyncio.wait_for(asyncio.to_thread(extract_metadata_from_file, file), timeout=3.0)
        except asyncio.TimeoutError:
            metadata = {'title': Path(file.filename).stem}
        except Exception as e:
            logger.info("✅ Metadata extracted successfully")
            logger.warning("Metadata extraction error (fast path): %s", e)
            metadata = {'title': Path(file.filename).stem}
        
        # Reset file position for potential further processing
        await file.seek(0)
        
        return {
            'success': True,
            'metadata': metadata,
            'filename': file.filename
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.info("✅ Metadata extracted successfully")
        logger.exception("Error in extract_metadata")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract metadata: {str(e)}"
        )

# Constants

# Constants
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
MAX_FILE_SIZE_MB = 100  # 100MB max file size
SUPPORTED_MIME_TYPES = {
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/x-wav': '.wav',
    'audio/x-aiff': '.aiff',
    'audio/aiff': '.aiff',
    'audio/flac': '.flac',
    'audio/x-flac': '.flac',
    'audio/mp4': '.m4a',
    'audio/x-m4a': '.m4a',
    'audio/ogg': '.ogg',
    'audio/x-ms-wma': '.wma'
}

# Do not create local upload directories; we store only in B2

def validate_audio_file(file: UploadFile, lightweight: bool = False) -> Tuple[bool, Dict[str, Any]]:
    """
    Validate the audio file for type, size, and integrity.
    Returns a tuple of (is_valid: bool, result: Dict).
    """
    # Reset file pointer at start
    try:
        file.file.seek(0)
    except Exception as e:
        return False, {
            'valid': False,
            'error': f'Error reading file: {str(e)}',
            'error_code': 'file_read_error'
        }
    
    # Check file size
    try:
        file_size = len(file.file.read())
        file.file.seek(0)  # Reset file pointer after reading
    except Exception as e:
        return False, {
            'valid': False,
            'error': f'Error reading file size: {str(e)}',
            'error_code': 'file_read_error'
        }
    
    if file_size > MAX_FILE_SIZE_MB * 1024 * 1024:
        return False, {
            'valid': False,
            'error': f'File too large. Maximum size is {MAX_FILE_SIZE_MB}MB',
            'error_code': 'file_too_large'
        }
    
    # First, try to determine MIME type from filename extension
    extension = os.path.splitext((file.filename or '').lower())[1]
    allowed_extensions = {'.mp3', '.wav', '.aiff', '.flac', '.m4a', '.ogg', '.wma'}
    
    # Map extensions to MIME types
    extension_to_mime = {
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.aiff': 'audio/aiff',
        '.flac': 'audio/flac',
        '.m4a': 'audio/mp4',
        '.ogg': 'audio/ogg',
        '.wma': 'audio/x-ms-wma',
    }
    
    # Check if extension is supported
    if extension not in allowed_extensions:
        return False, {
            'valid': False,
            'error': f'Unsupported file type. Supported extensions: {sorted(allowed_extensions)}',
            'error_code': 'unsupported_file_extension'
        }
    
    # Use the MIME type from extension as fallback
    detected_mime = extension_to_mime.get(extension, 'application/octet-stream')
    
    # Lightweight mode: skip deep parsing and return fast
    if lightweight:
        return True, {
            'valid': True,
            'mime_type': detected_mime,
            'file_extension': extension,
            'file_size_bytes': file_size
        }
    
    # Try to validate the file with mutagen for basic integrity
    temp_file = None
    try:
        # Create a temporary file in memory first
        file_content = file.file.read()
        file.file.seek(0)  # Reset file pointer
        
        # Try to parse with mutagen directly from memory
        try:
            audio = mutagen.File(BytesIO(file_content))
            if audio is None:
                raise ValueError("Failed to parse audio file")
                
            # If we got here, the file is valid
            return True, {
                'valid': True,
                'mime_type': detected_mime,
                'file_extension': extension,
                'file_size_bytes': file_size
            }
            
        except Exception as e:
            # If in-memory parsing fails, try with a temporary file as fallback
            try:
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=extension)
                temp_file.write(file_content)
                temp_file.close()
                
                audio = mutagen.File(temp_file.name)
                if audio is None:
                    raise ValueError("Failed to parse audio file")
                    
                return True, {
                    'valid': True,
                    'mime_type': detected_mime,
                    'file_extension': extension,
                    'file_size_bytes': file_size
                }
                
            except Exception as e:
                return False, {
                    'valid': False,
                    'error': f'Invalid or corrupted audio file: {str(e)}',
                    'error_code': 'invalid_audio_file'
                }
            
    except Exception as e:
        return False, {
            'valid': False,
            'error': f'Error validating audio file: {str(e)}',
            'error_code': 'file_validation_error'
        }
        
    finally:
        # Clean up temporary file if it was created
        if temp_file and os.path.exists(temp_file.name):
            try:
                os.unlink(temp_file.name)
            except Exception:
                pass
                
        # Always reset file pointer
        try:
            file.file.seek(0)
        except Exception:
            pass
            pass

def sanitize_filename(filename: str) -> str:
    """Removes invalid characters from a filename."""
    return re.sub(r'[\\/*?:"<>|]', "", filename)

def calculate_file_hash(file_content: bytes) -> str:
    """
    Calculate SHA-256 hash of file content for exact duplicate detection.
    """
    return hashlib.sha256(file_content).hexdigest()

def calculate_similarity(str1: str, str2: str) -> float:
    """
    Calculate similarity ratio between two strings using SequenceMatcher.
    Returns a value between 0.0 and 1.0.
    """
    if not str1 or not str2:
        return 0.0
    return SequenceMatcher(None, str1.lower().strip(), str2.lower().strip()).ratio()

def normalize_string(s: str) -> str:
    """
    Normalize string for comparison by removing special characters and extra spaces.
    """
    if not s:
        return ""
    # Remove special characters, keep only alphanumeric and spaces
    normalized = re.sub(r'[^a-zA-Z0-9\s]', '', s)
    # Replace multiple spaces with single space and strip
    normalized = re.sub(r'\s+', ' ', normalized).strip().lower()
    return normalized

def get_unique_filepath(db: Session, directory: str, filename:str) -> str:
    """
    Generates a unique file path by checking both the filesystem and the database,
    and appending a number if the file already exists.

    IMPORTANT: DB stores public paths like "/uploads/<name>" while the filesystem
    uses "uploads/<name>". We must check for both to avoid UNIQUE violations.
    """
    base_name, extension = os.path.splitext(filename)
    counter = 1
    new_filename = filename

    # Normalize directory for public URL comparison
    public_dir = "/" + directory.replace("\\", "/").strip("/\\")

    while True:
        file_path = os.path.join(directory, new_filename)  # local filesystem style
        public_url_path = f"{public_dir}/{new_filename}"  # how it's stored in DB for local

        # Check if file exists in filesystem OR already referenced in DB
        exists_on_disk = os.path.exists(file_path)
        exists_in_db = db.query(models.Mix).filter(
            or_(
                models.Mix.file_path == file_path,       # historical/local-style path (if any)
                models.Mix.file_path == public_url_path  # public URL style stored by app
            )
        ).first() is not None

        if not exists_on_disk and not exists_in_db:
            return new_filename

        # Generate new filename with counter
        new_filename = f"{base_name}_{counter}{extension}"
        counter += 1
        # Add safety limit to prevent infinite loop
        if counter > 1000:
            break

    return new_filename

@router.post("/extract-metadata")
async def extract_metadata(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Extract metadata from an audio file.
    Used by the frontend to pre-fill the upload form.
    """
    try:
        # Validate the file
        is_valid, validation_result = validate_audio_file(file, lightweight=True)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=validation_result.get('message', 'Invalid audio file')
            )
        
        # Extract metadata with timeout; fall back to filename stem
        try:
            metadata = await asyncio.wait_for(asyncio.to_thread(extract_metadata_from_file, file), timeout=3.0)
        except asyncio.TimeoutError:
            metadata = {'title': Path(file.filename).stem}
        except Exception as e:
            logger.info("✅ Metadata extracted successfully")
            logger.warning("Metadata extraction error (fast path): %s", e)
            metadata = {'title': Path(file.filename).stem}
        
        # Reset file position for potential further processing
        await file.seek(0)
        
        return {
            'success': True,
            'metadata': metadata,
            'filename': file.filename
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.info("✅ Metadata extracted successfully")
        logger.exception("Error in extract_metadata")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract metadata: {str(e)}"
        )

@router.post("/upload-mix")
async def upload_mix(file: UploadFile = File(...), tracklist: Optional[List[Dict[str, Any]]] = None):
    """
    Upload a mix file and optionally provide tracklist data.
    Validates the file before extraction.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "No filename provided", "error_code": "missing_filename"}
        )
    
    # Validate the file first
    is_valid, validation_result = validate_audio_file(file)
    if not is_valid:
        logger.warning("[upload] validation failed: %s", validation_result)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=validation_result
        )
    else:
        logger.info(
            "[upload] validation ok ext=%s mime=%s size_bytes=%s",
            validation_result.get('file_extension'),
            validation_result.get('mime_type'),
            validation_result.get('file_size_bytes'),
        )
    
    # Create a temporary file to analyze
    with tempfile.NamedTemporaryFile(delete=False, suffix=validation_result.get('file_extension', '.mp3')) as temp_file:
        try:
            # Copy uploaded file to temporary file
            shutil.copyfileobj(file.file, temp_file)
            temp_file.flush()
            
            # Extract metadata
            try:
                audio = mutagen.File(temp_file.name)
                if audio is None:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail={"error": "Invalid audio file", "error_code": "invalid_audio"}
                    )
                
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
                        # Look for cover art in common tag locations
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
                    logger.info("🎵 Processing track: %s", file.filename)
                    logger.debug("[upload] could not extract cover from metadata: %s", e)

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

def check_for_duplicate_track(db: Session, title: str, artist_name: str, file_size: int, 
                             file_hash: Optional[str] = None, duration_seconds: Optional[float] = None,
                             album: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Enhanced duplicate detection with multiple detection methods:
    1. Exact file hash match (if provided)
    2. Enhanced metadata comparison (title, artist, duration, album)
    3. Fuzzy matching for similar tracks
    
    Returns the best matching duplicate track if found, None otherwise.
    """
    
    # Method 1: Exact file hash match (highest priority)
    # Only run if the Mix model exposes a file_hash attribute/column
    if file_hash and hasattr(models.Mix, "file_hash"):
        hash_match = db.query(models.Mix).filter(models.Mix.file_hash == file_hash).first()
        if hash_match:
            return {
                "id": hash_match.id,
                "title": hash_match.title,
                "artist_name": hash_match.artist.name if hash_match.artist else "",
                "file_size_mb": hash_match.file_size_mb,
                "uploaded_at": hash_match.release_date.isoformat() if getattr(hash_match, "release_date", None) else None,
                "match_type": "exact_file",
                "confidence": 1.0,
                "reason": "Identical file content detected"
            }
    
    # Method 2: Enhanced metadata comparison
    all_tracks = (
        db.query(models.Mix)
        .join(models.Artist, models.Mix.artist_id == models.Artist.id)
        .all()
    )
    
    best_match = None
    best_confidence = 0.0
    
    # Normalize input for comparison
    norm_title = normalize_string(title)
    norm_artist = normalize_string(artist_name)
    norm_album = normalize_string(album) if album else ""
    
    for track in all_tracks:
        confidence_factors = []
        match_reasons = []
        
        # Title similarity (weight: 40%)
        title_similarity = calculate_similarity(norm_title, normalize_string(track.title))
        confidence_factors.append((title_similarity, 0.4))
        if title_similarity > 0.8:
            match_reasons.append(f"Title match ({title_similarity:.1%})")
        
        # Artist similarity (weight: 30%)
        artist_similarity = calculate_similarity(norm_artist, normalize_string(track.artist.name if track.artist else ""))
        confidence_factors.append((artist_similarity, 0.3))
        if artist_similarity > 0.8:
            match_reasons.append(f"Artist match ({artist_similarity:.1%})")
        
        # Duration similarity (weight: 15%)
        duration_similarity = 0.0
        if duration_seconds and track.duration_seconds:
            duration_diff = abs(duration_seconds - track.duration_seconds)
            # Consider tracks within 5 seconds as similar
            if duration_diff <= 5:
                duration_similarity = 1.0 - (duration_diff / 5)
                match_reasons.append(f"Duration match ({duration_similarity:.1%})")
        confidence_factors.append((duration_similarity, 0.15))
        
        # Album similarity (weight: 10%)
        album_similarity = 0.0
        if norm_album and track.album:
            album_similarity = calculate_similarity(norm_album, normalize_string(track.album))
            if album_similarity > 0.8:
                match_reasons.append(f"Album match ({album_similarity:.1%})")
        confidence_factors.append((album_similarity, 0.1))
        
        # File size similarity (weight: 5%)
        size_similarity = 0.0
        if track.file_size_mb:
            file_size_mb = file_size / (1024 * 1024)
            size_diff_pct = abs(track.file_size_mb - file_size_mb) / max(track.file_size_mb, file_size_mb)
            if size_diff_pct <= 0.1:  # Within 10% size difference
                size_similarity = 1.0 - size_diff_pct
                match_reasons.append(f"Size match ({size_similarity:.1%})")
        confidence_factors.append((size_similarity, 0.05))
        
        # Calculate weighted confidence score
        total_confidence = sum(score * weight for score, weight in confidence_factors)
        
        # Update best match if this is better
        if total_confidence > best_confidence and total_confidence >= 0.7:  # 70% threshold
            best_confidence = total_confidence
            size_diff = abs(track.file_size_mb - (file_size / (1024 * 1024))) if track.file_size_mb else 0
            
            best_match = {
                "id": track.id,
                "title": track.title,
                "artist_name": track.artist.name if track.artist else "",
                "file_size_mb": track.file_size_mb,
                "uploaded_at": track.release_date.isoformat() if getattr(track, "release_date", None) else None,
                "match_type": "metadata",
                "confidence": round(total_confidence, 3),
                "reason": "; ".join(match_reasons) if match_reasons else "Metadata similarity",
                "size_difference_mb": round(size_diff, 2),
                "size_difference_pct": round((size_diff / (file_size / (1024 * 1024))) * 100, 2) if file_size > 0 else 0,
                "title_similarity": round(title_similarity, 3),
                "artist_similarity": round(artist_similarity, 3),
                "duration_similarity": round(duration_similarity, 3) if duration_seconds else None,
                "album_similarity": round(album_similarity, 3) if album else None
            }
    
    return best_match

@router.post("/check-duplicate")
async def api_check_duplicate(
    payload: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """Enhanced endpoint to check for potential duplicates using multiple detection methods."""
    title = str(payload.get("title", "")).strip()
    artist_name = str(payload.get("artist_name", "")).strip()
    file_size = int(payload.get("file_size", 0))
    file_hash = payload.get("file_hash")  # Optional file hash for exact matching
    duration_seconds = payload.get("duration_seconds")  # Optional duration
    album = payload.get("album", "").strip() if payload.get("album") else None

    if not title or not artist_name or file_size <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Missing or invalid fields: 'title', 'artist_name', 'file_size'",
                "error_code": "invalid_request",
            },
        )

    duplicate_info = check_for_duplicate_track(
        db, 
        title=title, 
        artist_name=artist_name, 
        file_size=file_size,
        file_hash=file_hash,
        duration_seconds=duration_seconds,
        album=album
    )
    
    if duplicate_info:
        logger.info("[upload] duplicate detected: %s", duplicate_info.get('reason'))
        # Attempt to remove uploaded objects from B2 on duplicate
        try:
            b2 = B2Storage()
            if b2.is_configured():
                if public_audio_url:
                    audio_key = b2.extract_key_from_url(public_audio_url)
                    if audio_key:
                        b2.delete_file(audio_key)
                if locals().get('public_cover_url'):
                    cover_key = b2.extract_key_from_url(locals().get('public_cover_url'))
                    if cover_key:
                        b2.delete_file(cover_key)
        except Exception:
            pass

        # Return 409 Conflict with enhanced duplicate information
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": f"Duplicate detected: {duplicate_info.get('reason', 'Similar track found')}",
                "error_code": "duplicate_track",
                "duplicate_info": duplicate_info
            }
        )

@router.post("", status_code=201)
@router.post("/", status_code=201)
@router.post("/upload-mix")
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
    custom_prompt: Optional[str] = Form(None),
    skip_duplicate_check: bool = Form(False),  # Allow skipping duplicate check
    db: Session = Depends(get_db)
):
    """
    Upload a new mix file with metadata.
    Validates the file and checks for duplicates before saving.
    """
    logger.info(
        "[upload] start title='%s' artist='%s' filename='%s'",
        title,
        artist_name,
        getattr(file, 'filename', None),
    )
    termprint(f"[upload] start title='{title}' artist='{artist_name}' filename='{getattr(file, 'filename', None)}'")
    # Validate the file first
    is_valid, validation_result = validate_audio_file(file)
    if not is_valid:
        logger.warning("[upload] validation failed: %s", validation_result)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=validation_result
        )
    else:
        logger.info(
            "[upload] validation ok ext=%s mime=%s size_bytes=%s",
            validation_result.get('file_extension'),
            validation_result.get('mime_type'),
            validation_result.get('file_size_bytes'),
        )
    
    # Enhanced duplicate check after file processing (moved after file hash calculation)
    # This will be done after metadata extraction for more accurate detection
    
    # Check if artist exists or create a new one
    # Fallback: derive artist from filename if not provided or blank
    if not artist_name or not artist_name.strip():
        stem = Path(file.filename).stem
        name_clean = re.sub(r'\s*[\[\(].*?[\]\)]\s*', ' ', stem).strip()
        for sep in [' - ', ' – ', '-', '–', '—', '|', '•']:
            if sep in name_clean:
                parts = name_clean.split(sep)
                if len(parts) >= 2 and parts[0].strip():
                    artist_name = parts[0].strip()
                    logger.info("[upload] artist fallback from filename: %s", artist_name)
                    break
        if not artist_name:
            artist_name = "Unknown Artist"
    db_artist = crud.get_artist_by_name(db, name=artist_name)
    if db_artist is None:
        artist_data = schemas.ArtistCreate(name=artist_name)
        db_artist = crud.create_artist(db, artist=artist_data)

    # Sanitize and create descriptive names/keys
    file_extension = validation_result.get('file_extension', os.path.splitext(file.filename)[1])
    sanitized_title = sanitize_filename(title)
    sanitized_artist = sanitize_filename(artist_name)
    descriptive_filename = f"{sanitized_artist} - {sanitized_title}{file_extension}"
    # We will compute file_hash first and then create B2-friendly keys using the hash
    # For local fallback, we still compute a local_file_path for serving via /uploads
    local_file_path = get_unique_filepath(db, UPLOAD_DIR, descriptive_filename)
    unique_filename = os.path.basename(local_file_path)
    base_name = f"{sanitized_artist} - {sanitized_title}"
    
    # Prefer B2 if configured; otherwise we'll use local storage fallback
    b2_precheck = B2Storage()
    if not b2_precheck.is_configured():
        logger.warning("[upload] B2 not configured; will use local storage fallback")
    
    # Read file content into memory (B2-first) and compute hash
    file.file.seek(0)
    audio_bytes = file.file.read()
    file_hash = calculate_file_hash(audio_bytes)
    audio_fileobj = BytesIO(audio_bytes)
    logger.info("[upload] read bytes size=%d hash=%s", len(audio_bytes), file_hash)
    termprint(f"[upload] read bytes size={len(audio_bytes)} hash={file_hash}")
    
    # Extract metadata directly from in-memory bytes
    try:
        # Try MP3-specific first to get bitrate when possible
        try:
            audio_mp3 = MP3(audio_fileobj)
            duration_seconds = int(audio_mp3.info.length)
            quality_kbps = int(audio_mp3.info.bitrate / 1000) if hasattr(audio_mp3.info, 'bitrate') and audio_mp3.info.bitrate else 0
            tags_source = audio_mp3
        except Exception:
            audio_generic = mutagen.File(BytesIO(audio_bytes))
            duration_seconds = int(audio_generic.info.length) if hasattr(audio_generic, 'info') and hasattr(audio_generic, 'length') else 0
            quality_kbps = 0
            tags_source = audio_generic
        file_size_mb = validation_result['file_size_bytes'] / (1024 * 1024)

        bpm = None
        try:
            if getattr(tags_source, 'tags', None) and 'TBPM' in tags_source.tags:
                bpm_str = str(tags_source.tags['TBPM'])
                bpm = int(float(bpm_str))
                logger.info("[upload] extracted BPM=%s", bpm)
        except Exception as e:
            logger.debug("[upload] BPM parse error: %s", e)
        logger.info("🔍 Extracted track metadata: %ss, %s kbps, %.2f MB", duration_seconds, quality_kbps, file_size_mb)
    except Exception as e:
        logger.warning("[upload] metadata extraction error: %s", e)
        duration_seconds = 0
        file_size_mb = validation_result['file_size_bytes'] / (1024 * 1024)
        quality_kbps = 0
        bpm = None
    
    # --- Cover Art Handling (B2-First) ---
    public_cover_url = None
    try:
        # 1. Check for user-uploaded cover art first
        if cover_art and cover_art.filename:
            logger.info("🎵 Processing track: %s", file.filename)
            cover_art.file.seek(0)
            cover_bytes = cover_art.file.read()
            if cover_bytes:
                public_cover_url = await _save_cover_art(cover_bytes, base_name, UPLOAD_DIR, source="uploaded")

        # 2. If no uploaded cover, try to extract from audio metadata
        if not public_cover_url:
            logger.info("🎨 No cover art found in metadata, checking for AI generation...")
            cover_art_data = None
            try:
                tags = getattr(tags_source, 'tags', None)
                if tags:
                    if 'APIC:' in tags: cover_art_data = tags['APIC:'].data
                    elif 'APIC' in tags: cover_art_data = tags['APIC'].data
                    elif 'covr' in tags: cover_art_data = tags['covr'][0]
                elif hasattr(tags_source, 'pictures') and tags_source.pictures:
                    cover_art_data = tags_source.pictures[0].data
                
                if cover_art_data:
                    logger.info("[upload] found extracted cover art in metadata (%d bytes)", len(cover_art_data))
                    public_cover_url = await _save_cover_art(cover_art_data, base_name, UPLOAD_DIR, source="extracted")
            except Exception as e:
                logger.debug("[upload] could not extract cover from metadata: %s", e)

        # 3. If still no cover art, generate one with AI
        if not public_cover_url:
            logger.info("🎨 No cover art found in metadata, checking for AI generation...")
            try:
                ai_generator = AIArtGenerator()
                ai_timeout = float(os.getenv('AI_COVER_TIMEOUT_SECONDS', '45.0'))
                cover_art_bytes = await asyncio.wait_for(
                    asyncio.to_thread(
                        ai_generator.generate_cover_art_from_metadata,
                        title=title, artist=artist_name, genre=genre, custom_prompt=custom_prompt
                    ),
                    timeout=ai_timeout
                )
                if cover_art_bytes:
                    logger.info("[upload] AI generation successful (%d bytes)", len(cover_art_bytes))
                    public_cover_url = await _save_cover_art(cover_art_bytes, base_name, UPLOAD_DIR, source="ai")
                else:
                    logger.warning("[upload] AI generation returned no data")
            except asyncio.TimeoutError:
                logger.warning("[upload] AI cover generation timed out after %ss", ai_timeout)
            except Exception as e:
                logger.error("[upload] AI cover generation failed: %s", e)

    except Exception as e:
        # Don't fail the entire upload if cover art handling fails
        logger.warning("[upload] cover art processing error: %s", e)

    # B2-first: upload audio bytes directly when configured
    public_audio_url = None
    storage_provider = None  # "b2" | "local"
    storage_location = None  # url or local path
    fallback_from_b2 = False
    b2_error_code = None
    # public_cover_url was set during cover art handling above
    try:
        b2 = B2Storage()
        if b2.is_configured():
            # Clean the base name to remove problematic characters
            import re
            import uuid
            clean_base = re.sub(r'[^a-zA-Z0-9\-]', '-', base_name.lower())
            clean_base = re.sub(r'-+', '-', clean_base).strip('-')
            
            if skip_duplicate_check:
                # Generate a more unique key with timestamp and random component
                timestamp = int(time.time())
                random_str = str(uuid.uuid4())[:8]
                safe_hash = (file_hash or f"{timestamp}-{random_str}").replace("/", "_")[:32]
                audio_key = f"audio/{clean_base}-{safe_hash}{file_extension}"
                logger.info("[upload] Using unique key for forced upload: %s", audio_key)
            else:
                # Use descriptive filename for normal uploads
                audio_key = f"audio/{clean_base}{file_extension}"
            logger.info("[upload] B2 audio upload start key=%s size=%dB", audio_key, len(audio_bytes))
            termprint(f"[upload] B2 audio upload start key={audio_key} size={len(audio_bytes)}B")
            b2_timeout = float(os.getenv('B2_PUT_TIMEOUT', '20'))
            start = time.perf_counter()
            try:
                _res = await asyncio.wait_for(
                    asyncio.to_thread(
                        b2.put_bytes_safe,
                        audio_key,
                        audio_bytes,
                        validation_result.get('mime_type', 'audio/mpeg')
                    ),
                    timeout=b2_timeout
                )
                if _res.get("ok"):
                    public_audio_url = _res.get("url")
                    storage_provider = "b2"
                    storage_location = _res.get("key") or _res.get("url")
                else:
                    b2_error_code = _res.get("error_code")
                    logger.warning("[upload] B2 audio upload failed code=%s detail=%s", _res.get("error_code"), _res.get("detail"))
            except asyncio.TimeoutError:
                logger.warning("[upload] B2 audio upload timed out after %ss", b2_timeout)
                public_audio_url = None
                b2_error_code = "timeout"
                termprint(f"[upload] B2 audio upload timed out after {b2_timeout}s")
            else:
                elapsed = (time.perf_counter() - start)
                if public_audio_url:
                    logger.info("[upload] B2 audio upload done in %.2fs url=%s", elapsed, public_audio_url)
    except Exception as e:
        logger.error("[upload] B2 audio upload error: %s", e)
    # Fallback to local storage if B2 is not configured or fails
    if not public_audio_url:
        storage_provider = "local_filesystem"
        fallback_from_b2 = True if b2.is_configured() else False
        logger.warning("[upload] B2 upload failed or not configured, falling back to local storage.")
        termprint("[upload] B2 upload failed or not configured, falling back to local storage.")
        try:
            # Ensure the local uploads directory exists
            if not os.path.exists(UPLOAD_DIR):
                os.makedirs(UPLOAD_DIR)
            # Sanitize filename and get a unique path
            sanitized_filename = sanitize_filename(file.filename or "untitled.mp3")
            unique_filename = get_unique_filepath(db, UPLOAD_DIR, sanitized_filename)
            local_audio_path = os.path.join(UPLOAD_DIR, unique_filename)
            # Save the file to the local filesystem
            with open(local_audio_path, "wb") as buffer:
                buffer.write(audio_bytes)
            public_audio_url = f"/uploads/{unique_filename}"  # This is a relative path for local fallback
            storage_location = local_audio_path
            logger.info("✅ Upload complete! 📁 Access at: %s", public_audio_url)
            termprint(f"[upload] saved to local fallback: {public_audio_url}")
        except Exception as e:
            logger.error("🚨 [upload] local save failed: %s", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"error": f"Failed to save file locally: {e}", "error_code": "local_save_failed"}
            )

    # Enhanced duplicate detection with file hash and metadata
    # ... (rest of the code remains the same)
    duplicate_info = check_for_duplicate_track(
        db=db,
        title=title,
        artist_name=artist_name,
        file_size=validation_result['file_size_bytes'],
        file_hash=file_hash,
        duration_seconds=duration_seconds,
        album=album
    )
    
    if duplicate_info:
        logger.info("[upload] duplicate detected: %s", duplicate_info.get('reason'))
        # Attempt to remove uploaded objects from B2 on duplicate
        try:
            b2 = B2Storage()
            if b2.is_configured():
                if public_audio_url:
                    audio_key = b2.extract_key_from_url(public_audio_url)
                    if audio_key:
                        b2.delete_file(audio_key)
                if locals().get('public_cover_url'):
                    cover_key = b2.extract_key_from_url(locals().get('public_cover_url'))
                    if cover_key:
                        b2.delete_file(cover_key)
        except Exception:
            pass

        # Return 409 Conflict with enhanced duplicate information
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": f"Duplicate detected: {duplicate_info.get('reason', 'Similar track found')}",
                "error_code": "duplicate_track",
                "duplicate_info": duplicate_info
            }
        )

    # Guard against duplicate by exact file_path before DB insert
    # If a mix already exists with the same stored file_path, return 409 and clean up uploaded blobs
    try:
        existing_by_path = (
            db.query(models.Mix)
            .filter(models.Mix.file_path == public_audio_url)
            .first()
        )
    except Exception:
        existing_by_path = None
    if existing_by_path is not None and not skip_duplicate_check:
        try:
            b2 = B2Storage()
            if b2.is_configured() and public_audio_url:
                audio_key = b2.extract_key_from_url(public_audio_url)
                if audio_key:
                    b2.delete_file(audio_key)
            if public_cover_url:
                b2 = B2Storage()
                if b2.is_configured():
                    cover_key = b2.extract_key_from_url(public_cover_url)
                    if cover_key:
                        b2.delete_file(cover_key)
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "Duplicate detected: identical file path already exists",
                "error_code": "duplicate_track",
                "duplicate_info": {
                    "id": existing_by_path.id,
                    "title": existing_by_path.title,
                    "artist_name": existing_by_path.artist.name if existing_by_path.artist else "",
                    "match_type": "file_path_unique",
                    "reason": "Same storage path (file_path)"
                }
            }
        )

    # Use the B2 URL if available, otherwise use the local path
    final_audio_path = public_audio_url
    final_cover_url = public_cover_url if public_cover_url else None

    try:
        logger.info("💾 Saving track to database...")
        mix_data = schemas.MixCreate(
            title=title,
            original_filename=file.filename,
            artist_id=db_artist.id,
            duration_seconds=duration_seconds,
            file_size_mb=file_size_mb,
            quality_kbps=quality_kbps,
            bpm=bpm,
            file_path=final_audio_path,
            cover_art_url=final_cover_url,
            description=description,
            tracklist=tracklist,
            tags=str(tags) if tags else None,
            genre=genre,
            album=album,
            year=year,
            availability=availability,
            allow_downloads='yes' if (allow_downloads is True or str(allow_downloads).lower() == 'yes') else 'no',
            display_embed='yes' if (display_embed is True or str(display_embed).lower() == 'yes') else 'no',
            age_restriction=age_restriction
        )
        
        # Persist and return response
        db_mix = crud.create_mix(db=db, mix=mix_data)
        db.refresh(db_mix)
        from ..schemas import Mix
        response_model = Mix.from_orm(db_mix)
        # Use model_dump and then jsonable_encoder to ensure JSON-serializable types
        response_content = response_model.model_dump()
        response_content['stream_url'] = f'/tracks/{db_mix.id}/stream'
        
        # Add frontend-expected properties
        response_content['success'] = True
        response_content['generating_art'] = bool(public_cover_url)  # True if we generated/processed cover art
        response_content['metadata'] = {
            'title': title,
            'artist': artist_name,
            'album': album,
            'genre': genre,
            'duration_seconds': duration_seconds,
            'file_size_mb': file_size_mb,
            'quality_kbps': quality_kbps,
            'bpm': bpm
        }
        
        # Include storage details in response for observability
        if storage_provider:
            response_content['storage'] = storage_provider
        if storage_location:
            response_content['location'] = storage_location
        if fallback_from_b2:
            response_content['fallback_from_b2'] = True
        logger.info("✅ Success! Track saved with ID: %s", db_mix.id)
        from fastapi.encoders import jsonable_encoder
        resp = JSONResponse(status_code=status.HTTP_201_CREATED, content=jsonable_encoder(response_content))
        # Surface storage details to clients (for UI warnings/telemetry)
        if storage_provider:
            resp.headers['X-Storage-Provider'] = str(storage_provider)
        if storage_location:
            resp.headers['X-Storage-Location'] = str(storage_location)
        if fallback_from_b2:
            resp.headers['X-Local-Fallback'] = '1'
        return resp
        
    except IntegrityError:
        # Unique constraint (e.g., file_path) violation -> map to 409 duplicate
        db.rollback()
        try:
            b2 = B2Storage()
            if b2.is_configured() and public_audio_url:
                audio_key = b2.extract_key_from_url(public_audio_url)
                if audio_key:
                    b2.delete_file(audio_key)
            if public_cover_url:
                cover_key = b2.extract_key_from_url(public_cover_url)
                if cover_key:
                    b2.delete_file(cover_key)
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "Duplicate detected during save (unique constraint)",
                "error_code": "duplicate_track",
                "duplicate_info": {
                    "match_type": "db_unique_constraint",
                    "reason": "Database unique constraint violated (likely file_path)"
                }
            }
        )
    except Exception as e:
        # Clean up B2 uploads if database operation fails
        try:
            b2 = B2Storage()
            if b2.is_configured() and public_audio_url:
                audio_key = b2.extract_key_from_url(public_audio_url)
                if audio_key:
                    b2.delete_file(audio_key)
            if public_cover_url:
                cover_key = b2.extract_key_from_url(public_cover_url)
                if cover_key:
                    b2.delete_file(cover_key)
        except Exception as cleanup_error:
            logger.warning("⚠️  Error during cleanup: %s", str(cleanup_error))
            
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": f"Failed to save mix to database: {str(e)}",
                "error_code": "database_error"
            }
        )
