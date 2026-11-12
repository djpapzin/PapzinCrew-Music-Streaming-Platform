"""Owner-only release desk. No publication or distribution endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db.database import get_db
from ..models.models import Mix
from ..services import release_reviews as reviews
from .admin import require_admin_api_key

router = APIRouter(prefix='/admin/releases', tags=['admin'], dependencies=[Depends(require_admin_api_key)])


def reviewable(db, mix_id):
    mix = db.query(Mix).filter(Mix.id == mix_id).first()
    if mix is None:
        raise HTTPException(404, 'Mix not found')
    if mix.availability != 'unlisted':
        raise HTTPException(409, 'The release desk reviews unlisted mixes only.')
    return mix


@router.get('')
def queue(db: Session = Depends(get_db)):
    rows = db.query(Mix).filter(Mix.availability == 'unlisted').order_by(Mix.id.desc()).all()
    return {'mixes': [{'id': row.id, 'title': row.title, 'artist': row.artist.name if row.artist else '',
                       'test_only': reviews.is_test(reviews.snapshot(row))} for row in rows]}


@router.get('/{mix_id}')
def detail(mix_id: int, db: Session = Depends(get_db)):
    return reviews.load(reviewable(db, mix_id))


@router.put('/{mix_id}')
def update(mix_id: int, change: reviews.ReviewChange, db: Session = Depends(get_db)):
    return reviews.save(reviewable(db, mix_id), change)
