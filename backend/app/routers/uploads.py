import os
import shutil
import re
import tempfile
import base64
import mimetypes
import hashlib
from io import BytesIO
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status, Request
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
import uuid

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
from ..db.database import SessionLocal, get_db
from ..models import models
from ..services.ai_art_generator import AIArtGenerator
from ..services.b2_storage import B2Storage
from ..rate_limit import enforce_rate_limit
from .file_management import sanitize_filename

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
            b2_timeout = float(os.getenv('B2_PUT_TIMEOUT', '20'))
            # Cover art defaults to a single attempt to match tests; configurable via B2_COVER_MAX_RETRIES
            max_retries = int(os.getenv('B2_COVER_MAX_RETRIES', os.getenv('B2_MAX_RETRIES', '1')))
            retry_backoff = float(os.getenv('B2_RETRY_BACKOFF', '0.75'))
            for attempt in range(1, max_retries + 1):
                try:
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
                        break
                    else:
                        logger.warning("⚠️ B2 cover upload failed (attempt %d/%d): %s", attempt, max_retries, result.get("detail"))
                except asyncio.TimeoutError:
                    logger.warning("⚠️ B2 cover upload timed out (attempt %d/%d)", attempt, max_retries)
                except Exception as e:
                    logger.warning("⚠️ B2 cover upload error (attempt %d/%d): %s", attempt, max_retries, e)
                if attempt < max_retries:
                    await asyncio.sleep(retry_backoff * attempt)
        
        # Fallback to local storage when B2 is not configured or after failures
        if not public_cover_url:
            logger.info("Saving cover art locally (%s, %d bytes)", source, len(cover_bytes))
            try:
                # Ensure upload directory exists
                if not os.path.exists(upload_dir):
                    os.makedirs(upload_dir)
                
                # Save to local filesystem
                local_cover_path = os.path.join(upload_dir, cover_filename)
                with open(local_cover_path, "wb") as f:
                    f.write(cover_bytes)
                
                public_cover_url = f"/uploads/{cover_filename}"
                logger.info("Cover art saved locally: %s", public_cover_url)
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
            # Return structured validation details so frontend can show precise errors
            detail = {
                **validation_result,
                'message': validation_result.get('error') or 'Invalid audio file'
            }
            logger.warning(
                "[upload] extract-metadata validation failed",
                extra={
                    "action": "extract_metadata_validation_failed",
                    "file_name": file.filename,
                    "mime_type": validation_result.get("mime_type"),
                    "file_extension": validation_result.get("file_extension"),
                    "file_size_bytes": validation_result.get("file_size_bytes"),
                    "error_code": validation_result.get("error_code"),
                },
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=detail
            )
        
        # Extract metadata with timeout; fall back to filename stem
        try:
            metadata = await asyncio.wait_for(asyncio.to_thread(extract_metadata_from_file, file), timeout=3.0)
        except asyncio.TimeoutError:
            metadata = {'title': Path(file.filename).stem}
        except Exception as e:
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
        logger.exception("Error in extract_metadata: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract metadata: {str(e)}"
        )

# Constants

# Constants
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
MAX_FILE_SIZE_MB = 200  # 200MB max file size
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
    'audio/opus': '.opus',
    'audio/x-ms-wma': '.wma'
}

# Guardrails for likely accidental Telegram voice/TTS uploads.
# These are intentionally scoped to short/small OGG uploads so normal music files
# in MP3/WAV/FLAC/etc. are unaffected, and larger OGG uploads can still pass.
VOICE_STYLE_OGG_MAX_DURATION_SECONDS = float(os.getenv("VOICE_STYLE_OGG_MAX_DURATION_SECONDS", "90"))
VOICE_STYLE_OGG_MAX_FILE_SIZE_BYTES = int(os.getenv("VOICE_STYLE_OGG_MAX_FILE_SIZE_BYTES", str(5 * 1024 * 1024)))
VOICE_STYLE_OGG_STRONG_FILE_SIZE_BYTES = int(os.getenv("VOICE_STYLE_OGG_STRONG_FILE_SIZE_BYTES", str(1024 * 1024)))

