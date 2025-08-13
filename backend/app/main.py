import os
import sys
import logging
import re
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .db.database import engine
from .models import models
from .routers import tracks, categories, artists, uploads, storage, cleanup, file_management

# Configure logging early
log_level = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, log_level, logging.INFO),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
# Tame very chatty libraries
logging.getLogger("botocore").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)

# Load environment variables from .env files
# 1) Project root .env
root_env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=root_env_path)
# 2) backend/.env (override root for backend-specific config)
backend_env_path = Path(__file__).parent.parent / '.env'
if backend_env_path.exists():
    load_dotenv(dotenv_path=backend_env_path, override=True)
else:
    # Fallback: try loading from current working directory
    load_dotenv('.env')

# Print environment variables for debugging (remove in production)
print("B2_ENABLED:", 'B2_ACCESS_KEY_ID' in os.environ and 'B2_SECRET_ACCESS_KEY' in os.environ)
print("B2_BUCKET:", os.getenv('B2_BUCKET'))

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="PapzinCrew Music Streaming API",
              description="API for PapzinCrew Music Streaming Platform",
              version="0.1.0")

# CORS middleware configuration
# Compose allowed origins from environment, fallback to dev localhost values.
default_dev_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://localhost:8000",
]

raw_allowed = os.getenv("ALLOWED_ORIGINS")
allowed_origins = [o.strip() for o in raw_allowed.split(",") if o.strip()] if raw_allowed else default_dev_origins
allowed_origin_regex = os.getenv("ALLOWED_ORIGIN_REGEX") or r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,  # Cache preflight requests for 10 minutes
)

# Include routers
app.include_router(tracks.router)
app.include_router(categories.router)
app.include_router(artists.router)
app.include_router(uploads.router)
app.include_router(storage.router)
app.include_router(cleanup.router)
app.include_router(file_management.router)

# Determine upload directory from environment and ensure it exists
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Mount the upload directory to serve static files consistently at /uploads
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.get("/")
def read_root():
    return {"message": "Welcome to the Papzin & Crew Music Streaming API"}

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "b2_configured": 'B2_ACCESS_KEY_ID' in os.environ}

# Keep-alive endpoint to prevent server from shutting down
@app.get("/keepalive")
async def keep_alive():
    return {"status": "alive"}

# Global exception handler
@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        # Let FastAPI handle HTTPException with its original detail/status
        if isinstance(e, HTTPException):
            raise e
        print(f"Unhandled exception: {str(e)}", file=sys.stderr)
        # Ensure CORS headers are present even on error responses so the
        # frontend can read the error details instead of a CORS block.
        error_payload = {
            "detail": "Internal server error",
            "error": str(e),
            "error_type": e.__class__.__name__,
        }
        response = JSONResponse(
            status_code=500,
            content=error_payload,
        )
        origin = request.headers.get("origin")
        try:
            if origin:
                origin_allowed = (
                    ("*" in allowed_origins) or
                    (origin in allowed_origins) or
                    (allowed_origin_regex and re.match(allowed_origin_regex, origin))
                )
                if origin_allowed:
                    response.headers["Access-Control-Allow-Origin"] = origin if "*" not in allowed_origins else "*"
                    response.headers["Vary"] = "Origin"
                    # Mirror global CORS config
                    response.headers["Access-Control-Allow-Credentials"] = "true"
                    exposed = response.headers.get("Access-Control-Expose-Headers", "")
                    if "Content-Disposition" not in exposed:
                        response.headers["Access-Control-Expose-Headers"] = (exposed + ",Content-Disposition").strip(",")
        except Exception:
            # Never fail setting headers
            pass
        return response