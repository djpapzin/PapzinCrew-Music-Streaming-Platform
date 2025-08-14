from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Dict, Any, List
import os
import logging
import re
from pathlib import Path
from app.services.orphan_cleanup import auto_cleanup_on_file_delete
from app.db.database import SessionLocal, get_db
from app.models.models import Mix
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/files", tags=["file_management"])


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename to prevent directory traversal and other security issues.
    """
    if not filename or filename.strip() == "":
        return "untitled"
    
    # Remove null bytes and control characters, replace with underscore
    filename = re.sub(r'[\x00-\x1f\x7f-\x9f]', '_', filename)
    
    # Replace spaces and problematic characters with underscores
    filename = re.sub(r'[<>:"/\\|?*\s]', '_', filename)
    
    # Remove leading/trailing dots and underscores
    filename = filename.strip('._')
    
    # Handle empty result after sanitization
    if not filename:
        return "untitled"
    
    # Check for Windows reserved names (case-insensitive, before extension)
    name_part = os.path.splitext(filename)[0]
    ext_part = os.path.splitext(filename)[1]
    reserved_names = ['CON', 'PRN', 'AUX', 'NUL'] + [f'COM{i}' for i in range(1, 10)] + [f'LPT{i}' for i in range(1, 10)]
    if name_part.upper() in reserved_names:
        filename = f"{name_part}_{ext_part}"
    
    # Limit length
    if len(filename) > 255:
        name, ext = os.path.splitext(filename)
        filename = name[:255-len(ext)] + ext
    
    return filename


def validate_file_path(file_path: str, base_dir: str) -> bool:
    """
    Validate that file path is within the allowed base directory.
    """
    try:
        # Normalize paths
        base_path = Path(base_dir).resolve()
        target_path = Path(base_dir, file_path).resolve()
        
        # Check if target is within base directory
        return str(target_path).startswith(str(base_path))
    except Exception:
        return False


def check_user_permission(user_id: int, track_id: int, db: Session) -> bool:
    """
    Check if user has permission to access/modify the track.
    """
    # For now, return True - in production this would check actual user permissions
    return True


@router.delete("/local/{track_id}", response_model=Dict[str, Any])
async def delete_local_file_and_cleanup(
    track_id: int,
    upload_dir: str = Query(None, description="Upload directory (defaults to UPLOAD_DIR env)")
):
    """
    Delete a local file and automatically clean up the database entry.
    This prevents orphaned tracks from appearing in the app after local deletion.
    """
    if upload_dir is None:
        upload_dir = os.getenv('UPLOAD_DIR', 'uploads')
    
    session = SessionLocal()
    try:
        # Find the track
        mix = session.query(Mix).filter(Mix.id == track_id).first()
        if not mix:
            raise HTTPException(status_code=404, detail=f"Track with id {track_id} not found")
        
        file_path = (mix.file_path or '').strip()
        
        # Check if it's a local file (not a remote URL)
        if file_path.startswith('http://') or file_path.startswith('https://'):
            raise HTTPException(
                status_code=400, 
                detail="This track uses remote storage (B2). Cannot delete local file."
            )
        
        if not file_path:
            raise HTTPException(status_code=400, detail="Track has no file path")
        
        # Resolve the actual local file path
        from app.services.orphan_cleanup import resolve_local_path
        resolved_path = resolve_local_path(file_path, upload_dir)
        
        if not resolved_path or not os.path.exists(resolved_path):
            # File already missing, just clean up DB
            logger.info(f"File already missing for track {track_id}, cleaning up DB entry")
            session.delete(mix)
            session.commit()
            return {
                "success": True,
                "message": f"Database entry for track '{mix.title}' was cleaned up (file was already missing)",
                "track_id": track_id,
                "file_deleted": False,
                "db_cleaned": True
            }
        
        # Delete the actual file
        try:
            os.remove(resolved_path)
            logger.info(f"Deleted local file: {resolved_path}")
            file_deleted = True
        except Exception as e:
            logger.error(f"Failed to delete file {resolved_path}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to delete file: {e}")
        
        # Clean up database entry
        session.delete(mix)
        session.commit()
        logger.info(f"Cleaned up database entry for track {track_id}")
        
        return {
            "success": True,
            "message": f"Successfully deleted local file and database entry for '{mix.title}'",
            "track_id": track_id,
            "file_path": resolved_path,
            "file_deleted": file_deleted,
            "db_cleaned": True
        }
    
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        logger.error(f"Error deleting local file for track {track_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()


@router.post("/cleanup-orphans", response_model=Dict[str, Any])
async def cleanup_all_orphans(upload_dir: str = Query(None, description="Upload directory")):
    """
    Clean up all orphaned database entries (tracks that reference missing local files).
    """
    try:
        from app.services.orphan_cleanup import cleanup_orphaned_tracks
        deleted_count = cleanup_orphaned_tracks(upload_dir, dry_run=False)
        
        return {
            "success": True,
            "deleted_count": deleted_count,
            "message": f"Cleaned up {deleted_count} orphaned tracks"
        }
    
    except Exception as e:
        logger.error(f"Error cleaning up orphans: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk-delete", response_model=Dict[str, Any])
async def bulk_delete_files(file_paths: List[str], db: Session = Depends(get_db)):
    """
    Bulk delete multiple files with security validation.
    """
    # Security: Limit bulk operation size
    if len(file_paths) > 100:
        raise HTTPException(status_code=413, detail="Too many files in bulk operation")
    
    upload_dir = os.getenv('UPLOAD_DIR', 'uploads')
    deleted_files = []
    failed_files = []
    
    for file_path in file_paths:
        try:
            # Security: Validate file path
            if not validate_file_path(file_path, upload_dir):
                logger.warning(f"Invalid file path attempted: {file_path}")
                failed_files.append({"path": file_path, "error": "Invalid path"})
                continue
            
            # Security: Sanitize filename
            sanitized_path = sanitize_filename(file_path)
            full_path = os.path.join(upload_dir, sanitized_path)
            
            if os.path.exists(full_path):
                os.remove(full_path)
                deleted_files.append(file_path)
                logger.info(f"Deleted file: {full_path}")
            else:
                failed_files.append({"path": file_path, "error": "File not found"})
                
        except Exception as e:
            logger.error(f"Failed to delete {file_path}: {e}")
            failed_files.append({"path": file_path, "error": str(e)})
    
    return {
        "success": True,
        "deleted_count": len(deleted_files),
        "failed_count": len(failed_files),
        "deleted_files": deleted_files,
        "failed_files": failed_files
    }


@router.get("/validate/{file_path:path}")
async def validate_file_type(file_path: str):
    """
    Validate file type and check for blocked extensions.
    """
    # Security: Block dangerous file extensions
    blocked_extensions = ['.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.js', '.jar']
    
    file_ext = os.path.splitext(file_path)[1].lower()
    if file_ext in blocked_extensions:
        raise HTTPException(status_code=403, detail=f"File type {file_ext} is not allowed")
    
    # Security: Sanitize filename
    sanitized_filename = sanitize_filename(os.path.basename(file_path))
    
    return {
        "valid": True,
        "original_filename": os.path.basename(file_path),
        "sanitized_filename": sanitized_filename,
        "file_extension": file_ext
    }
