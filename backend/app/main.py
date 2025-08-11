import os
import sys
import logging
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .db.database import engine
from .models import models
from .routers import tracks, categories, artists, uploads, storage

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

# Print environment variables for debugging (remove in production)
print("B2_ENABLED:", 'B2_ACCESS_KEY_ID' in os.environ and 'B2_SECRET_ACCESS_KEY' in os.environ)
print("B2_BUCKET:", os.getenv('B2_BUCKET'))

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="PapzinCrew Music Streaming API",
              description="API for PapzinCrew Music Streaming Platform",
              version="0.1.0")

# CORS middleware configuration
# Define allowed origins - in development, include common localhost ports used by Vite/react.
allowed_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://localhost:8000",
    "http://127.0.0.1:54836",
]

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    # Allow any localhost/127.0.0.1 port during development (covers browser preview proxies)
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\\d+)?$",
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
            if origin and origin in allowed_origins:
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Vary"] = "Origin"
                # Mirror global CORS config
                response.headers["Access-Control-Allow-Credentials"] = "true"
                if "Content-Disposition" not in response.headers.get("Access-Control-Expose-Headers", ""):
                    response.headers["Access-Control-Expose-Headers"] = "Content-Disposition"
        except Exception:
            # Never fail setting headers
            pass
        return response