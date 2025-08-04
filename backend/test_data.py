import os
import sys
import logging
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from app.db.database import SessionLocal, Base, engine
from app.models.models import Artist, Category, Mix

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def create_tables():
    """Create database tables if they don't exist"""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")
        raise

def clear_database(db: Session):
    """Clear all data from the database"""
    try:
        logger.info("Clearing existing data...")
        db.query(Mix).delete()
        db.query(Artist).delete()
        db.query(Category).delete()
        db.commit()
        logger.info("Database cleared successfully")
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error clearing database: {e}")
        raise

def seed_database():
    db = SessionLocal()
    
    try:
        # Create tables if they don't exist
        create_tables()
        
        # Clear existing data
        clear_database(db)
        
        logger.info("Starting to seed database...")
        
        # Create artists
        try:
            artist1 = Artist(name="DJ Papzin")
            artist2 = Artist(name="Calvin Fallo")
            artist3 = Artist(name="Kelvin Momo")
            
            db.add_all([artist1, artist2, artist3])
            db.commit()
            logger.info("Artists created successfully")
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Error creating artists: {e}")
            raise
        
        # Create categories
        try:
            category1 = Category(name="Amapiano", description="South African house music genre")
            category2 = Category(name="Deep House", description="Subgenre of house music")
            category3 = Category(name="Afro House", description="African influenced house music")
            
            db.add_all([category1, category2, category3])
            db.commit()
            logger.info("Categories created successfully")
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Error creating categories: {e}")
            raise
        
        # Create mixes
        try:
            # Check if the uploads directory exists
            uploads_dir = "uploads"
            if not os.path.exists(uploads_dir):
                logger.warning(f"Uploads directory '{uploads_dir}' does not exist. Creating it...")
                os.makedirs(uploads_dir, exist_ok=True)
            
            # Define test audio files
            test_files = [
                {
                    "filename": "Calvin Fallo - Ithemba (feat. Ag'zo, Tshego AMG & Tim Lewis).mp3",
                    "title": "Ithemba",
                    "artist": artist2,
                    "duration": 240,
                    "size_mb": 5.2,
                    "quality_kbps": 320,
                    "categories": [category1, category3]  # Amapiano, Afro House
                },
                {
                    "filename": "Kelvin Momo and Da Muziqal Chef - Bo Gogo Ft Tracy Thatohatsi.mp3",
                    "title": "Bo Gogo",
                    "artist": artist3,
                    "duration": 210,
                    "size_mb": 4.8,
                    "quality_kbps": 320,
                    "categories": [category1]  # Amapiano
                },
                {
                    "filename": "DJ Papzin - Summer Mix 2023.mp3",
                    "title": "Summer Mix 2023",
                    "artist": artist1,
                    "duration": 3600,
                    "size_mb": 86.4,
                    "quality_kbps": 192,
                    "categories": [category2, category3]  # Deep House, Afro House
                }
            ]
            
            # Create test files and add to database
            for file_info in test_files:
                file_path = os.path.join(uploads_dir, file_info["filename"])
                
                # Create empty test file if it doesn't exist
                if not os.path.exists(file_path):
                    logger.warning(f"Test audio file not found: {file_path}")
                    logger.info(f"Creating empty test file: {file_path}")
                    with open(file_path, 'wb') as f:
                        f.write(b'')  # Create empty file
                
                # Create mix record
                mix = Mix(
                    title=file_info["title"],
                    artist_id=file_info["artist"].id,
                    duration_seconds=file_info["duration"],
                    file_size_mb=file_info["size_mb"],
                    quality_kbps=file_info["quality_kbps"],
                    file_path=file_path
                )
                
                # Add categories to mix
                for category in file_info["categories"]:
                    mix.categories.append(category)
                
                db.add(mix)
            
            db.commit()
            logger.info("Test mixes created successfully")
        db.commit()
            
            # Add categories to mix
            mix1.categories.append(category1)
            mix1.categories.append(category3)
        
        logger.info("Database seeded successfully!")
        
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        if db:
        db.rollback()
        raise
    finally:
        if db:
        db.close()
            logger.info("Database session closed")

if __name__ == "__main__":
    seed_database()
