from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..db.database import get_db
from ..models import models
from .tracks import require_admin # Import the dependency

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_admin)], # Apply auth to all routes in this router
    responses={404: {"description": "Not found"}},
)

@router.get("/analytics")
def get_analytics(db: Session = Depends(get_db)):
    """Provides key analytics for the admin dashboard."""
    total_plays = db.query(func.sum(models.Mix.play_count)).scalar() or 0
    total_downloads = db.query(func.sum(models.Mix.download_count)).scalar() or 0
    total_storage_mb = db.query(func.sum(models.Mix.file_size_mb)).scalar() or 0

    return {
        "total_plays": total_plays,
        "total_downloads": total_downloads,
        "total_storage_mb": round(total_storage_mb, 2),
    }