# Prefer B2 storage; create local upload directories only for fallback or when B2 is disabled


def _classify_voice_style_audio(
    *,
    extension: str,
    mime_type: str,
    file_size_bytes: int,
    duration_seconds: Optional[float],
) -> Optional[Dict[str, Any]]:
    """Return a structured rejection when an upload looks like a short Telegram voice/TTS OGG."""
    if extension != '.ogg' or mime_type != 'audio/ogg':
        return None

    if duration_seconds is None:
        if file_size_bytes <= VOICE_STYLE_OGG_STRONG_FILE_SIZE_BYTES:
            return {
                'valid': False,
                'error': (
                    'This OGG looks like a small voice/TTS clip, not a full music mix. '
                    'Please resend the original track as the actual audio/document file.'
                ),
                'error_code': 'likely_voice_note_upload',
                'guardrail': 'voice_style_ogg_small_without_duration',
                'voice_style_detected': True,
            }
        return None

    if duration_seconds <= VOICE_STYLE_OGG_MAX_DURATION_SECONDS and file_size_bytes <= VOICE_STYLE_OGG_MAX_FILE_SIZE_BYTES:
        return {
            'valid': False,
            'error': (
                'This OGG looks like a short voice/TTS clip, not the intended music mix. '
                'Please resend the original mix as an audio/document upload instead of a voice note.'
            ),
            'error_code': 'likely_voice_note_upload',
            'guardrail': 'voice_style_ogg_short_and_small',
            'voice_style_detected': True,
            'duration_seconds': duration_seconds,
        }

    return None

