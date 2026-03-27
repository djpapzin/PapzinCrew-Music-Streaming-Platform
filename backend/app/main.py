import os
import sys
import logging
import re
from pathlib import Path
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from sqlalchemy import inspect, text
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .db.database import engine, get_db_diagnostics
from .models import models
from .routers import auth, tracks, categories, artists, uploads, storage, cleanup, file_management, paperclip
from .logging_utils import (
    setup_logging,
    set_request_id,
    clear_request_id,
    generate_request_id,
    get_request_id,
)

# Configure logging early (JSON/text with request_id support)
setup_logging()
# App logger
logger = logging.getLogger("app")

# Load environment variables from .env files
# 1) Project root .env
root_env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=root_env_path)
# 2) backend/.env (override root for backend-specific config)
backend_env_path = Path(__file__).parent.parent / '.env'
if backend_env_path.exists():
    # Do not override environment variables already set (e.g., by tests)
    load_dotenv(dotenv_path=backend_env_path, override=False)
else:
    # Fallback: try loading from current working directory
    load_dotenv('.env')

# Print environment variables for debugging (remove in production)
logger.info(
    "B2 configured=%s bucket=%s",
    'B2_ACCESS_KEY_ID' in os.environ and 'B2_SECRET_ACCESS_KEY' in os.environ,
    os.getenv('B2_BUCKET'),
)
logger.info("DB diagnostics: %s", get_db_diagnostics())


# Ensure backward-compatible schema for existing databases without migrations
def _ensure_mix_extra_columns(db_engine=None):
    """
    Add missing columns/indexes on the 'mixes' table when running against an
    existing database that was created before these fields existed.

    This is a lightweight, idempotent startup repair so deploys don't fail
    with missing-column errors on legacy databases.
    """
    db_engine = db_engine or engine
    try:
        # Use a transactional connection so it works on Postgres and SQLite.
        with db_engine.begin() as conn:
            inspector = inspect(conn)
            if "mixes" not in inspector.get_table_names():
                return

            existing_cols = {col["name"] for col in inspector.get_columns("mixes")}
            if "play_count" not in existing_cols:
                conn.execute(text("ALTER TABLE mixes ADD COLUMN play_count INTEGER DEFAULT 0"))
            if "download_count" not in existing_cols:
                conn.execute(text("ALTER TABLE mixes ADD COLUMN download_count INTEGER DEFAULT 0"))
            if "file_hash" not in existing_cols:
                conn.execute(text("ALTER TABLE mixes ADD COLUMN file_hash VARCHAR(64)"))

            existing_indexes = {idx["name"] for idx in inspect(conn).get_indexes("mixes")}
            if "ix_mixes_file_hash" not in existing_indexes:
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_mixes_file_hash ON mixes (file_hash)"))
    except Exception:
        # Never crash server on startup; just log for diagnostics
        logger.exception("Failed to ensure extra columns on 'mixes' table")


def _db_ping() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        logger.exception("Database ping failed")
        return False

@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(os.getenv("UPLOAD_DIR", "uploads"), exist_ok=True)

    should_bootstrap = _env_bool("DB_AUTO_MIGRATE", default=False) or get_db_diagnostics().get("source") == "pytest"
    if should_bootstrap:
        try:
            models.Base.metadata.create_all(bind=engine)
            _ensure_mix_extra_columns()
        except Exception:
            logger.exception("Legacy DB bootstrap failed during startup")
    yield


app = FastAPI(title="PapzinCrew Music Streaming API",
              description="API for PapzinCrew Music Streaming Platform",
              version="0.1.0",
              lifespan=lifespan)

# CORS middleware configuration
# Compose allowed origins from environment, fallback to dev localhost values.
default_dev_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://localhost:8000",
    # Production URLs
    "https://papzincrew.netlify.app",
    "https://papzincrew-netlify.app",
    "https://papzincrew-backend.onrender.com",
]

def _parse_allowed_origins() -> list[str]:
    raw = os.getenv("ALLOWED_ORIGINS")
    # If the env var is present (even empty), parse strictly from it
    if raw is not None:
        env_origins = [o.strip() for o in raw.split(",") if o.strip()]
        # Deduplicate while preserving order for deterministic equality in tests
        dedup = list(dict.fromkeys(env_origins))
        return dedup
    # Fallback to development defaults when not configured
    return default_dev_origins

# Concrete list used by middleware
allowed_origins_list = _parse_allowed_origins()
allowed_origin_regex = os.getenv("ALLOWED_ORIGIN_REGEX") or r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$|^https://papzincrew\-netlify\.app$|^null$"

