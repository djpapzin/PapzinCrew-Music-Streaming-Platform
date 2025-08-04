import sys
import os
import logging
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import create_engine, inspect
from sqlalchemy.exc import SQLAlchemyError

# Add the parent directory to the Python path
sys.path.append(str(Path(__file__).parent.parent))

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Import after setting up path
from app.db.database import SQLALCHEMY_DATABASE_URL, Base, engine, get_db
from app.models import models

def test_database_connection():
    logger.info("Starting database connection test...")
    
    # Print database URL (with sensitive info masked if needed)
    db_url = str(SQLALCHEMY_DATABASE_URL)
    logger.info(f"Database URL: {db_url}")
    
    # Check if database file exists
    db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'papzin_crew.db'))
    logger.info(f"Database file path: {db_path}")
    logger.info(f"Database file exists: {os.path.exists(db_path)}")
    if os.path.exists(db_path):
        logger.info(f"Database file size: {os.path.getsize(db_path)} bytes")
    
    try:
        # Create a new engine with echo=True for SQL logging
        test_engine = create_engine(
            SQLALCHEMY_DATABASE_URL, 
            connect_args={"check_same_thread": False},
            echo=True  # Enable SQL query logging
        )
        
        # Test connection
        with test_engine.connect() as connection:
            logger.info("✅ Successfully connected to the database")
            
            # Get database info
            inspector = inspect(test_engine)
            
            # List all tables in the database
            tables = inspector.get_table_names()
            logger.info(f"\nTables in database: {tables}")
            
            # Check each table's columns and data
            for table_name in tables:
                logger.info(f"\nTable: {table_name}")
                columns = [col['name'] for col in inspector.get_columns(table_name)]
                logger.info(f"  Columns: {columns}")
                
                # Count rows in the table
                with test_engine.connect() as conn:
                    result = conn.execute(f"SELECT COUNT(*) FROM {table_name}")
                    count = result.scalar()
                    logger.info(f"  Row count: {count}")
                    
                    # Show sample data if table is not empty
                    if count > 0:
                        result = conn.execute(f"SELECT * FROM {table_name} LIMIT 3")
                        logger.info(f"  Sample data:")
                        for row in result:
                            logger.info(f"    {dict(row)}")
            
            # Test ORM models
            with Session(test_engine) as session:
                logger.info("\nTesting ORM models...")
                
                # Test Artist model
                try:
                    artists = session.query(models.Artist).all()
                    logger.info(f"Found {len(artists)} artists in the database")
                    for artist in artists:
                        logger.info(f"- Artist: {artist.id}: {artist.name}")
                except Exception as e:
                    logger.error(f"Error querying artists: {e}", exc_info=True)
                
                # Test Category model
                try:
                    categories = session.query(models.Category).all()
                    logger.info(f"\nFound {len(categories)} categories in the database")
                    for category in categories:
                        logger.info(f"- Category: {category.id}: {category.name} - {category.description}")
                except Exception as e:
                    logger.error(f"Error querying categories: {e}", exc_info=True)
                
                # Test Mix model
                try:
                    mixes = session.query(models.Mix).all()
                    logger.info(f"\nFound {len(mixes)} mixes in the database")
                    for mix in mixes:
                        logger.info(f"- Mix: {mix.id}: {mix.title} by {mix.artist.name if mix.artist else 'Unknown'}")
                        logger.info(f"  Categories: {[c.name for c in mix.categories]}")
                except Exception as e:
                    logger.error(f"Error querying mixes: {e}", exc_info=True)
                
                # Test relationship loading
                try:
                    logger.info("\nTesting relationship loading...")
                    for mix in session.query(models.Mix).limit(2):
                        logger.info(f"Mix: {mix.title}")
                        logger.info(f"  Artist: {mix.artist.name if mix.artist else 'None'}")
                        logger.info(f"  Categories: {[c.name for c in mix.categories]}")
                except Exception as e:
                    logger.error(f"Error testing relationships: {e}", exc_info=True)
    
    except SQLAlchemyError as e:
        logger.error(f"❌ Database error: {e}", exc_info=True)
        return False
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}", exc_info=True)
        return False
    
    return True

def main():
    logger.info("Starting database test...")
    logger.info(f"Current working directory: {os.getcwd()}")
    logger.info(f"Python path: {sys.path}")
    
    # Test database connection and data
    success = test_database_connection()
    
    if success:
        logger.info("\n✅ Database test completed successfully")
    else:
        logger.error("\n❌ Database test failed")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
