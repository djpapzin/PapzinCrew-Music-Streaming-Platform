from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class TracklistItemBase(BaseModel):
    track_title: str
    track_artist: str
    timestamp_seconds: int


class TracklistItemCreate(TracklistItemBase):
    pass


class TracklistItem(TracklistItemBase):
    id: int
    mix_id: int

    model_config = ConfigDict(from_attributes=True)


class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None


class CategoryCreate(CategoryBase):
    pass


class ArtistBase(BaseModel):
    name: str


class ArtistCreate(ArtistBase):
    pass


class ArtistSimple(ArtistBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

class Artist(ArtistBase):
    id: int
    mixes: List['Mix'] = []

    model_config = ConfigDict(from_attributes=True)


class Category(CategoryBase):
    id: int
    mixes: List['Mix'] = []

    model_config = ConfigDict(from_attributes=True)


class MixBase(BaseModel):
    title: str
    original_filename: str
    artist_id: int
    duration_seconds: int
    file_size_mb: float
    quality_kbps: int
    bpm: Optional[int] = None
    file_path: str
    cover_art_url: Optional[str] = None
    description: Optional[str] = None
    tracklist: Optional[str] = None
    tags: Optional[str] = None
    genre: Optional[str] = None
    album: Optional[str] = None
    year: Optional[int] = None
    availability: Optional[str] = 'public'
    allow_downloads: Optional[str] = 'yes'
    display_embed: Optional[str] = 'yes'
    age_restriction: Optional[str] = 'all'


class MixCreate(MixBase):
    pass


class Mix(MixBase):
    id: int
    # Some legacy records may have null file_path; allow None in responses
    file_path: Optional[str] = None
    artist: ArtistSimple

    model_config = ConfigDict(from_attributes=True)

class MixDetailed(MixBase):
    id: int
    # Allow None in responses
    file_path: Optional[str] = None
    artist: Artist

    model_config = ConfigDict(from_attributes=True)


# Resolve forward references
Artist.model_rebuild()
Category.model_rebuild()