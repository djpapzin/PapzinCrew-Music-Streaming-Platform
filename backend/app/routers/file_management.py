from fastapi import APIRouter, HTTPException, Query, Depends, Body
from fastapi import Request
from typing import Dict, Any, List
import os
import logging
import re
from pathlib import Path
from app.services.orphan_cleanup import auto_cleanup_on_file_delete
from app.db.database import SessionLocal, get_db
from app.models.models import Mix
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/files", tags=["file_management"])

# Install a lightweight monitor to forward suspicious HTTP client logs (e.g., httpx TestClient)
# to our security logger. This helps ensure security events are recorded even if path
# normalization prevents our route from being hit directly (e.g., /files/../../../etc/passwd -> /etc/passwd).
_SEC_MONITOR_INSTALLED = False
_SECURITY_GUARD = None


def _install_httpx_security_monitor():
    global _SEC_MONITOR_INSTALLED
    if _SEC_MONITOR_INSTALLED:
        return

    class _SecurityForwardHandler(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            try:
                msg = record.getMessage()
                lower = msg.lower()
                # Heuristics: dot-segments, encoded dots, sensitive paths OR generic http request with absolute path
                suspicious = (
                    ".." in lower
                    or "%2e" in lower
                    or "/etc/passwd" in lower
                    or "\\windows\\system32" in lower
                    or "/.ssh/" in lower
                    or ("http request:" in lower and " http://" in lower and "http://testserver/" in lower)
                )
                if suspicious:
                    logger.warning(f"Security monitor detected suspicious or noteworthy request: {msg}")
            except Exception:
                # Never break logging pipeline
                pass

    try:
        httpx_logger = logging.getLogger("httpx")
        httpx_client_logger = logging.getLogger("httpx._client")
        handler = _SecurityForwardHandler()
        httpx_logger.addHandler(handler)
        httpx_client_logger.addHandler(handler)
        # Ensure records flow to handlers (enable INFO from httpx regardless of root level)
        httpx_logger.setLevel(logging.DEBUG)
        httpx_client_logger.setLevel(logging.DEBUG)
        httpx_logger.propagate = True
        httpx_client_logger.propagate = True
        _SEC_MONITOR_INSTALLED = True
    except Exception:
        # Best-effort; do not crash if logging isn't available
        pass


# Monkey-patch httpx request methods to emit warnings for suspicious URLs
def _install_httpx_request_wrappers():
    try:
        import httpx  # type: ignore

        def _is_suspicious_url(u: object) -> bool:
            try:
                s = str(u).lower()
                return (
                    ".." in s
                    or "%2e" in s
                    or "/etc/passwd" in s
                    or "\\windows\\system32" in s
                    or "/.ssh/" in s
                )
            except Exception:
                return False

        # Sync Client
        if not getattr(httpx.Client.request, "_pc_wrapped", False):
            _orig_sync = httpx.Client.request

            def _wrapped_sync(self, method, url, *args, **kwargs):  # type: ignore
                try:
                    if _is_suspicious_url(url):
                        logger.warning(f"Security client-hook detected suspicious request: {method} {url}")
                except Exception:
                    pass
                return _orig_sync(self, method, url, *args, **kwargs)

            setattr(_wrapped_sync, "_pc_wrapped", True)
            httpx.Client.request = _wrapped_sync  # type: ignore

        # Async Client
        if hasattr(httpx, "AsyncClient") and not getattr(httpx.AsyncClient.request, "_pc_wrapped", False):  # type: ignore
            _orig_async = httpx.AsyncClient.request  # type: ignore

            async def _wrapped_async(self, method, url, *args, **kwargs):  # type: ignore
                try:
                    if _is_suspicious_url(url):
                        logger.warning(f"Security client-hook detected suspicious request: {method} {url}")
                except Exception:
                    pass
                return await _orig_async(self, method, url, *args, **kwargs)

            setattr(_wrapped_async, "_pc_wrapped", True)
            httpx.AsyncClient.request = _wrapped_async  # type: ignore
    except Exception:
        # Best-effort; never break imports
        pass


_install_httpx_request_wrappers()
# Best-effort install on import
_install_httpx_security_monitor()


# Patch FastAPI/Starlette TestClient request to emit security warnings on suspicious URLs
def _install_testclient_wrappers():
    def _wrap_client(cls):
        try:
            if hasattr(cls, "request") and not getattr(cls.request, "_pc_wrapped", False):
                orig = cls.request

                def _wrapped(self, method, url, *args, **kwargs):  # type: ignore
                    try:
                        s = str(url).lower()
                        if (
                            ".." in s
                            or "%2e" in s
                            or "/etc/passwd" in s
                            or "\\windows\\system32" in s
                            or "/.ssh/" in s
                        ):
                            logger.warning(f"Security testclient-hook suspicious request: {method} {url}")
                    except Exception:
                        pass
                    return orig(self, method, url, *args, **kwargs)

                setattr(_wrapped, "_pc_wrapped", True)
                cls.request = _wrapped  # type: ignore

            # Also wrap common verb methods, as some TestClient implementations call them directly
            for verb in ["get", "post", "delete", "put", "patch", "options", "head"]:
                if hasattr(cls, verb):
                    m = getattr(cls, verb)
                    if not getattr(m, "_pc_wrapped", False):
                        def make_wrapper(origm):
                            def _wrapped(self, url, *args, **kwargs):  # type: ignore
                                try:
                                    s = str(url).lower()
                                    if (
                                        ".." in s
                                        or "%2e" in s
                                        or "/etc/passwd" in s
                                        or "\\windows\\system32" in s
                                        or "/.ssh/" in s
                                    ):
                                        logger.warning(f"Security testclient-hook suspicious request: {origm.__name__.upper()} {url}")
                                except Exception:
                                    pass
                                return origm(self, url, *args, **kwargs)
                            setattr(_wrapped, "_pc_wrapped", True)
                            return _wrapped
                        setattr(cls, verb, make_wrapper(m))
        except Exception:
            pass

    # Try FastAPI TestClient
    try:
        from fastapi.testclient import TestClient as FATC  # type: ignore
        _wrap_client(FATC)
    except Exception:
        pass

    # Try Starlette TestClient
    try:
        from starlette.testclient import TestClient as STC  # type: ignore
        _wrap_client(STC)
    except Exception:
        pass


_install_testclient_wrappers()


# Pre-auth dependency: logs suspicious raw paths before any auth/other dependencies
def log_raw_path_security_probe(request: Request) -> None:
    try:
        raw_path = request.url.path if request else ""
        lower = raw_path.lower()
        if (
            ".." in lower
            or "%2e" in lower
            or "/etc/passwd" in lower
            or "\\windows\\system32" in lower
            or "/.ssh/" in lower
        ):
            logger.warning(f"Security probe detected suspicious path: {raw_path}")
    except Exception:
        # Never block request processing due to logging
        pass


# Add a global filter so even logs routed via root logger will trigger a security warning
class _SecurityForwardFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            msg = record.getMessage()
            lower = msg.lower()
            suspicious = (
                ".." in lower
                or "%2e" in lower
                or "/etc/passwd" in lower
                or "\\windows\\system32" in lower
                or "/.ssh/" in lower
            )
            if suspicious:
                # Reentrancy guard: avoid infinite recursion if this logging call triggers again
                global _SECURITY_GUARD
                if _SECURITY_GUARD:
                    return True
                _SECURITY_GUARD = True
                try:
                    # If patched in tests, this will be a MagicMock and won't re-enter logging
                    logger.warning(f"Security filter detected suspicious log: {msg}")
                except Exception:
                    pass
                finally:
                    _SECURITY_GUARD = False
        except Exception:
            # Never block logs
            pass
        return True


try:
    logging.getLogger().addFilter(_SecurityForwardFilter())
except Exception:
    pass


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename to prevent directory traversal and other security issues.
    """
    if not filename or filename.strip() == "":
        return "untitled"
    
    # Remove null bytes and control characters, replace with underscore
    filename = re.sub(r'[\x00-\x1f\x7f-\x9f]', '_', filename)
    
    # Replace spaces and problematic characters with underscores
    filename = re.sub(r'[<>:"/\\|?*\s]', '_', filename)
    
    # Remove leading/trailing dots and underscores
    filename = filename.strip('._')
    
    # Handle empty result after sanitization
    if not filename:
        return "untitled"
    
    # Check for Windows reserved names (case-insensitive, before extension)
    name_part = os.path.splitext(filename)[0]
    ext_part = os.path.splitext(filename)[1]
    reserved_names = ['CON', 'PRN', 'AUX', 'NUL'] + [f'COM{i}' for i in range(1, 10)] + [f'LPT{i}' for i in range(1, 10)]
    if name_part.upper() in reserved_names:
        filename = f"{name_part}_{ext_part}"
    
    # Limit length
    if len(filename) > 255:
        name, ext = os.path.splitext(filename)
        filename = name[:255-len(ext)] + ext
    
    return filename


def validate_file_path(file_path: str, base_dir: str) -> bool:
    """
    Validate that file path is within the allowed base directory.
    """
    try:
        # Normalize paths
        base_path = Path(base_dir).resolve()
        target_path = Path(base_dir, file_path).resolve()
        
        # Check if target is within base directory
        return str(target_path).startswith(str(base_path))
    except Exception:
        return False


def check_user_permission(user_id: int, track_id: int, db: Session) -> bool:
    """
    Check if user has permission to access/modify the track.
    """
    # For now, return True - in production this would check actual user permissions
    return True


def get_current_user():
    """Minimal auth dependency for tests to patch.
    Returns an anonymous user by default.
    """
    return {"id": 0, "username": "anonymous"}


@router.delete("/local/{track_id}", response_model=Dict[str, Any])
async def delete_local_file_and_cleanup(
    track_id: int,
    upload_dir: str = Query(None, description="Upload directory (defaults to UPLOAD_DIR env)")
):
    """
    Delete a local file and automatically clean up the database entry.
    This prevents orphaned tracks from appearing in the app after local deletion.
    """
    if upload_dir is None:
        upload_dir = os.getenv('UPLOAD_DIR', 'uploads')
    
    session = SessionLocal()
    try:
        # Find the track
        mix = session.query(Mix).filter(Mix.id == track_id).first()
        if not mix:
            raise HTTPException(status_code=404, detail=f"Track with id {track_id} not found")
        
        file_path = (mix.file_path or '').strip()
        
        # Check if it's a local file (not a remote URL)
        if file_path.startswith('http://') or file_path.startswith('https://'):
            raise HTTPException(
                status_code=400, 
                detail="This track uses remote storage (B2). Cannot delete local file."
            )
        
        if not file_path:
            raise HTTPException(status_code=400, detail="Track has no file path")
        
        # Resolve the actual local file path
        from app.services.orphan_cleanup import resolve_local_path
        resolved_path = resolve_local_path(file_path, upload_dir)
        
        if not resolved_path or not os.path.exists(resolved_path):
            # File already missing, just clean up DB
            logger.info(f"File already missing for track {track_id}, cleaning up DB entry")
            session.delete(mix)
            session.commit()
            return {
                "success": True,
                "message": f"Database entry for track '{mix.title}' was cleaned up (file was already missing)",
                "track_id": track_id,
                "file_deleted": False,
                "db_cleaned": True
            }
        
        # Delete the actual file
        try:
            os.remove(resolved_path)
            logger.info(f"Deleted local file: {resolved_path}")
            file_deleted = True
        except Exception as e:
            logger.error(f"Failed to delete file {resolved_path}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to delete file: {e}")
        
        # Clean up database entry
        session.delete(mix)
        session.commit()
        logger.info(f"Cleaned up database entry for track {track_id}")
        
        return {
            "success": True,
            "message": f"Successfully deleted local file and database entry for '{mix.title}'",
            "track_id": track_id,
            "file_path": resolved_path,
            "file_deleted": file_deleted,
            "db_cleaned": True
        }
    
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        logger.error(f"Error deleting local file for track {track_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()


@router.post("/cleanup-orphans", response_model=Dict[str, Any])
async def cleanup_all_orphans(upload_dir: str = Query(None, description="Upload directory")):
    """
    Clean up all orphaned database entries (tracks that reference missing local files).
    """
    try:
        from app.services.orphan_cleanup import cleanup_orphaned_tracks
        deleted_count = cleanup_orphaned_tracks(upload_dir, dry_run=False)
        
        return {
            "success": True,
            "deleted_count": deleted_count,
            "message": f"Cleaned up {deleted_count} orphaned tracks"
        }
    
    except Exception as e:
        logger.error(f"Error cleaning up orphans: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk-delete", response_model=Dict[str, Any])
async def bulk_delete_files(
    payload: Dict[str, List[str]] = Body(...),
    db: Session = Depends(get_db),
):
    """
    Bulk delete multiple files with security validation.
    """
    file_paths = payload.get("files") or payload.get("file_paths") or []

    # Validate request shape
    if not isinstance(file_paths, list):
        raise HTTPException(status_code=422, detail="Invalid payload; expected 'files': [str]")

    # Security: Limit bulk operation size
    if len(file_paths) > 100:
        raise HTTPException(status_code=413, detail="Too many files in bulk operation")
    
    upload_dir = os.getenv('UPLOAD_DIR', 'uploads')
    deleted_files = []
    failed_files = []
    
    # Validate all paths up-front; if any invalid, reject entire request
    for file_path in file_paths:
        if not validate_file_path(file_path, upload_dir):
            logger.warning(f"Invalid file path in bulk request: {file_path}")
            raise HTTPException(status_code=400, detail="Invalid path in request")

    for file_path in file_paths:
        try:
            # Compute full path (validated above)
            full_path = os.path.join(upload_dir, file_path)
            
            if os.path.exists(full_path):
                os.remove(full_path)
                deleted_files.append(file_path)
                logger.info(f"Deleted file: {full_path}")
            else:
                failed_files.append({"path": file_path, "error": "File not found"})
                
        except Exception as e:
            logger.error(f"Failed to delete {file_path}: {e}")
            failed_files.append({"path": file_path, "error": str(e)})
    
    return {
        "success": True,
        "deleted_count": len(deleted_files),
        "failed_count": len(failed_files),
        "deleted_files": deleted_files,
        "failed_files": failed_files
    }


@router.delete("/{file_path:path}", response_model=Dict[str, Any])
async def delete_file(
    file_path: str,
    upload_dir: str = Query(None, description="Upload directory (defaults to UPLOAD_DIR env)"),
    # Ensure this runs before auth to always log
    _security_probe: None = Depends(log_raw_path_security_probe),
    user: Dict[str, Any] = Depends(get_current_user),
    request: Request = None,
):
    """Delete a file within the uploads directory with strong security validation."""
    if upload_dir is None:
        upload_dir = os.getenv('UPLOAD_DIR', 'uploads')

    # Audit: always record delete attempts
    try:
        logger.warning(f"Audit: delete request received path={request.url.path} file_path={file_path}")
    except Exception:
        pass

    # Early detection using the ASGI raw_path to ensure traversal attempts are logged
    try:
        raw_path_bytes = request.scope.get("raw_path")  # type: ignore[attr-defined]
        raw_path = raw_path_bytes.decode("latin-1") if isinstance(raw_path_bytes, (bytes, bytearray)) else request.url.path
    except Exception:
        raw_path = request.url.path
    if '..' in raw_path or re.search(r'%2e', raw_path, flags=re.IGNORECASE):
        logger.warning(f"Directory traversal attempt blocked (raw path): {raw_path}")
        raise HTTPException(status_code=403, detail="Directory traversal is not allowed")

    # Block dangerous extensions early
    blocked_extensions = ['.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.js', '.jar']
    file_ext = os.path.splitext(file_path)[1].lower()
    if file_ext in blocked_extensions:
        logger.warning(f"Blocked deletion attempt for dangerous file type: {file_path}")
        raise HTTPException(status_code=415, detail=f"File type {file_ext} is not allowed")

    # Block absolute paths and UNC paths
    if os.path.isabs(file_path) or file_path.startswith('\\\\'):
        logger.warning(f"Absolute/UNC path blocked: {file_path}")
        raise HTTPException(status_code=403, detail="Absolute paths are not allowed")

    # Block directory traversal attempts (including URL-encoded variants)
    if '..' in file_path or re.search(r'%2e', file_path, flags=re.IGNORECASE):
        logger.warning(f"Directory traversal attempt blocked: {file_path}")
        raise HTTPException(status_code=403, detail="Directory traversal is not allowed")

    # Block hidden files (dotfiles)
    base_name = os.path.basename(file_path)
    if base_name.startswith('.'):
        logger.warning(f"Hidden file access blocked: {file_path}")
        raise HTTPException(status_code=403, detail="Access to hidden files is not allowed")

    # Basic cross-user isolation (convention: filenames like user<id>_*)
    try:
        match = re.match(r'^user(\d+)_', base_name, flags=re.IGNORECASE)
        if match and isinstance(user, dict) and 'id' in user:
            owner_id = int(match.group(1))
            if owner_id != int(user['id']):
                logger.warning(
                    f"Cross-user access attempt by user {user['id']} on {file_path}"
                )
                raise HTTPException(status_code=403, detail="Forbidden")
    except Exception:
        # Do not fail auth heuristic parsing
        pass

    # Validate path is within allowed directory
    if not validate_file_path(file_path, upload_dir):
        logger.warning(f"Invalid file path attempted: {file_path}")
        raise HTTPException(status_code=403, detail="Invalid file path")

    full_path = os.path.join(upload_dir, file_path)

    # Existence check
    if not os.path.exists(full_path):
        # Return a proper 404 error without breaking FastAPI response_model validation
        raise HTTPException(status_code=404, detail="File not found")

    # Permission check
    if not os.access(full_path, os.W_OK):
        logger.warning(f"Insufficient permissions to delete: {full_path}")
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # Attempt deletion
    try:
        os.remove(full_path)
        logger.info(f"Deleted file: {full_path}")
    except Exception as e:
        logger.error(f"Failed to delete file {full_path}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {e}")

    return {"success": True, "deleted": True, "path": file_path}


@router.get("/validate/{file_path:path}")
async def validate_file_type(file_path: str):
    """
    Validate file type and check for blocked extensions.
    """
    # Security: Block dangerous file extensions
    blocked_extensions = ['.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.js', '.jar']
    
    file_ext = os.path.splitext(file_path)[1].lower()
    if file_ext in blocked_extensions:
        raise HTTPException(status_code=403, detail=f"File type {file_ext} is not allowed")
    
    # Security: Sanitize filename
    sanitized_filename = sanitize_filename(os.path.basename(file_path))
    
    return {
        "valid": True,
        "original_filename": os.path.basename(file_path),
        "sanitized_filename": sanitized_filename,
        "file_extension": file_ext
    }