def validate_audio_file(file_or_bytes, filename: Optional[str] = None, lightweight: bool = False) -> Tuple[bool, Dict[str, Any]]:
    """
    Validate the audio file for type, size, and integrity.
    Supports either FastAPI UploadFile, a file-like object (BytesIO), or raw bytes.
    Returns a tuple (is_valid, result_dict).
    """
    data: bytes = b""
    detected_filename: str = filename or ""
    underlying: Any = None

    # Normalize inputs and read bytes once
    try:
        if hasattr(file_or_bytes, "file") and hasattr(file_or_bytes.file, "read"):
            # FastAPI UploadFile
            underlying = file_or_bytes.file
            if not detected_filename:
                detected_filename = (getattr(file_or_bytes, "filename", None) or "")
            try:
                file_or_bytes.file.seek(0)
            except Exception:
                pass
            data = file_or_bytes.file.read()
        elif hasattr(file_or_bytes, "read"):
            # File-like object (e.g., BytesIO)
            underlying = file_or_bytes
            try:
                file_or_bytes.seek(0)
            except Exception:
                pass
            data = file_or_bytes.read()
        elif isinstance(file_or_bytes, (bytes, bytearray)):
            data = bytes(file_or_bytes)
        else:
            return False, {
                "valid": False,
                "error": "Unsupported input type for audio validation",
                "error_code": "invalid_input"
            }
    except Exception as e:
        return False, {"valid": False, "error": f"Error reading file: {str(e)}", "error_code": "file_read_error"}

    file_size = len(data)
    # Derive extension and mime from filename
    extension = os.path.splitext((detected_filename or "").lower())[1]
    allowed_extensions = {'.mp3', '.wav', '.aiff', '.flac', '.m4a', '.ogg', '.opus', '.wma'}
    extension_to_mime = {
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.aiff': 'audio/aiff',
        '.flac': 'audio/flac',
        '.m4a': 'audio/mp4',
        '.ogg': 'audio/ogg',
        '.opus': 'audio/opus',
        '.wma': 'audio/x-ms-wma',
    }
    detected_mime = extension_to_mime.get(extension, 'application/octet-stream')

    # Empty file check
    if file_size == 0:
        return False, {
            'valid': False,
            'error': 'File is empty',
            'error_code': 'file_empty',
            'file_extension': extension or None,
            'file_size_bytes': 0,
        }

    # Soft limit check – include size info regardless of validity
    if file_size > MAX_FILE_SIZE_MB * 1024 * 1024:
        return False, {
            'valid': False,
            'error': f'File too large. Maximum size is {MAX_FILE_SIZE_MB}MB',
            'error_code': 'file_too_large',
            'file_extension': extension or None,
            'file_size_bytes': file_size,
        }

    # Unsupported extension
    if extension and extension not in allowed_extensions:
        return False, {
            'valid': False,
            'error': f'Unsupported file type. Supported extensions: {sorted(allowed_extensions)}',
            'error_code': 'unsupported_file_type',
            'file_extension': extension,
            'detected_type': detected_mime,
            'file_size_bytes': file_size,
        }

    if lightweight:
        return True, {
            'valid': True,
            'mime_type': detected_mime,
            'file_extension': extension,
            'file_size_bytes': file_size,
        }

    # Deep validation using mutagen
    try:
        audio = mutagen.File(BytesIO(data))
        if audio is None:
            return False, {
                'valid': False,
                'error': 'Invalid or unsupported audio format',
                'error_code': 'invalid_audio_file',
                'file_extension': extension or None,
                'file_size_bytes': file_size,
            }

        # Compute optional metadata
        duration_seconds = None
        quality_kbps = None
        try:
            if hasattr(audio, 'info') and hasattr(audio.info, 'length'):
                duration_seconds = float(audio.info.length)
            if hasattr(audio, 'info') and hasattr(audio.info, 'bitrate') and audio.info.bitrate is not None:
                br = float(audio.info.bitrate)
                quality_kbps = int(br if br <= 1000 else round(br / 1000))
        except Exception:
            pass

        voice_style_rejection = _classify_voice_style_audio(
            extension=extension,
            mime_type=detected_mime,
            file_size_bytes=file_size,
            duration_seconds=duration_seconds,
        )
        if voice_style_rejection:
            return False, {
                **voice_style_rejection,
                'file_extension': extension,
                'mime_type': detected_mime,
                'file_size_bytes': file_size,
            }

        result: Dict[str, Any] = {
            'valid': True,
            'mime_type': detected_mime,
            'file_extension': extension,
            'file_size_bytes': file_size,
        }
        if duration_seconds is not None:
            result['duration_seconds'] = duration_seconds
        if quality_kbps is not None:
            result['quality_kbps'] = quality_kbps
        return True, result
    except Exception as e:
        return False, {
            'valid': False,
            'error': f'Error validating audio file: {str(e)}',
            'error_code': 'file_validation_error',
            'file_extension': extension or None,
            'file_size_bytes': file_size,
        }
    finally:
        # Reset stream positions where applicable
        try:
            if underlying is not None and hasattr(underlying, 'seek'):
                underlying.seek(0)
        except Exception:
            pass

# Using centralized sanitize_filename from file_management

def _get_exact_hash_duplicate(db: Session, file_hash: Optional[str]) -> Optional[Dict[str, Any]]:
    """Fast exact-duplicate lookup used on the upload critical path."""
    if not file_hash or not hasattr(models.Mix, "file_hash"):
        return None

    hash_match = db.query(models.Mix).filter(models.Mix.file_hash == file_hash).first()
    if not hash_match:
        return None

    return {
        "id": hash_match.id,
        "title": hash_match.title,
        "artist_name": hash_match.artist.name if hash_match.artist else "",
        "file_size_mb": hash_match.file_size_mb,
        "uploaded_at": hash_match.release_date.isoformat() if getattr(hash_match, "release_date", None) else None,
        "match_type": "exact_file",
        "confidence": 1.0,
        "reason": "Identical file content detected",
    }


