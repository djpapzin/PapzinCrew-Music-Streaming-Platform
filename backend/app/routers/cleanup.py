from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, List
import logging
from app.services.orphan_cleanup import find_orphaned_tracks, cleanup_orphaned_tracks

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cleanup", tags=["cleanup"])


@router.get("/orphans", response_model=Dict[str, Any])
async def list_orphaned_tracks(upload_dir: str = Query(None, description="Upload directory to check")):
    """
    List all tracks that reference missing local files.
    """
    try:
        orphaned = find_orphaned_tracks(upload_dir)
        
        result = {
            "count": len(orphaned),
            "tracks": []
        }
        
        for mix in orphaned:
            result["tracks"].append({
                "id": mix.id,
                "title": mix.title,
                "artist": mix.artist.name if mix.artist else None,
                "file_path": mix.file_path,
                "created_at": mix.created_at.isoformat() if mix.created_at else None
            })
        
        return result
    
    except Exception as e:
        logger.error(f"Error listing orphaned tracks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/orphans", response_model=Dict[str, Any])
async def delete_orphaned_tracks(
    upload_dir: str = Query(None, description="Upload directory to check"),
    dry_run: bool = Query(False, description="Preview what would be deleted without actually deleting")
):
    """
    Delete database entries for tracks that reference missing local files.
    Use dry_run=true to preview what would be deleted.
    """
    try:
        deleted_count = cleanup_orphaned_tracks(upload_dir, dry_run=dry_run)
        
        return {
            "success": True,
            "deleted_count": deleted_count,
            "dry_run": dry_run,
            "message": f"{'Would delete' if dry_run else 'Deleted'} {deleted_count} orphaned tracks"
        }
    
    except Exception as e:
        logger.error(f"Error cleaning up orphaned tracks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/auto-cleanup", response_model=Dict[str, Any])
async def trigger_auto_cleanup(upload_dir: str = Query(None, description="Upload directory to check")):
    """
    Manually trigger automatic cleanup of orphaned tracks.
    This is the same cleanup that runs automatically when files are deleted.
    """
    try:
        deleted_count = cleanup_orphaned_tracks(upload_dir, dry_run=False)
        
        return {
            "success": True,
            "deleted_count": deleted_count,
            "message": f"Auto-cleanup completed. Removed {deleted_count} orphaned tracks."
        }
    
    except Exception as e:
        logger.error(f"Error in auto-cleanup: {e}")
        raise HTTPException(status_code=500, detail=str(e))
