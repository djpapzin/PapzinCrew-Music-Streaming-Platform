#!/usr/bin/env python3
"""
Quick script to delete a specific track from the database.
Usage: python delete_track.py <track_id>
"""
import sys
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

def delete_track(track_id: int):
    """Delete a track and its associated artist if no other tracks reference it."""
    
    # Database setup
    DATABASE_URL = "sqlite:///./papzin_crew.db"
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    with SessionLocal() as session:
        try:
            # First, get track info
            result = session.execute(
                text("SELECT title, artist_id FROM mixes WHERE id = :track_id"),
                {"track_id": track_id}
            ).fetchone()
            
            if not result:
                print(f"Track with ID {track_id} not found.")
                return False
                
            title, artist_id = result
            print(f"Found track: '{title}' (ID: {track_id})")
            
            # Delete the track
            session.execute(
                text("DELETE FROM mixes WHERE id = :track_id"),
                {"track_id": track_id}
            )
            
            # Check if artist has other tracks
            other_tracks = session.execute(
                text("SELECT COUNT(*) FROM mixes WHERE artist_id = :artist_id"),
                {"artist_id": artist_id}
            ).scalar()
            
            if other_tracks == 0:
                # Delete the artist too
                artist_name = session.execute(
                    text("SELECT name FROM artists WHERE id = :artist_id"),
                    {"artist_id": artist_id}
                ).scalar()
                
                session.execute(
                    text("DELETE FROM artists WHERE id = :artist_id"),
                    {"artist_id": artist_id}
                )
                print(f"Also deleted artist '{artist_name}' (no other tracks)")
            
            session.commit()
            print(f"Successfully deleted track ID {track_id}")
            return True
            
        except Exception as e:
            session.rollback()
            print(f"Error deleting track: {e}")
            return False

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python delete_track.py <track_id>")
        print("Example: python delete_track.py 49")
        sys.exit(1)
    
    try:
        track_id = int(sys.argv[1])
        success = delete_track(track_id)
        sys.exit(0 if success else 1)
    except ValueError:
        print("Error: Track ID must be a number")
        sys.exit(1)
