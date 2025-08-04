import datetime
from sqlalchemy import (Column, Integer, String, Float, DateTime, 
                        ForeignKey, Table, Text)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

# Association table for many-to-many relationship between mixes and categories
mix_category_association = Table(
    "mix_category",
    Base.metadata,
    Column("mix_id", Integer, ForeignKey("mixes.id"), primary_key=True),
    Column("category_id", Integer, ForeignKey("categories.id"), primary_key=True),
)

class Mix(Base):
    __tablename__ = "mixes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    original_filename = Column(String, nullable=True)
    duration_seconds = Column(Integer)
    file_path = Column(String, unique=True)
    cover_art_url = Column(String, nullable=True)
    file_size_mb = Column(Float)
    quality_kbps = Column(Integer)
    bpm = Column(Integer, nullable=True)
    release_date = Column(DateTime, default=datetime.datetime.utcnow)
    
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

    artist_id = Column(Integer, ForeignKey("artists.id"))
    artist = relationship("Artist", back_populates="mixes")
    
    categories = relationship("Category", secondary=mix_category_association, back_populates="mixes")
    tracklist_items = relationship("TracklistItem", back_populates="mix", cascade="all, delete-orphan")


class Artist(Base):
    __tablename__ = "artists"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)

    mixes = relationship("Mix", back_populates="artist")

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(String, nullable=True)

    mixes = relationship("Mix", secondary=mix_category_association, back_populates="categories")


class TracklistItem(Base):
    __tablename__ = "tracklist_items"

    id = Column(Integer, primary_key=True, index=True)
    track_title = Column(String, nullable=False)
    track_artist = Column(String, nullable=True)
    timestamp_seconds = Column(Integer, nullable=True)

    mix_id = Column(Integer, ForeignKey("mixes.id"))
    mix = relationship("Mix", back_populates="tracklist_items")