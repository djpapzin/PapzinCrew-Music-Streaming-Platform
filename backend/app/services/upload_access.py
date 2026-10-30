"""Reversible upload pause, checked before multipart bodies reach the handlers."""
import os
from fastapi.responses import JSONResponse


async def upload_access_guard(request, call_next):
    path = request.url.path
    if (os.getenv('UPLOADS_ENABLED', '1') == '0'
            and request.method != 'OPTIONS'
            and (path == '/upload' or path.startswith('/upload/'))):
        return JSONResponse(status_code=503, content={
            'detail': 'Uploads are temporarily paused. Listening and downloads are still available.'
        }, headers={'Cache-Control': 'no-store'})
    return await call_next(request)
