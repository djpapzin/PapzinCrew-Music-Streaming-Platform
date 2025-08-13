from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any
import os
import logging
from app.services.orphan_cleanup import auto_cleanup_on_file_delete
from app.db.database import SessionLocal
from app.models.models import Mix

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/files", tags=["file_management"])


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
