import os
import sys
import logging
from pathlib import Path

# Set up logging to both file and console
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('db_test.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Add the parent directory to the Python path
sys.path.append(str(Path(__file__).parent.parent))

def test_database():
    """Test database connection and data access directly"""
    try:
        # Import SQLAlchemy components
        from sqlalchemy import create_engine, inspect, text
        from sqlalchemy.orm import sessionmaker
        
        # Database URL - using absolute path to be sure
        db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), 'papzin_crew.db'))
        db_url = f"sqlite:///{db_path}"
        
        logger.info(f"Using database at: {db_path}")
        logger.info(f"Database exists: {os.path.exists(db_path)}")
        
        if os.path.exists(db_path):
            logger.info(f"Database size: {os.path.getsize(db_path)} bytes")
        else:
            logger.warning("Database file does not exist!")
        
        # Create engine with echo=True to see SQL queries
        engine = create_engine(db_url, echo=True, connect_args={"check_same_thread": False})
        
        # Test raw connection
        with engine.connect() as conn:
            logger.info("Successfully connected to the database")
            
            # Check if tables exist
            inspector = inspect(engine)
            tables = inspector.get_table_names()
            logger.info(f"Found tables: {tables}")
            
            # Check each table
            for table in tables:
                logger.info(f"\nTable: {table}")
                # Get column info
                columns = inspector.get_columns(table)
                logger.info("Columns:")
                for col in columns:
                    logger.info(f"  {col['name']} ({col['type']})")
                
                # Count rows
                result = conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                count = result.scalar()
                logger.info(f"Row count: {count}")
                
                # Show sample data if not empty
                if count > 0:
                    result = conn.execute(text(f"SELECT * FROM {table} LIMIT 3"))
                    logger.info("Sample rows:")
                    for row in result:
                        logger.info(f"  {dict(row._mapping)}")
        
        # Test ORM models
        logger.info("\nTesting ORM models...")
        from sqlalchemy.orm import sessionmaker
        from app.models import models
        
        Session = sessionmaker(bind=engine)
        session = Session()
        
        try:
            # Test Artist model
            logger.info("\nArtists:")
            artists = session.query(models.Artist).all()
            logger.info(f"Found {len(artists)} artists")
            for artist in artists:
                logger.info(f"  {artist.id}: {artist.name}")
            
            # Test Category model
            logger.info("\nCategories:")
            categories = session.query(models.Category).all()
            logger.info(f"Found {len(categories)} categories")
            for category in categories:
                logger.info(f"  {category.id}: {category.name} - {category.description}")
            
            # Test Mix model with relationships
            logger.info("\nMixes:")
            mixes = session.query(models.Mix).all()
            logger.info(f"Found {len(mixes)} mixes")
            for mix in mixes:
                logger.info(f"  {mix.id}: {mix.title} by {mix.artist.name if mix.artist else 'Unknown'}")
                logger.info(f"    Categories: {[c.name for c in mix.categories]}")
                
        finally:
            session.close()
        
        return True
        
    except Exception as e:
        logger.error(f"Error testing database: {e}", exc_info=True)
        return False

def main():
    logger.info("Starting direct database test...")
    logger.info(f"Working directory: {os.getcwd()}")
    
    success = test_database()
    
    if success:
        logger.info("\n✅ Database test completed successfully")
    else:
        logger.error("\n❌ Database test failed")
    
    logger.info("Check 'db_test.log' for detailed logs")
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
