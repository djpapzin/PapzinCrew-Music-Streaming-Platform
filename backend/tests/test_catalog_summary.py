from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.models.models import Base, Artist, Mix
from app.routers.tracks import catalog_summary


def test_summary_counts_only_public_tracks():
    engine = create_engine('sqlite://')
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        artist = Artist(name='Papzin & Crew')
        db.add(artist)
        db.flush()
        for index, availability in enumerate(['public', 'private', 'unlisted']):
            db.add(Mix(title='Test mix', original_filename='test.mp3', artist_id=artist.id,
                       duration_seconds=3600, file_path=f'/test/{index}.mp3', file_size_mb=10.0,
                       quality_kbps=320, availability=availability))
        db.commit()
        assert catalog_summary(db) == {'total_tracks': 1, 'total_duration_hours': 1.0,
                                       'total_storage_mb': 10.0, 'total_artists': 1}


def test_summary_empty_catalog():
    engine = create_engine('sqlite://')
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        assert catalog_summary(db) == {'total_tracks': 0, 'total_duration_hours': 0.0,
                                       'total_storage_mb': 0.0, 'total_artists': 0}


def test_public_catalog_omits_embedded_metadata_and_preserves_tracklists():
    from app.routers.tracks import public_catalog
    import json
    engine = create_engine('sqlite://')
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        artist=Artist(name='DJ');db.add(artist);db.flush()
        for index, availability in enumerate(['public','private','unlisted']):
            db.add(Mix(title='Mix',artist_id=artist.id,duration_seconds=3600,
                       file_path=f'https://example.com/{index}',file_size_mb=10,quality_kbps=320,
                       availability=availability,tags='x'*100000,tracklist='Existing tracklist'))
        db.commit()
        result=public_catalog(db)
        assert len(result)==1
        assert result[0]['tracklist']=='Existing tracklist'
        assert result[0]['artist']=={'name':'DJ'}
        assert 'tags' not in result[0] and len(json.dumps(result))<2000