# Debug CORS configuration
logger.info("CORS allowed_origins_list: %s", allowed_origins_list)
logger.info("CORS allowed_origin_regex: %s", allowed_origin_regex)

# Proxy exported as `allowed_origins` for tests that import it multiple times
class _AllowedOriginsProxy:
    def __eq__(self, other):
        return _parse_allowed_origins() == other
    def __repr__(self):
        return repr(_parse_allowed_origins())
    def __iter__(self):
        return iter(_parse_allowed_origins())
    def __contains__(self, item):
        return item in _parse_allowed_origins()

# Keep name used in tests: from app.main import allowed_origins
allowed_origins = _AllowedOriginsProxy()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins_list,
    allow_origin_regex=allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,  # Cache preflight requests for 10 minutes
)

# Request ID middleware (sets context var and response header)
@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    # Prefer incoming header (client-supplied) else generate
    incoming = request.headers.get("x-request-id") or request.headers.get("x-request-id")
    req_id = generate_request_id(incoming)
    set_request_id(req_id)
    # Log request start
    logger.info(
        "request_start %s %s",
        request.method,
        request.url.path,
        extra={"path": request.url.path, "method": request.method, "action": "request_start"},
    )
    try:
        response: Response = await call_next(request)
    except Exception:
        # Ensure context cleared on error path; exception handler will run next
        clear_request_id()
        raise
    # Attach header for correlation
    try:
        response.headers["X-Request-ID"] = req_id
    except Exception:
        pass
    # Log request end
    logger.info(
        "request_end %s %s -> %s",
        request.method,
        request.url.path,
        getattr(response, "status_code", None),
        extra={
            "path": request.url.path,
            "method": request.method,
            "status": getattr(response, "status_code", None),
            "action": "request_end",
        },
    )
    # Clear after response to avoid leaking across tasks
    clear_request_id()
    return response

# Security & audit middleware to ensure suspicious /files requests are logged early
@app.middleware("http")
async def files_security_audit_middleware(request: Request, call_next):
    try:
        # Use the file_management module's logger so tests that patch it will capture logs
        from .routers import file_management as _fm
        sec_logger = _fm.logger
    except Exception:
        sec_logger = logger

    try:
        raw_path_bytes = request.scope.get("raw_path")  # type: ignore[attr-defined]
        raw_path = raw_path_bytes.decode("latin-1") if isinstance(raw_path_bytes, (bytes, bytearray)) else request.url.path
    except Exception:
        raw_path = request.url.path

    # Only act on /files* routes
    if raw_path.startswith("/files"):
        # Audit all DELETE attempts
        if request.method.upper() == "DELETE":
            try:
                sec_logger.warning(f"Audit: DELETE request path={raw_path}")
            except Exception:
                pass
        # Security: log traversal indicators even if routing normalizes the path later
        try:
            if ".." in raw_path or re.search(r"%2e", raw_path, flags=re.IGNORECASE):
                sec_logger.warning(f"Directory traversal attempt detected (middleware raw path): {raw_path}")
        except Exception:
            pass

    return await call_next(request)

# Include routers
app.include_router(auth.router)
app.include_router(tracks.router)
app.include_router(categories.router)
app.include_router(artists.router)
app.include_router(uploads.router)
app.include_router(storage.router)
app.include_router(cleanup.router)
app.include_router(file_management.router)
app.include_router(paperclip.router)

# Determine upload directory from environment
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

# Mount the upload directory to serve static files consistently at /uploads
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR, check_dir=False), name="uploads")

# Pytest imports may instantiate TestClient without lifespan startup, so ensure
# temporary test databases have schema eagerly when running under pytest.
if get_db_diagnostics().get("source") == "pytest":
    try:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        models.Base.metadata.create_all(bind=engine)
        _ensure_mix_extra_columns()
    except Exception:
        logger.exception("Pytest eager DB bootstrap failed")


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@app.get("/")
def read_root():
    return {"message": "Welcome to the Papzin & Crew Music Streaming API"}

# Health check endpoint (liveness only; no DB query)
@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "b2_configured": "B2_ACCESS_KEY_ID" in os.environ,
        "database": get_db_diagnostics(),
    }


@app.get("/ready")
async def readiness_check():
    db_ready = _db_ping()
    payload = {
        "status": "ready" if db_ready else "not_ready",
        "database": {**get_db_diagnostics(), "reachable": db_ready},
    }
    if db_ready:
        return payload
    return JSONResponse(status_code=503, content=payload)

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
        logger.exception("Unhandled exception")
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
        # Propagate request id for correlation
        try:
            response.headers["X-Request-ID"] = get_request_id()
        except Exception:
            pass
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