def _extract_authoritative_audio_details(audio_bytes: bytes) -> Dict[str, Any]:
    """Extract authoritative metadata off the request critical path."""
    details: Dict[str, Any] = {
        "duration_seconds": 0,
        "quality_kbps": 0,
        "bpm": None,
        "cover_art_bytes": None,
    }

    tags_source = None
    try:
        try:
            audio_mp3 = MP3(BytesIO(audio_bytes))
            details["duration_seconds"] = int(audio_mp3.info.length)
            details["quality_kbps"] = int(audio_mp3.info.bitrate / 1000) if hasattr(audio_mp3.info, 'bitrate') and audio_mp3.info.bitrate else 0
            tags_source = audio_mp3
        except Exception:
            audio_generic = mutagen.File(BytesIO(audio_bytes))
            if hasattr(audio_generic, 'info') and hasattr(audio_generic.info, 'length'):
                details["duration_seconds"] = int(audio_generic.info.length)
            tags_source = audio_generic

        try:
            if getattr(tags_source, 'tags', None) and 'TBPM' in tags_source.tags:
                bpm_str = str(tags_source.tags['TBPM'])
                details["bpm"] = int(float(bpm_str))
        except Exception as e:
            logger.debug('[upload] background BPM parse error: %s', e)

        try:
            tags = getattr(tags_source, 'tags', None)
            if tags:
                if 'APIC:' in tags:
                    details["cover_art_bytes"] = tags['APIC:'].data
                elif 'APIC' in tags:
                    details["cover_art_bytes"] = tags['APIC'].data
                elif 'covr' in tags:
                    details["cover_art_bytes"] = tags['covr'][0]
            elif hasattr(tags_source, 'pictures') and tags_source.pictures:
                details["cover_art_bytes"] = tags_source.pictures[0].data
        except Exception as e:
            logger.debug('[upload] background cover extraction error: %s', e)
    except Exception as e:
        logger.warning('[upload] background metadata extraction error: %s', e, extra={"action": "background_metadata_extraction_error", "error": str(e)})

    return details


async def _finalize_mix_processing(
    *,
    mix_id: int,
    audio_bytes: bytes,
    upload_dir: str,
    base_name: str,
    title: str,
    artist_name: str,
    genre: Optional[str],
    custom_prompt: Optional[str],
    uploaded_cover_bytes: Optional[bytes],
) -> None:
    """Best-effort post-response metadata and cover processing."""
    db = SessionLocal()
    try:
        mix = db.query(models.Mix).filter(models.Mix.id == mix_id).first()
        if mix is None:
            return

        details = await asyncio.to_thread(_extract_authoritative_audio_details, audio_bytes)
        mix.duration_seconds = int(details.get('duration_seconds') or 0)
        mix.quality_kbps = int(details.get('quality_kbps') or 0)
        mix.bpm = details.get('bpm')

        public_cover_url = mix.cover_art_url
        cover_bytes = uploaded_cover_bytes or details.get('cover_art_bytes')
        if cover_bytes and not public_cover_url:
            public_cover_url = await _save_cover_art(cover_bytes, base_name, upload_dir, source='uploaded' if uploaded_cover_bytes else 'extracted')

        if not public_cover_url:
            try:
                ai_generator = AIArtGenerator()
                ai_timeout = float(os.getenv('AI_COVER_TIMEOUT_SECONDS', '45.0'))
                ai_cover_bytes = await asyncio.wait_for(
                    asyncio.to_thread(
                        ai_generator.generate_cover_art_from_metadata,
                        title=title, artist=artist_name, genre=genre, custom_prompt=custom_prompt
                    ),
                    timeout=ai_timeout
                )
                if ai_cover_bytes:
                    public_cover_url = await _save_cover_art(ai_cover_bytes, base_name, upload_dir, source='ai')
                else:
                    logger.warning('[upload] background AI generation returned no data', extra={"action": "background_ai_cover_empty", "mix_id": mix_id})
            except asyncio.TimeoutError:
                logger.warning('[upload] background AI cover generation timed out after %ss', ai_timeout, extra={"action": "background_ai_cover_timeout", "mix_id": mix_id, "timeout_seconds": ai_timeout})
            except Exception as e:
                logger.warning('[upload] background AI cover generation failed: %s', e, extra={"action": "background_ai_cover_error", "mix_id": mix_id, "error": str(e)})

        if public_cover_url and mix.cover_art_url != public_cover_url:
            mix.cover_art_url = public_cover_url

        db.commit()
        logger.info('[upload] background finalize complete for mix_id=%s', mix_id, extra={"action": "background_finalize_complete", "mix_id": mix_id})
    except Exception as e:
        db.rollback()
        logger.warning('[upload] background finalize failed for mix_id=%s: %s', mix_id, e, extra={"action": "background_finalize_failed", "mix_id": mix_id, "error": str(e)})
    finally:
        db.close()


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


