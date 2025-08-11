from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import os

from .. import schemas, crud
from ..db.database import get_db

router = APIRouter(prefix="/tracks", tags=["tracks"])

@router.get("/", response_model=List[schemas.Mix])
def read_tracks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Retrieve all tracks with pagination.
    """
    tracks = crud.get_mixes(db, skip=skip, limit=limit)
    return tracks

@router.get("/{track_id}", response_model=schemas.Mix)
def read_track(track_id: int, db: Session = Depends(get_db)):
    """
    Get a specific track by ID.
    """
    db_track = crud.get_mix(db, mix_id=track_id)
    if db_track is None:
        raise HTTPException(status_code=404, detail="Track not found")
    return db_track

@router.get("/{track_id}/stream")
async def stream_track(track_id: int, db: Session = Depends(get_db)):
    """
    Stream audio for a specific track.
    """
    db_track = crud.get_mix(db, mix_id=track_id)
    if db_track is None:
        raise HTTPException(status_code=404, detail="Track not found")
    
    file_path = (db_track.file_path or "").strip()
    if not file_path:
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    # If the stored path is a public URL (e.g., B2), redirect the client
    if file_path.startswith("http://") or file_path.startswith("https://"):
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=file_path, status_code=307)
    
    # If the stored path is a static app path (served by FastAPI at /uploads), redirect
    if file_path.startswith("/uploads/"):
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=file_path, status_code=307)
    
    # Otherwise, treat as a local filesystem path
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    # Basic file response (note: for production, implement HTTP Range support)
    from fastapi.responses import FileResponse
    import mimetypes
    media_type = mimetypes.guess_type(file_path)[0] or "audio/mpeg"
    return FileResponse(path=file_path, media_type=media_type)
