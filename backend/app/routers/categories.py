from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .. import schemas, crud
from ..db.database import get_db

router = APIRouter(prefix="/categories", tags=["categories"])

def public_category(category):
    return {'id': category.id, 'name': category.name, 'description': category.description,
            'mixes': [mix for mix in category.mixes if mix.availability in ('public', None)]}

@router.get("/", response_model=List[schemas.Category])
def read_categories(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Retrieve all categories with pagination.
    """
    categories = crud.get_categories(db, skip=skip, limit=limit)
    return [public_category(category) for category in categories]

@router.get("/{category_id}", response_model=schemas.Category)
def read_category(category_id: int, db: Session = Depends(get_db)):
    """
    Get a specific category by ID.
    """
    db_category = crud.get_category(db, category_id=category_id)
    if db_category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    return public_category(db_category)

@router.get("/{category_id}/tracks", response_model=List[schemas.Mix])
def read_category_tracks(category_id: int, db: Session = Depends(get_db)):
    """
    Get all tracks in a specific category.
    """
    db_category = crud.get_category(db, category_id=category_id)
    if db_category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    return public_category(db_category)['mixes']

@router.post("/", response_model=schemas.Category, status_code=201)
def create_category(category: schemas.CategoryCreate, db: Session = Depends(get_db)):
    """
    Create a new category.
    """
    db_category = crud.create_category(db=db, category=category)
    return db_category
