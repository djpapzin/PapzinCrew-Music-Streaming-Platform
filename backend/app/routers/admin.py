import os

from fastapi import BackgroundTasks, APIRouter, Depends, Header, HTTPException, status, Query
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


@router.get('/tracklist-drafts/{mix_id}')
def get_tracklist_draft(mix_id: int, provider: str = Query(default='audd'), _: None = Depends(require_admin_api_key)):
    from ..services import tracklist_drafts as drafts
    from ..services import free_tracklist_drafts as free
    if provider != 'audd':
        try:
            option = next((o for o in free.options() if o['id'] == provider), None)
            if option is None:
                raise free.DraftError('Unknown free provider.')
            return {'enabled': option['enabled'], 'draft': free.load(mix_id, provider), 'providers': free.options()}
        except free.DraftError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
    token, budget, download_budget = drafts.settings()
    return {'enabled': bool(token and budget and download_budget) and os.getenv('AUDD_SCANS_ENABLED', '1') != '0', 'draft': drafts.load(mix_id)}


@router.post('/tracklist-drafts/{mix_id}')
def generate_tracklist_draft(mix_id: int, background_tasks: BackgroundTasks,
                             provider: str = Query(default='audd'),
                             body: dict | None = None,
                             db: Session = Depends(get_db),
                             _: None = Depends(require_admin_api_key)):
    from ..services import tracklist_drafts as drafts
    mix = db.query(models.Mix).filter(models.Mix.id == mix_id).first()
    if mix is None:
        raise HTTPException(status_code=404, detail='Mix not found')
    if provider != 'audd':
        from ..services import free_tracklist_drafts as free
        try:
            text = (body or {}).get('text', '')
            if not isinstance(text, str) or len(text) > 100000:
                raise free.DraftError('Manual draft is too long or invalid.')
            draft, created = free.prepare(mix, provider, text)
        except free.DraftError as exc:
            raise HTTPException(status_code=409, detail=str(exc))
        if created:
            background_tasks.add_task(free.run, mix.id, provider, mix.file_path)
        return {'draft': draft}
    if os.getenv('AUDD_SCANS_ENABLED', '1') == '0':
        raise HTTPException(status_code=409, detail='AudD scans are disabled. Choose a free provider; saved drafts remain available.')
    try:
        draft, created = drafts.prepare(mix)
    except drafts.DraftError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    if created:
        background_tasks.add_task(drafts.run, mix.id, mix.file_path)
    return {'draft': draft}
