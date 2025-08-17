import datetime
from sqlalchemy import (Column, Integer, String, Float, DateTime, 
                        ForeignKey, Table, Text)
from sqlalchemy.types import TypeDecorator
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

# Association table for many-to-many relationship between mixes and categories
mix_category_association = Table(
    "mix_category",
    Base.metadata,
    Column("mix_id", Integer, ForeignKey("mixes.id"), primary_key=True),
    Column("category_id", Integer, ForeignKey("categories.id"), primary_key=True),
)

class AwareDateTime(TypeDecorator):
    """A DateTime that preserves UTC tzinfo across SQLite by normalizing to UTC.

    - On bind: ensure value is timezone-aware in UTC. For SQLite, bind as naive UTC.
    - On result: attach UTC tzinfo if missing.
    """
    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        # Ensure timezone-aware in UTC
        if value.tzinfo is None:
            value = value.replace(tzinfo=datetime.timezone.utc)
        else:
            value = value.astimezone(datetime.timezone.utc)
        # SQLite does not preserve tzinfo; bind as naive UTC
        if dialect.name == "sqlite":
            return value.replace(tzinfo=None)
        return value

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        # For SQLite, returned value is naive; attach UTC tzinfo
        if value.tzinfo is None:
            return value.replace(tzinfo=datetime.timezone.utc)
        return value

class Mix(Base):
    __tablename__ = "mixes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    original_filename = Column(String, nullable=True)
    duration_seconds = Column(Integer, nullable=False)
    file_path = Column(String, unique=True, nullable=False)
    cover_art_url = Column(String, nullable=True)
    file_size_mb = Column(Float, nullable=False)
    quality_kbps = Column(Integer, nullable=False)
    bpm = Column(Integer, nullable=True)
    release_date = Column(AwareDateTime(), default=lambda: datetime.datetime.now(datetime.timezone.utc))
    
    # New fields for advanced options
    description = Column(String)
    tracklist = Column(String)
    tags = Column(String)
    genre = Column(String)
    album = Column(String, nullable=True)
    year = Column(Integer, nullable=True)
    availability = Column(String, default='public')
    allow_downloads = Column(String, default='yes')
    display_embed = Column(String, default='yes')
    age_restriction = Column(String, default='all')
    play_count = Column(Integer, default=0)
    download_count = Column(Integer, default=0)

    artist_id = Column(Integer, ForeignKey("artists.id"), nullable=False)
    artist = relationship("Artist", back_populates="mixes")
    
    categories = relationship("Category", secondary=mix_category_association, back_populates="mixes")
    tracklist_items = relationship("TracklistItem", back_populates="mix", cascade="all, delete-orphan")


class Artist(Base):
    __tablename__ = "artists"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)

    mixes = relationship("Mix", back_populates="artist")

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, nullable=True)

    mixes = relationship("Mix", secondary=mix_category_association, back_populates="categories")


class TracklistItem(Base):
    __tablename__ = "tracklist_items"

    id = Column(Integer, primary_key=True, index=True)
    track_title = Column(String, nullable=False)
    track_artist = Column(String, nullable=False)
    timestamp_seconds = Column(Integer, nullable=False)

    mix_id = Column(Integer, ForeignKey("mixes.id"), nullable=False)
    mix = relationship("Mix", back_populates="tracklist_items")