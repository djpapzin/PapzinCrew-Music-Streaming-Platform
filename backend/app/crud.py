from sqlalchemy.orm import Session
from . import schemas
from .models import models

def get_mix(db: Session, mix_id: int):
    return db.query(models.Mix).filter(models.Mix.id == mix_id).first()

def get_mix_by_filepath(db: Session, file_path: str):
    return db.query(models.Mix).filter(models.Mix.file_path == file_path).first()

def get_mixes(db: Session, skip: int = 0, limit: int = 100):
    return (
        db.query(models.Mix)
        .order_by(models.Mix.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

def create_mix(db: Session, mix: schemas.MixCreate):
    db_mix = models.Mix(
        title=mix.title,
        original_filename=mix.original_filename,
        artist_id=mix.artist_id,
        duration_seconds=mix.duration_seconds,
        file_size_mb=mix.file_size_mb,
        quality_kbps=mix.quality_kbps,
        file_path=mix.file_path,
        cover_art_url=mix.cover_art_url,
        description=mix.description,
        tracklist=mix.tracklist,
        tags=mix.tags,
        genre=mix.genre,
        album=mix.album,
        year=mix.year,
        availability=mix.availability,
        allow_downloads=mix.allow_downloads,
        display_embed=mix.display_embed,
        age_restriction=mix.age_restriction
    )
    db.add(db_mix)
    db.commit()
    db.refresh(db_mix)
    return db_mix

def get_artist(db: Session, artist_id: int):
    return db.query(models.Artist).filter(models.Artist.id == artist_id).first()

def get_artist_by_name(db: Session, name: str):
    return db.query(models.Artist).filter(models.Artist.name == name).first()

def get_artists(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Artist).offset(skip).limit(limit).all()

def create_artist(db: Session, artist: schemas.ArtistCreate):
    db_artist = models.Artist(**artist.model_dump())
    db.add(db_artist)
    db.commit()
    db.refresh(db_artist)
    return db_artist

def get_category(db: Session, category_id: int):
    return db.query(models.Category).filter(models.Category.id == category_id).first()

def get_categories(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Category).offset(skip).limit(limit).all()

def create_category(db: Session, category: schemas.CategoryCreate):
    db_category = models.Category(**category.dict())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

def add_mix_to_category(db: Session, mix_id: int, category_id: int):
    mix = get_mix(db, mix_id)
    category = get_category(db, category_id)
    if mix and category:
        mix.categories.append(category)
        db.commit()
        return mix
    return None
