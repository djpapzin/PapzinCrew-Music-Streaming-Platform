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
    
    file_path = db_track.file_path
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    # This is a simplified version - in production, you'd want to:
    # 1. Support range requests for seeking
    # 2. Set proper content headers
    # 3. Implement proper file streaming
    from fastapi.responses import FileResponse
    return FileResponse(path=file_path, media_type="audio/mpeg")
