from typing import List, Optional, Literal
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, StrictInt, StrictFloat, field_validator, EmailStr


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
    name: str = Field(min_length=1)
    description: Optional[str] = None


class CategoryCreate(CategoryBase):
    pass


class ArtistBase(BaseModel):
    name: str = Field(min_length=1)

    @field_validator('name')
    @classmethod
    def name_non_empty(cls, v: str) -> str:
        # Normalize whitespace and ensure non-empty after stripping
        if v is None:
            raise ValueError('name must not be empty')
        v = v.strip()
        if not v:
            raise ValueError('name must not be empty')
        return v


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
    artist_id: StrictInt
    duration_seconds: StrictInt
    file_size_mb: StrictFloat
    quality_kbps: StrictInt
    bpm: Optional[StrictInt] = None
    file_path: str
    cover_art_url: Optional[str] = None
    description: Optional[str] = None
    tracklist: Optional[str] = None
    tags: Optional[str] = None
    genre: Optional[str] = None
    album: Optional[str] = None
    year: Optional[StrictInt] = None
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


class AuthRegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        username = value.strip().lower()
        if not username:
            raise ValueError("username must not be empty")
        if not all(ch.isalnum() or ch in {"_", "."} for ch in username):
            raise ValueError("username may only contain letters, numbers, underscores, and dots")
        return username

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if not any(ch.isalpha() for ch in value) or not any(ch.isdigit() for ch in value):
            raise ValueError("password must contain at least one letter and one number")
        return value


class AuthLoginRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("identifier")
    @classmethod
    def normalize_identifier(cls, value: str) -> str:
        identifier = value.strip().lower()
        if not identifier:
            raise ValueError("identifier must not be empty")
        return identifier


class UserPublic(BaseModel):
    id: int
    email: EmailStr
    username: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    user: UserPublic


class AuthRegisterResponse(UserPublic):
    pass


class AuthProfileResponse(UserPublic):
    pass