def build_unique_b2_audio_key(base_name: str, file_extension: str, file_hash: Optional[str] = None) -> str:
    """Build a collision-resistant B2 key so one upload never reuses another mix's object."""
    clean_base = re.sub(r'[^a-zA-Z0-9\-]', '-', (base_name or '').lower())
    clean_base = re.sub(r'-+', '-', clean_base).strip('-') or 'upload'
    hash_prefix = (file_hash or 'nohash')[:12]
    upload_token = uuid.uuid4().hex[:12]
    return f"audio/{clean_base}-{hash_prefix}-{upload_token}{file_extension}"

# (Removed duplicate extract-metadata route definition)

# NOTE: Removed duplicate minimalist /upload-mix route to avoid conflicts with the main upload handler.

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
    artist_name = str(payload.get("artist_name") or payload.get("primary_artist") or "").strip()
    file_size = int(payload.get("file_size", 0))
    file_hash = payload.get("file_hash")  # Optional file hash for exact matching
    duration_seconds = payload.get("duration_seconds")  # Optional duration
    album = payload.get("album", "").strip() if payload.get("album") else None

    if not title or not artist_name or file_size <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Missing or invalid fields: 'title', 'artist_name' (or 'primary_artist'), 'file_size'",
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

    return {"duplicate": False}

