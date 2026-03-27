from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from ..services.paperclip_client import PaperclipConsumerError, fetch_paperclip_summary

router = APIRouter(prefix="/paperclip", tags=["paperclip"])


@router.get("/summary/{task_id}")
def get_paperclip_summary(task_id: int) -> dict[str, Any]:
    """Proxy a Paperclip business summary into the Papzin & Crew API."""

    try:
        return fetch_paperclip_summary(task_id)
    except PaperclipConsumerError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
