from fastapi import APIRouter
from ..services.b2_storage import B2Storage

router = APIRouter(prefix="/storage", tags=["storage"])

@router.get("/health")
async def storage_health():
    """Report storage health, focusing on Backblaze B2.
    Returns:
      {
        status: "ok" | "degraded" | "disabled",
        b2: { configured: bool, ok: bool, ... }
      }
    """
    b2 = B2Storage()
    b2_health = b2.check_health()

    if not b2_health.get("configured"):
        overall = "disabled"
    else:
        overall = "ok" if b2_health.get("ok") else "degraded"

    return {
        "status": overall,
        "b2": b2_health,
    }
