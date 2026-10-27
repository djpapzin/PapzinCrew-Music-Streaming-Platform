import os
import hmac

from fastapi import BackgroundTasks, APIRouter, Depends, Header, HTTPException, status, Query, Request, Response
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


def require_admin_api_key(request: Request, response: Response, x_admin_api_key: str | None = Header(default=None)) -> None:
    from ..services import owner_sessions as sessions
    response.headers['Cache-Control'] = 'private, no-store'
    response.headers['Vary'] = 'Cookie, X-Admin-Api-Key'
    admin_api_key = os.getenv('ADMIN_API_KEY')
    if not admin_api_key:
        raise HTTPException(503, 'Admin API key is not configured')
    if x_admin_api_key:
        if hmac.compare_digest(x_admin_api_key, admin_api_key):
            return
        raise HTTPException(403, 'Invalid Admin API Key')
    if sessions.valid(request):
        if request.method not in ('GET', 'HEAD', 'OPTIONS'):
            sessions.require_origin(request)
        return
    raise HTTPException(403, 'Admin API Key is required, or unlock an owner session')


@router.get('/session')
def owner_session(request: Request, response: Response):
    from ..services import owner_sessions as sessions
    response.headers['Cache-Control'] = 'no-store'
    return {'authenticated': bool(os.getenv('ADMIN_API_KEY')) and sessions.valid(request)}


@router.post('/session')
def unlock_owner(request: Request, response: Response, remember: bool = Query(default=False),
                 x_admin_api_key: str | None = Header(default=None)):
    from ..services import owner_sessions as sessions
    sessions.require_origin(request)
    key = os.getenv('ADMIN_API_KEY')
    if not key:
        raise HTTPException(503, 'Owner access is not configured')
    if not x_admin_api_key or not hmac.compare_digest(x_admin_api_key, key):
        raise HTTPException(403, 'The owner key is missing or invalid')
    token, seconds = sessions.create(remember)
    response.set_cookie(sessions.COOKIE, token, max_age=seconds if remember else None,
                        httponly=True, secure=True, samesite='strict', path='/')
    response.headers['Cache-Control'] = 'no-store'
    return {'authenticated': True, 'remembered': remember, 'expires_in': seconds}


@router.delete('/session')
def lock_owner(request: Request, response: Response):
    from ..services import owner_sessions as sessions
    sessions.require_origin(request)
    sessions.revoke(request)
    response.delete_cookie(sessions.COOKIE, httponly=True, secure=True, samesite='strict', path='/')
    response.headers['Cache-Control'] = 'no-store'
    return {'authenticated': False}


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
