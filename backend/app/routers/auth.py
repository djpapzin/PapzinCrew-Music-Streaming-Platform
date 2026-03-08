from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from .. import schemas
from ..db.database import get_db
from ..models.models import User
from ..security import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _ensure_users_table(db: Session) -> None:
    """Best-effort safety net for environments where migrations were not run."""
    try:
        bind = db.get_bind()
        User.__table__.create(bind=bind, checkfirst=True)
    except SQLAlchemyError:
        # Let normal query/insert paths raise clearer API errors if DB is unavailable.
        pass


def _find_user_by_identifier(db: Session, identifier: str) -> User | None:
    normalized = identifier.strip().lower()
    if not normalized:
        return None
    return (
        db.query(User)
        .filter(
            or_(
                func.lower(User.email) == normalized,
                func.lower(User.username) == normalized,
            )
        )
        .first()
    )


@router.post("/register", response_model=schemas.AuthRegisterResponse, status_code=status.HTTP_201_CREATED)
def register_user(payload: schemas.AuthRegisterRequest, db: Session = Depends(get_db)):
    _ensure_users_table(db)
    normalized_email = str(payload.email).strip().lower()
    normalized_username = payload.username.strip().lower()

    existing_email = db.query(User).filter(func.lower(User.email) == normalized_email).first()
    if existing_email:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    existing_username = db.query(User).filter(func.lower(User.username) == normalized_username).first()
    if existing_username:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")

    user = User(
        email=normalized_email,
        username=normalized_username,
        password_hash=hash_password(payload.password),
        is_active=True,
    )

    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email or username already exists")

    db.refresh(user)
    return user


@router.post("/login", response_model=schemas.AuthTokenResponse)
def login_user(payload: schemas.AuthLoginRequest, db: Session = Depends(get_db)):
    _ensure_users_table(db)
    user = _find_user_by_identifier(db, payload.identifier)
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is disabled")

    expires_delta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    token = create_access_token(
        subject=str(user.id),
        expires_delta=expires_delta,
        extra_claims={"email": user.email, "username": user.username},
    )

    return schemas.AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=int(expires_delta.total_seconds()),
        user=user,
    )


@router.get("/profile", response_model=schemas.AuthProfileResponse)
def get_profile(current_user: User = Depends(get_current_user)):
    return current_user