@router.post("", status_code=201)
@router.post("/", status_code=201)
@router.post("/upload-mix")
async def upload_mix(
    title: str = Form(...),
    artist_name: Optional[str] = Form(None),
    primary_artist: Optional[str] = Form(None),
    tag_artists: Optional[str] = Form(None),
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
    paperclip_task_id: Optional[int] = Form(None),
    request: Request = None,
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db)
):
    """
    Upload a new mix file with metadata.
    Validates the file and checks for duplicates before saving.
    """
    artist_name = (primary_artist or artist_name or '').strip()

    if request is not None:
        enforce_rate_limit(request, bucket="upload", limit_env="UPLOAD_RATE_LIMIT", window_env="UPLOAD_RATE_LIMIT_WINDOW_SECONDS")

    logger.info(
        "[upload] start title='%s' artist='%s' filename='%s'",
        title,
        artist_name,
        getattr(file, 'filename', None),
        extra={
            "action": "upload_start",
            "title": title,
            "artist": artist_name,
            "file_name": getattr(file, 'filename', None),
            "availability": availability,
            "allow_downloads": allow_downloads,
            "tag_artists": tag_artists,
        },
    )
    termprint(f"[upload] start title='{title}' artist='{artist_name}' filename='{getattr(file, 'filename', None)}'")
    # Validate the file first
    is_valid, validation_result = validate_audio_file(file)
    if not is_valid:
        logger.warning(
            "[upload] validation failed: %s",
            validation_result,
            extra={
                "action": "upload_validation_failed",
                "file_extension": validation_result.get('file_extension'),
                "mime_type": validation_result.get('mime_type'),
                "file_size_bytes": validation_result.get('file_size_bytes'),
                "error_code": validation_result.get('error_code'),
            },
        )
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
            extra={
                "action": "upload_validation_ok",
                "file_extension": validation_result.get('file_extension'),
                "mime_type": validation_result.get('mime_type'),
                "file_size_bytes": validation_result.get('file_size_bytes'),
            },
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
                    logger.info("[upload] artist fallback from filename: %s", artist_name, extra={"action": "artist_fallback", "source": "filename", "artist": artist_name})
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
        logger.warning("[upload] B2 not configured; will use local storage fallback", extra={"action": "b2_not_configured"})
    
    # Read file content into memory (B2-first) and compute hash
    file.file.seek(0)
    audio_bytes = file.file.read()
    file_hash = calculate_file_hash(audio_bytes)
    logger.info("[upload] read bytes size=%d hash=%s", len(audio_bytes), file_hash, extra={"action": "audio_read", "size_bytes": len(audio_bytes), "file_hash": file_hash})
    termprint(f"[upload] read bytes size={len(audio_bytes)} hash={file_hash}")
    
    file_size_mb = validation_result['file_size_bytes'] / (1024 * 1024)
    duration_seconds = 0
    quality_kbps = 0
    bpm = None
    uploaded_cover_bytes = None

    # --- Early Duplicate Detection (before any storage writes) ---
    duplicate_info = _get_exact_hash_duplicate(db=db, file_hash=file_hash)
    if duplicate_info and not skip_duplicate_check:
        logger.info("[upload] duplicate detected (pre-storage): %s", duplicate_info.get('reason'), extra={"action": "duplicate_detected_pre_storage", "reason": duplicate_info.get('reason'), "match_type": duplicate_info.get('match_type')})
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": f"Duplicate detected: {duplicate_info.get('reason', 'Similar track found')}",
                "error_code": "duplicate_track",
                "duplicate_info": duplicate_info
            }
        )

    # --- Deferred cover processing payload capture ---
    public_cover_url = None
    try:
        if cover_art and cover_art.filename:
            logger.info("🎵 Queuing uploaded cover art for background processing: %s", file.filename, extra={"action": "cover_art_background_queued", "file_name": file.filename})
            cover_art.file.seek(0)
            uploaded_cover_bytes = cover_art.file.read()
    except Exception as e:
        logger.warning("[upload] failed reading uploaded cover art for background processing: %s", e, extra={"action": "cover_art_background_read_failed", "error": str(e)})

    # B2-first: upload audio bytes directly when configured
    public_audio_url = None
    storage_provider = None  # "b2" | "local"
    storage_location = None  # url or local path
    fallback_from_b2 = False
    b2_error_code = None
    # public_cover_url was set during cover art handling above
    b2 = B2Storage()
    try:
        if b2.is_configured():
            audio_key = build_unique_b2_audio_key(
                base_name=base_name,
                file_extension=file_extension,
                file_hash=file_hash,
            )
            logger.info("[upload] Using unique B2 audio key: %s", audio_key, extra={"action": "b2_unique_audio_key", "audio_key": audio_key, "skip_duplicate_check": skip_duplicate_check})
            logger.info("[upload] B2 audio upload start key=%s size=%dB", audio_key, len(audio_bytes), extra={"action": "b2_audio_upload_start", "audio_key": audio_key, "size_bytes": len(audio_bytes)})
            termprint(f"[upload] B2 audio upload start key={audio_key} size={len(audio_bytes)}B")
            b2_timeout = float(os.getenv('B2_PUT_TIMEOUT', '20'))
            max_retries = int(os.getenv('B2_MAX_RETRIES', '3'))
            retry_backoff = float(os.getenv('B2_RETRY_BACKOFF', '0.75'))
            start_overall = time.perf_counter()
            for attempt in range(1, max_retries + 1):
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
                        break
                    else:
                        b2_error_code = _res.get("error_code")
                        logger.warning("[upload] B2 audio upload failed (attempt %d/%d) code=%s detail=%s", attempt, max_retries, _res.get("error_code"), _res.get("detail"), extra={"action": "b2_audio_upload_failed", "attempt": attempt, "max_retries": max_retries, "error_code": _res.get("error_code")})
                except asyncio.TimeoutError:
                    logger.warning("[upload] B2 audio upload timed out after %ss (attempt %d/%d)", b2_timeout, attempt, max_retries, extra={"action": "b2_audio_timeout", "timeout_seconds": b2_timeout, "attempt": attempt, "max_retries": max_retries})
                    public_audio_url = None
                    b2_error_code = "timeout"
                except Exception as e:
                    logger.warning("[upload] B2 audio upload error (attempt %d/%d): %s", attempt, max_retries, e, extra={"action": "b2_audio_upload_error", "attempt": attempt, "max_retries": max_retries, "error": str(e)})
                if not public_audio_url and attempt < max_retries:
                    await asyncio.sleep(retry_backoff * attempt)
            elapsed_total = (time.perf_counter() - start_overall)
            if public_audio_url:
                logger.info("[upload] B2 audio upload done in %.2fs url=%s", elapsed_total, public_audio_url, extra={"action": "b2_audio_upload_done", "elapsed_seconds": round(elapsed_total, 2), "url": public_audio_url})
    except Exception as e:
        logger.error("[upload] B2 audio upload error: %s", e, extra={"action": "b2_audio_unhandled_error", "error": str(e)})
    # Fallback to local storage logic (only after B2 attempts)
    # Storage strategy:
    # - B2 configured: try B2 first with retries/timeouts above
    # - If B2 is NOT configured and ENFORCE_B2_ONLY is false -> save locally (dev/tests)
    # - If B2 IS configured but upload failed after retries -> fall back to local and mark response headers
    # - If ENFORCE_B2_ONLY is true and B2 not configured -> return 503 without local save
    if not public_audio_url:
        enforce_b2_only = os.getenv("ENFORCE_B2_ONLY", "0").lower() in ("1", "true", "yes")
        if not b2.is_configured() and not enforce_b2_only:
            # B2 disabled and local storage permitted: write to local filesystem
            # B2 disabled: use local storage (allowed by default in tests/dev)
            storage_provider = "local_filesystem"
            fallback_from_b2 = False
            logger.warning("[upload] B2 not configured; using local storage.", extra={"action": "local_storage_used", "reason": "b2_not_configured"})
            try:
                if not os.path.exists(UPLOAD_DIR):
                    os.makedirs(UPLOAD_DIR)
                sanitized_filename = sanitize_filename(file.filename or "untitled.mp3")
                unique_filename = get_unique_filepath(db, UPLOAD_DIR, sanitized_filename)
                local_audio_path = os.path.join(UPLOAD_DIR, unique_filename)
                with open(local_audio_path, "wb") as buffer:
                    buffer.write(audio_bytes)
                public_audio_url = f"/uploads/{unique_filename}"
                storage_location = local_audio_path
                logger.info("✅ Upload complete! 📁 Access at: %s", public_audio_url, extra={"action": "local_save_success", "provider": storage_provider, "url": public_audio_url, "path": local_audio_path})
            except Exception as e:
                logger.error("🚨 [upload] local save failed: %s", e, extra={"action": "local_save_failed", "error": str(e)})
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail={"error": f"Failed to save file locally: {e}", "error_code": "local_save_failed"}
                )
        elif b2.is_configured():
            # B2 was configured but all retries failed: perform local fallback to ensure upload completes
            storage_provider = "local_filesystem"
            fallback_from_b2 = True
            logger.warning("[upload] B2 upload failed after retries, falling back to local storage.", extra={"action": "local_fallback", "from": "b2_failed"})
            termprint("[upload] B2 upload failed after retries, falling back to local storage.")
            try:
                if not os.path.exists(UPLOAD_DIR):
                    os.makedirs(UPLOAD_DIR)
                sanitized_filename = sanitize_filename(file.filename or "untitled.mp3")
                unique_filename = get_unique_filepath(db, UPLOAD_DIR, sanitized_filename)
                local_audio_path = os.path.join(UPLOAD_DIR, unique_filename)
                with open(local_audio_path, "wb") as buffer:
                    buffer.write(audio_bytes)
                public_audio_url = f"/uploads/{unique_filename}"
                storage_location = local_audio_path
                logger.info("✅ Upload complete! 📁 Access at: %s", public_audio_url, extra={"action": "local_save_success", "provider": storage_provider, "url": public_audio_url, "path": local_audio_path, "fallback_from_b2": True})
                termprint(f"[upload] saved to local fallback: {public_audio_url}")
            except Exception as e:
                logger.error("🚨 [upload] local save failed: %s", e, extra={"action": "local_save_failed", "error": str(e)})
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail={"error": f"Failed to save file locally: {e}", "error_code": "local_save_failed"}
                )
        else:
            # ENFORCE_B2_ONLY prevents local fallback when remote storage is unavailable
            logger.error("[upload] B2 storage not configured; refusing local fallback per policy", extra={"action": "storage_unavailable_policy", "policy": "ENFORCE_B2_ONLY"})
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "error": "B2 storage not configured",
                    "error_code": "storage_unavailable"
                }
            )

    # (Removed post-storage duplicate detection; now performed pre-storage)

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
        logger.info("💾 Saving track to database...", extra={"action": "db_save_start", "provider": storage_provider, "location": storage_location, "fallback_from_b2": fallback_from_b2})
        mix_data = schemas.MixCreate(
            title=title,
            original_filename=file.filename,
            artist_id=db_artist.id,
            duration_seconds=duration_seconds,
            file_size_mb=file_size_mb,
            quality_kbps=quality_kbps,
            bpm=bpm,
            file_path=final_audio_path,
            file_hash=file_hash,
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
        response_model = Mix.model_validate(db_mix)
        # Use model_dump and then jsonable_encoder to ensure JSON-serializable types
        response_content = response_model.model_dump()
        response_content['stream_url'] = f'/tracks/{db_mix.id}/stream'
        
        # Add frontend-expected properties
        response_content['success'] = True
        response_content['generating_art'] = True
        response_content['processing_status'] = 'pending'
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
        response_content['paperclip_task_id'] = paperclip_task_id if paperclip_task_id is not None else db_mix.id
        response_content['authoritative_processing'] = {
            'status': 'pending',
            'fields_pending': ['duration_seconds', 'quality_kbps', 'bpm', 'cover_art_url']
        }
        
        # Include storage details in response for observability
        if storage_provider:
            response_content['storage'] = storage_provider
        if storage_location:
            response_content['location'] = storage_location
        if fallback_from_b2:
            response_content['fallback_from_b2'] = True
        logger.info("✅ Success! Track saved with ID: %s", db_mix.id, extra={"action": "db_save_success", "mix_id": db_mix.id, "storage_provider": storage_provider, "storage_location": storage_location})
        if background_tasks is not None:
            background_tasks.add_task(
                _finalize_mix_processing,
                mix_id=db_mix.id,
                audio_bytes=audio_bytes,
                upload_dir=UPLOAD_DIR,
                base_name=base_name,
                title=title,
                artist_name=artist_name,
                genre=genre,
                custom_prompt=custom_prompt,
                uploaded_cover_bytes=uploaded_cover_bytes,
            )

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
        logger.warning("[upload] DB unique constraint violated during save", extra={"action": "db_unique_violation"})
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
