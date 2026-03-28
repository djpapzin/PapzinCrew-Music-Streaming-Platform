import os

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..db.database import get_db
from ..models import models
from ..services.paperclip_client import PaperclipConsumerError, fetch_paperclip_summary

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    responses={404: {"description": "Not found"}},
)


def require_admin_api_key(x_admin_api_key: str | None = Header(default=None)) -> None:
    admin_api_key = os.getenv("ADMIN_API_KEY")

    if not admin_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin API key is not configured",
        )

    if not x_admin_api_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin API Key is required",
        )

    if x_admin_api_key != admin_api_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid Admin API Key",
        )


@router.get("/analytics")
def get_analytics(
    db: Session = Depends(get_db),
    _: None = Depends(require_admin_api_key),
):
    """Provides key analytics for the admin dashboard."""
    total_plays = db.query(func.sum(models.Mix.play_count)).scalar() or 0
    total_downloads = db.query(func.sum(models.Mix.download_count)).scalar() or 0
    total_storage_mb = db.query(func.sum(models.Mix.file_size_mb)).scalar() or 0

    paperclip_summary = None
    try:
        paperclip_summary = fetch_paperclip_summary(203)
    except PaperclipConsumerError:
        paperclip_summary = None

    return {
        "total_plays": total_plays,
        "total_downloads": total_downloads,
        "total_storage_mb": round(total_storage_mb, 2),
        "paperclip_summary": paperclip_summary,
    }
