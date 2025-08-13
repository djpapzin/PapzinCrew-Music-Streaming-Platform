import os
import logging
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.models import Mix
from app.db.database import SessionLocal

logger = logging.getLogger(__name__)


def resolve_local_path(file_path: str, upload_dir: str) -> Optional[str]:
    """
    Resolve a file_path to an actual local file path, trying multiple candidates.
    Returns absolute path if found, None if not found.
    """
    norm_path = (file_path or '').replace('\\', '/').strip()
    if not norm_path:
        return None
    
    candidates = []
    
    # Try the path as-is
    candidates.append(file_path)
    
    # Try mapping /uploads/... to upload_dir/...
    if norm_path.startswith('/uploads/'):
        rel_path = norm_path.split('/uploads/', 1)[1]
        candidates.append(os.path.join(upload_dir, rel_path))
    
    # Try mapping uploads/... to upload_dir/...
    if norm_path.startswith('uploads/'):
        rel_path = norm_path.split('uploads/', 1)[1]
        candidates.append(os.path.join(upload_dir, rel_path))
    
    # Try just the basename in upload_dir
    candidates.append(os.path.join(upload_dir, os.path.basename(norm_path)))
    
    # Check each candidate
    for candidate in candidates:
        if candidate and os.path.exists(candidate):
            return os.path.abspath(candidate)
    
    return None


def find_orphaned_tracks(upload_dir: str = None) -> List[Mix]:
    """
    Find all tracks that reference local files that no longer exist.
    Returns list of Mix objects that are orphaned.
    """
    if upload_dir is None:
        upload_dir = os.getenv('UPLOAD_DIR', 'uploads')
    
    session = SessionLocal()
    orphaned = []
    
    try:
        # Get all mixes
        mixes = session.query(Mix).all()
        
        for mix in mixes:
            file_path = (mix.file_path or '').strip()
            
            # Skip if empty or remote URL
            if not file_path or file_path.startswith('http://') or file_path.startswith('https://'):
                continue
            
            # Check if local file exists
            resolved_path = resolve_local_path(file_path, upload_dir)
            if not resolved_path:
                orphaned.append(mix)
                logger.info(f"Found orphaned track: id={mix.id} title='{mix.title}' file_path='{file_path}'")
    
    finally:
        session.close()
    
    return orphaned


def cleanup_orphaned_tracks(upload_dir: str = None, dry_run: bool = False) -> int:
    """
    Remove database entries for tracks that reference missing local files.
    
    Args:
        upload_dir: Directory to check for local files
        dry_run: If True, only log what would be deleted without actually deleting
    
    Returns:
        Number of tracks that were (or would be) deleted
    """
    if upload_dir is None:
        upload_dir = os.getenv('UPLOAD_DIR', 'uploads')
    
    orphaned = find_orphaned_tracks(upload_dir)
    
    if not orphaned:
        logger.info("No orphaned tracks found")
        return 0
    
    if dry_run:
        logger.info(f"DRY RUN: Would delete {len(orphaned)} orphaned tracks")
        for mix in orphaned:
            logger.info(f"  - id={mix.id} title='{mix.title}' file_path='{mix.file_path}'")
        return len(orphaned)
    
    # Actually delete the orphaned tracks
    session = SessionLocal()
    try:
        deleted_count = 0
        for mix in orphaned:
            logger.info(f"Deleting orphaned track: id={mix.id} title='{mix.title}'")
            session.delete(mix)
            deleted_count += 1
        
        session.commit()
        logger.info(f"Successfully deleted {deleted_count} orphaned tracks")
        return deleted_count
    
    except Exception as e:
        session.rollback()
        logger.error(f"Error deleting orphaned tracks: {e}")
        raise
    finally:
        session.close()


def auto_cleanup_on_file_delete(file_path: str, upload_dir: str = None) -> bool:
    """
    Automatically cleanup database entries when a local file is deleted.
    This should be called whenever a local upload file is deleted.
    
    Args:
        file_path: The file path that was deleted
        upload_dir: Upload directory to resolve paths
    
    Returns:
        True if any database entries were cleaned up
    """
    if upload_dir is None:
        upload_dir = os.getenv('UPLOAD_DIR', 'uploads')
    
    session = SessionLocal()
    try:
        # Find tracks that might reference this deleted file
        mixes = session.query(Mix).all()
        deleted_any = False
        
        for mix in mixes:
            mix_file_path = (mix.file_path or '').strip()
            
            # Skip remote URLs
            if mix_file_path.startswith('http://') or mix_file_path.startswith('https://'):
                continue
            
            # Check if this mix references the deleted file
            resolved_path = resolve_local_path(mix_file_path, upload_dir)
            if resolved_path and os.path.abspath(resolved_path) == os.path.abspath(file_path):
                logger.info(f"Auto-cleanup: Deleting DB entry for deleted file - id={mix.id} title='{mix.title}'")
                session.delete(mix)
                deleted_any = True
        
        if deleted_any:
            session.commit()
            logger.info(f"Auto-cleanup completed for deleted file: {file_path}")
        
        return deleted_any
    
    except Exception as e:
        session.rollback()
        logger.error(f"Error in auto-cleanup for {file_path}: {e}")
        return False
    finally:
        session.close()
