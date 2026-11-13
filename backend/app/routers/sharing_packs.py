"""Read-only owner sharing drafts for existing public catalog mixes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db.database import get_db
from ..models.models import Mix
from ..services.release_reviews import snapshot, fingerprint, is_test
from .admin import require_admin_api_key

router = APIRouter(prefix='/admin/sharing', tags=['admin'], dependencies=[Depends(require_admin_api_key)])

def eligible(mix):
    return mix.availability == 'public' and not is_test(snapshot(mix))

@router.get('')
def queue(db: Session = Depends(get_db)):
    rows = db.query(Mix).filter(Mix.availability == 'public').order_by(Mix.id.desc()).all()
    return {'mixes': [{'id': m.id, 'title': m.title, 'artist': m.artist.name if m.artist else ''} for m in rows if eligible(m)]}

@router.get('/{mix_id}')
def pack(mix_id: int, db: Session = Depends(get_db)):
    mix = db.query(Mix).filter(Mix.id == mix_id).first()
    if not mix or not eligible(mix):
        raise HTTPException(404, 'This mix is not available for public sharing.')
    data = snapshot(mix)
    link = f'https://crew.djpapzin.com/track/{mix.id}'
    title = data['title'] or 'MISSING: catalog title'
    artist = data['artist'] or 'MISSING: artist credit'
    return {'id': mix.id, 'title': title, 'artist': artist, 'fingerprint': fingerprint(data),
            'url': link, 'short': f'{title} — {artist}\n{link}',
            'long': f'Let’s Cruize!\n{title}\nMixed by {artist}\nListen: {link}',
            'credit_note': 'Artist credit comes from the catalog. Confirm guest credits and handles before sharing.'}
