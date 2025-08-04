from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .. import schemas, crud
from ..db.database import get_db

router = APIRouter(prefix="/artists", tags=["artists"])

@router.get("/", response_model=List[schemas.Artist])
def read_artists(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Retrieve all artists with pagination.
    """
    artists = crud.get_artists(db, skip=skip, limit=limit)
    return artists

@router.get("/{artist_id}", response_model=schemas.Artist)
def read_artist(artist_id: int, db: Session = Depends(get_db)):
    """
    Get a specific artist by ID.
    """
    db_artist = crud.get_artist(db, artist_id=artist_id)
    if db_artist is None:
        raise HTTPException(status_code=404, detail="Artist not found")
    return db_artist

@router.get("/{artist_id}/tracks", response_model=List[schemas.Mix])
def read_artist_tracks(artist_id: int, db: Session = Depends(get_db)):
    """
    Get all tracks by a specific artist.
    """
    db_artist = crud.get_artist(db, artist_id=artist_id)
    if db_artist is None:
        raise HTTPException(status_code=404, detail="Artist not found")
    return db_artist.mixes

@router.post("/", response_model=schemas.Artist, status_code=201)
def create_artist(artist: schemas.ArtistCreate, db: Session = Depends(get_db)):
    """
    Create a new artist.
    """
    db_artist = crud.create_artist(db=db, artist=artist)
    return db_artist 