from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import os
import logging
import httpx

from .. import schemas, crud
from ..db.database import get_db
from ..services.b2_storage import B2Storage

router = APIRouter(prefix="/tracks", tags=["tracks"])
logger = logging.getLogger(__name__)

@router.get("/", response_model=List[schemas.Mix])
def read_tracks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Retrieve all tracks with pagination.
    """
    tracks = crud.get_mixes(db, skip=skip, limit=limit)
    return tracks

@router.get("/{track_id}", response_model=schemas.Mix)
def read_track(track_id: int, db: Session = Depends(get_db)):
    """
    Get a specific track by ID.
    """
    db_track = crud.get_mix(db, mix_id=track_id)
    if db_track is None:
        raise HTTPException(status_code=404, detail="Track not found")
    return db_track

@router.get("/{track_id}/stream")
async def stream_track(track_id: int, db: Session = Depends(get_db)):
    """
    Stream audio for a specific track.
    """
    db_track = crud.get_mix(db, mix_id=track_id)
    if db_track is None:
        raise HTTPException(status_code=404, detail="Track not found")

    file_path = (db_track.file_path or "").strip()
    if not file_path:
        raise HTTPException(status_code=404, detail="Audio file not found")

    # If the stored path is a public URL (e.g., B2), redirect the client
    if file_path.startswith("http://") or file_path.startswith("https://"):
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=file_path, status_code=307)
    
    # Normalize relative upload paths and Windows backslashes
    # Attempt to resolve the file on disk and, if it's within UPLOAD_DIR, redirect to /uploads/<relpath>
    from fastapi.responses import RedirectResponse, FileResponse
    import mimetypes
    import re
    
    norm_path = file_path.replace("\\", "/")
    upload_dir = os.getenv("UPLOAD_DIR", "uploads")
    candidates = []
    
    # Original path as-is (may be absolute or relative)
    candidates.append(file_path)
    
    # If the path appears to be under /uploads or uploads, join to UPLOAD_DIR
    if norm_path.startswith("/uploads/"):
        rel = norm_path.split("/uploads/", 1)[1]
        candidates.append(os.path.join(upload_dir, rel))
    if norm_path.startswith("uploads/"):
        rel = norm_path.split("uploads/", 1)[1]
        candidates.append(os.path.join(upload_dir, rel))
    
    # Also try just basenames inside UPLOAD_DIR (covers cases where only filename was stored)
    candidates.append(os.path.join(upload_dir, os.path.basename(norm_path)))
    
    resolved_path = None
    for p in candidates:
        try:
            if p and os.path.exists(p):
                resolved_path = p
                break
        except Exception:
            # Ignore invalid paths and continue
            pass
    
    # Fallback: if a numbered variant like *_1.mp3 is missing but *_3.mp3 exists, pick the highest-numbered match
    if not resolved_path:
        base_name = os.path.basename(norm_path)
        m = re.match(r"^(.+?)_(\d+)(\.[^\.]+)$", base_name)
        if m:
            prefix = m.group(1) + "_"
            ext = m.group(3)
            try:
                candidates2 = []
                for fname in os.listdir(upload_dir):
                    if fname.startswith(prefix) and fname.endswith(ext):
                        # ensure suffix is numeric
                        pattern = r"^.+?_(\d+)" + re.escape(ext) + r"$"
                        m2 = re.match(pattern, fname)
                        if m2:
                            try:
                                candidates2.append((int(m2.group(1)), fname))
                            except Exception:
                                pass
                if candidates2:
                    candidates2.sort(key=lambda x: x[0], reverse=True)
                    resolved_path = os.path.join(upload_dir, candidates2[0][1])
            except Exception:
                pass
    
    if not resolved_path:
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    # If the resolved path is inside the UPLOAD_DIR, redirect to the mounted static path for better range/caching
    try:
        # Compute a normalized absolute path for comparison
        abs_upload_dir = os.path.abspath(upload_dir)
        abs_resolved = os.path.abspath(resolved_path)
        if os.path.commonpath([abs_upload_dir, abs_resolved]) == abs_upload_dir:
            rel_to_uploads = os.path.relpath(abs_resolved, abs_upload_dir).replace("\\", "/")
            return RedirectResponse(url=f"/uploads/{rel_to_uploads}", status_code=307)
    except Exception:
        # Fallback to direct file response if any errors occur
        pass
    
    media_type = mimetypes.guess_type(resolved_path)[0] or "audio/mpeg"
    logger.info("stream_track: serving FileResponse for track %s -> %s (%s)", track_id, resolved_path, media_type)
    return FileResponse(path=resolved_path, media_type=media_type)


@router.post("/admin/repair-b2-urls")
async def repair_b2_urls(payload: Dict[str, Optional[object]] = None, db: Session = Depends(get_db)):
    """
    Attempt to repair broken remote (B2) URLs by locating hashed variants in the bucket.
    Body JSON:
      { "mode": "dry-run"|"commit", "ids": [int,...] (optional) }
    - dry-run: report proposed changes without modifying DB
    - commit: update Mix.file_path to the best-matching hashed object URL
    Only considers remote http(s) file_path entries returning 404 on HEAD.
    """
    payload = payload or {}
    mode = str(payload.get("mode") or "dry-run").lower()
    ids = payload.get("ids")
    if ids is not None and not isinstance(ids, list):
        raise HTTPException(status_code=400, detail="ids must be a list of integers")

    b2 = B2Storage()
    if not b2.is_configured():
        raise HTTPException(status_code=400, detail="B2 storage not configured")

    mixes = crud.get_mixes(db, skip=0, limit=10000)
    target_mixes = [m for m in mixes if (not ids or m.id in ids)]

    results: List[Dict[str, Any]] = []

    async with httpx.AsyncClient(follow_redirects=True, timeout=10) as client:
        for m in target_mixes:
            url = (m.file_path or "").strip()
            if not url or not (url.startswith("http://") or url.startswith("https://")):
                results.append({"id": m.id, "action": "skip_non_remote"})
                continue

            # Check if remote is broken via HEAD
            status_code: Optional[int] = None
            try:
                resp = await client.head(url)
                status_code = resp.status_code
            except Exception as e:
                results.append({"id": m.id, "action": "head_error", "error": str(e)})
                continue

            if status_code in (200, 204, 206):
                results.append({"id": m.id, "action": "skip_ok", "status": status_code})
                continue
            if status_code and status_code != 404:
                results.append({"id": m.id, "action": "skip_status", "status": status_code})
                continue

            # Derive key and search for hashed variant: audio/<name>-<hash>.<ext>
            key = b2.extract_key_from_url(url) or ""
            if "/" in key:
                dir_prefix, name_ext = key.rsplit("/", 1)
                dir_prefix += "/"
            else:
                dir_prefix, name_ext = "audio/", key
            if "." in name_ext:
                name_stem, ext = name_ext.rsplit(".", 1)
                ext = "." + ext
            else:
                name_stem, ext = name_ext, ""

            search_prefix = f"{dir_prefix}{name_stem}-"
            listed = b2.list_objects(prefix=search_prefix)
            if not listed.get("ok"):
                results.append({"id": m.id, "action": "list_error", "error": listed.get("error")})
                continue

            candidates = [it for it in listed.get("items", []) if not ext or str(it.get("Key", "")).endswith(ext)]
            if not candidates:
                results.append({"id": m.id, "action": "no_match", "searched_prefix": search_prefix})
                continue

            # Choose most recent LastModified if available
            def sort_key(it: Dict[str, Any]):
                lm = it.get("LastModified")
                return (lm is not None, lm)
            candidates.sort(key=sort_key, reverse=True)
            best = candidates[0]
            new_key = str(best.get("Key"))
            new_url = b2.build_url(new_key)

            if not new_url:
                results.append({"id": m.id, "action": "build_url_failed", "key": new_key})
                continue

            # Verify existence explicitly
            if not b2.object_exists(new_key):
                results.append({"id": m.id, "action": "head_mismatch", "key": new_key})
                continue

            if mode != "commit":
                results.append({"id": m.id, "action": "would_update", "from": url, "to": new_url})
                continue

            # Commit
            try:
                m.file_path = new_url
                db.add(m)
                results.append({"id": m.id, "action": "updated", "to": new_url})
            except Exception as e:
                results.append({"id": m.id, "action": "db_error", "error": str(e)})

    if mode == "commit":
        try:
            db.commit()
        except Exception as e:
            logger.error("repair_b2_urls: DB commit failed: %s", e)
            raise HTTPException(status_code=500, detail="DB commit failed")

    return {"mode": mode, "results": results}


@router.post("/admin/set-file-path")
async def set_file_path(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """
    Set a specific track's file_path.
    Body JSON: { "id": <int>, "file_path": <string> }
    """
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid payload")
    if "id" not in payload or "file_path" not in payload:
        raise HTTPException(status_code=400, detail="id and file_path are required")
    try:
        track_id = int(payload["id"])
    except Exception:
        raise HTTPException(status_code=400, detail="id must be an integer")
    file_path = str(payload["file_path"] or "").strip()
    if not file_path:
        raise HTTPException(status_code=400, detail="file_path must be a non-empty string")

    db_track = crud.get_mix(db, mix_id=track_id)
    if not db_track:
        raise HTTPException(status_code=404, detail="Track not found")

    try:
        db_track.file_path = file_path
        db.add(db_track)
        db.commit()
        db.refresh(db_track)
    except Exception as e:
        logger.error("set_file_path: DB update failed: %s", e)
        raise HTTPException(status_code=500, detail="DB update failed")

    return {"id": track_id, "file_path": db_track.file_path}

@router.get("/admin/audit")
async def audit_tracks(skip: int = 0, limit: int = 200, db: Session = Depends(get_db)):
    """
    Audit mixes to find missing/broken file paths.
    For http(s) file_path: perform a HEAD to check reachability.
    For local file_path: attempt to resolve using the same logic as the stream endpoint.
    """
    mixes = crud.get_mixes(db, skip=skip, limit=limit)
    results: List[Dict] = []

    for m in mixes:
        track_id = m.id
        file_path = (m.file_path or "").strip()
        item: Dict[str, Optional[str]] = {
            "id": track_id,
            "title": getattr(m, "title", None),
            "file_path": file_path,
            "kind": None,
            "ok": False,
            "status": None,
            "details": None,
        }

        if not file_path:
            item.update({"kind": "missing", "status": "missing_path", "ok": False})
            results.append(item)
            continue

        if file_path.startswith("http://") or file_path.startswith("https://"):
            item["kind"] = "remote"
            try:
                async with httpx.AsyncClient(follow_redirects=True, timeout=10) as client:
                    resp = await client.head(file_path)
                if resp.status_code in (200, 204, 206):
                    item.update({"ok": True, "status": f"{resp.status_code}"})
                else:
                    item.update({
                        "ok": False,
                        "status": f"{resp.status_code}",
                        "details": resp.headers.get("x-bz-info-src_last_modified_millis")
                    })
            except Exception as e:
                item.update({"ok": False, "status": "error", "details": str(e)})
            results.append(item)
            continue

        # Local path audit: replicate resolution approach
        import re
        norm_path = file_path.replace("\\", "/")
        upload_dir = os.getenv("UPLOAD_DIR", "uploads")
        candidates = [file_path]
        if norm_path.startswith("/uploads/"):
            rel = norm_path.split("/uploads/", 1)[1]
            candidates.append(os.path.join(upload_dir, rel))
        if norm_path.startswith("uploads/"):
            rel = norm_path.split("uploads/", 1)[1]
            candidates.append(os.path.join(upload_dir, rel))
        candidates.append(os.path.join(upload_dir, os.path.basename(norm_path)))

        resolved_path: Optional[str] = None
        try:
            for p in candidates:
                if p and os.path.exists(p):
                    resolved_path = p
                    break
        except Exception:
            resolved_path = None

        if not resolved_path:
            base_name = os.path.basename(norm_path)
            m2 = re.match(r"^(.+?)_(\d+)(\.[^\.]+)$", base_name)
            if m2:
                prefix = m2.group(1) + "_"
                ext = m2.group(3)
                try:
                    candidates2 = []
                    for fname in os.listdir(upload_dir):
                        if fname.startswith(prefix) and fname.endswith(ext):
                            m3 = re.match(r"^.+?_(\d+)" + re.escape(ext) + r"$", fname)
                            if m3:
                                try:
                                    candidates2.append((int(m3.group(1)), fname))
                                except Exception:
                                    pass
                    if candidates2:
                        candidates2.sort(key=lambda x: x[0], reverse=True)
                        resolved_path = os.path.join(upload_dir, candidates2[0][1])
                except Exception:
                    pass

        if resolved_path and os.path.exists(resolved_path):
            item.update({"kind": "local", "ok": True, "status": "exists", "details": resolved_path})
        else:
            item.update({"kind": "local", "ok": False, "status": "not_found"})
        results.append(item)

    broken = [r for r in results if not r.get("ok")]
    return {"count": len(results), "broken_count": len(broken), "broken": broken, "items": results}


@router.post("/admin/cleanup-b2")
async def cleanup_b2(payload: Dict[str, Optional[object]] = None, db: Session = Depends(get_db)):
    """
    Delete broken remote (B2) audio objects.
    Body JSON:
      { "mode": "dry-run"|"delete", "ids": [int,...] (optional), "clear_db": bool (optional) }
    - dry-run: report what would be deleted
    - delete: perform deletion via B2 S3 API
    - clear_db: when deleting, also set mix.file_path = None for deleted items
    Only applies to remote http(s) file_path entries that return non-2xx/206 on HEAD.
    """
    payload = payload or {}
    mode = str(payload.get("mode") or "dry-run").lower()
    ids = payload.get("ids")
    if ids is not None and not isinstance(ids, list):
        raise HTTPException(status_code=400, detail="ids must be a list of integers")
    clear_db = bool(payload.get("clear_db") or False)

    query = crud.get_mixes(db, skip=0, limit=10000)
    mixes = [m for m in query if not ids or m.id in ids]

    b2 = B2Storage()
    results: List[Dict[str, object]] = []

    async with httpx.AsyncClient(follow_redirects=True, timeout=10) as client:
        for m in mixes:
            file_path = (m.file_path or "").strip()
            if not file_path or not (file_path.startswith("http://") or file_path.startswith("https://")):
                results.append({"id": m.id, "action": "skip_non_remote", "ok": False})
                continue

            status_code: Optional[int] = None
            error: Optional[str] = None
            try:
                resp = await client.head(file_path)
                status_code = resp.status_code
            except Exception as e:
                error = str(e)

            broken = (status_code is None) or (status_code >= 400)
            if not broken:
                results.append({"id": m.id, "action": "skip_ok", "status": status_code, "ok": True})
                continue

            # Broken remote
            action = "would_delete" if mode != "delete" else "delete"
            item: Dict[str, object] = {"id": m.id, "status": status_code, "error": error, "action": action}

            if mode == "delete":
                if not b2.is_configured():
                    item.update({"deleted": False, "reason": "b2_not_configured"})
                else:
                    key = b2.extract_key_from_url(file_path)
                    if not key:
                        item.update({"deleted": False, "reason": "could_not_extract_key"})
                    else:
                        ok = b2.delete_file(key)
                        item.update({"deleted": ok, "key": key})
                        if ok and clear_db:
                            try:
                                m.file_path = None
                                db.add(m)
                            except Exception as e:
                                item.update({"db_clear_error": str(e)})
            results.append(item)

    if mode == "delete" and clear_db:
        try:
            db.commit()
        except Exception as e:
            logger.error("cleanup_b2: DB commit failed: %s", e)
            raise HTTPException(status_code=500, detail="DB commit failed")

    deleted_count = sum(1 for r in results if r.get("action") == "delete" and r.get("deleted") is True)
    would_delete_count = sum(1 for r in results if r.get("action") == "would_delete")
    return {"mode": mode, "count": len(mixes), "deleted": deleted_count, "would_delete": would_delete_count, "results": results}


@router.api_route("/{track_id}/stream/proxy", methods=["GET", "HEAD"])
async def proxy_stream_track(track_id: int, request: Request, db: Session = Depends(get_db)):
    """
    Proxy the audio stream to avoid CORS and support Range requests for remote (B2) URLs.
    Local files fall back to FileResponse/redirect as usual.
    """
    db_track = crud.get_mix(db, mix_id=track_id)
    if db_track is None:
        raise HTTPException(status_code=404, detail="Track not found")

    file_path = (db_track.file_path or "").strip()
    if not file_path:
        raise HTTPException(status_code=404, detail="Audio file not found")

    if file_path.startswith("http://") or file_path.startswith("https://"):
        # Proxy from remote (e.g., B2)
        upstream_headers = {}
        range_header = request.headers.get("range")
        if range_header:
            upstream_headers["Range"] = range_header
        # Avoid gzip/deflate for byte-accurate range streaming
        upstream_headers["Accept-Encoding"] = "identity"

        # Build final response headers based on an upstream HEAD request so we can set
        # correct headers before streaming the body.
        head_timeout = httpx.Timeout(15.0, connect=10.0, read=15.0, write=15.0, pool=15.0)
        async with httpx.AsyncClient(follow_redirects=True, timeout=head_timeout) as head_client:
            head_headers = {k: v for k, v in upstream_headers.items()}
            # For HEAD we'll still forward Range if provided to get Content-Range when upstream supports it
            head_resp = await head_client.head(file_path, headers=head_headers)
            if head_resp.status_code in (401, 403, 404, 416):
                raise HTTPException(status_code=head_resp.status_code, detail=f"Upstream returned {head_resp.status_code}")
            if head_resp.status_code not in (200, 206):
                raise HTTPException(status_code=502, detail=f"Upstream returned {head_resp.status_code}")

            # Start constructing headers
            import mimetypes
            guessed_ct = mimetypes.guess_type(file_path)[0]
            upstream_ct = (head_resp.headers.get("Content-Type") or "").lower()
            media_type = upstream_ct or guessed_ct or "audio/mpeg"
            if upstream_ct in ("", "application/octet-stream") and guessed_ct:
                media_type = guessed_ct

            resp_headers: Dict[str, str] = {}
            # Accept ranges by default
            resp_headers["Accept-Ranges"] = "bytes"
            # Pass through some caching headers
            for h in ("ETag", "Cache-Control"):
                v = head_resp.headers.get(h)
                if v:
                    resp_headers[h] = v

            total_length_header = head_resp.headers.get("Content-Length")
            total_size: Optional[int] = int(total_length_header) if total_length_header and total_length_header.isdigit() else None

            # Determine status and range headers if client asked for Range
            status_code = 200
            range_header = request.headers.get("range")
            if range_header and total_size is not None:
                # parse form: bytes=start-end
                try:
                    unit, rng = range_header.split("=", 1)
                    if unit.strip().lower() == "bytes" and "-" in rng:
                        start_s, end_s = rng.split("-", 1)
                        start = int(start_s) if start_s else 0
                        end = int(end_s) if end_s else total_size - 1
                        if start > end or start >= total_size:
                            raise HTTPException(status_code=416, detail="Requested Range Not Satisfiable")
                        part_len = end - start + 1
                        resp_headers["Content-Range"] = f"bytes {start}-{end}/{total_size}"
                        resp_headers["Content-Length"] = str(part_len)
                        status_code = 206
                except Exception:
                    # If parsing fails, fall back to 200 without content-range
                    pass
            else:
                # Full response: if we know total size, include it
                if total_size is not None:
                    resp_headers["Content-Length"] = str(total_size)

            # Add permissive CORS for local dev playback and expose range-related headers
            resp_headers["Access-Control-Allow-Origin"] = os.getenv("DEV_CORS_ORIGIN", "*")
            resp_headers["Access-Control-Expose-Headers"] = "Content-Range, Accept-Ranges, Content-Length"
            resp_headers["Vary"] = "Origin, Range"
            resp_headers["X-Accel-Buffering"] = "no"

        if request.method.upper() == "HEAD":
            return Response(status_code=status_code, headers=resp_headers)

        # Stream the body within the generator so the upstream context lives as long as the stream.
        async def body_iter() -> Any:
            stream_timeout = httpx.Timeout(None, connect=10.0, read=None, write=None, pool=None)
            async with httpx.AsyncClient(follow_redirects=True, timeout=stream_timeout) as client:
                async with client.stream("GET", file_path, headers=upstream_headers) as upstream:
                    if upstream.status_code not in (200, 206):
                        status = upstream.status_code
                        if status in (401, 403, 404, 416):
                            raise HTTPException(status_code=status, detail=f"Upstream returned {status}")
                        raise HTTPException(status_code=502, detail=f"Upstream returned {status}")
                    async for chunk in upstream.aiter_bytes(65536):
                        yield chunk

        return StreamingResponse(body_iter(), status_code=status_code, media_type=media_type, headers=resp_headers)

    # Local path fallback mirrors stream endpoint
    from fastapi.responses import RedirectResponse, FileResponse
    import mimetypes
    import re

    norm_path = file_path.replace("\\", "/")
    upload_dir = os.getenv("UPLOAD_DIR", "uploads")
    candidates = [file_path]
    if norm_path.startswith("/uploads/"):
        rel = norm_path.split("/uploads/", 1)[1]
        candidates.append(os.path.join(upload_dir, rel))
    if norm_path.startswith("uploads/"):
        rel = norm_path.split("uploads/", 1)[1]
        candidates.append(os.path.join(upload_dir, rel))
    candidates.append(os.path.join(upload_dir, os.path.basename(norm_path)))

    resolved_path = None
    for p in candidates:
        try:
            if p and os.path.exists(p):
                resolved_path = p
                break
        except Exception:
            pass

    if not resolved_path:
        base_name = os.path.basename(norm_path)
        m = re.match(r"^(.+?)_(\d+)(\.[^\.]+)$", base_name)
        if m:
            prefix = m.group(1) + "_"
            ext = m.group(3)
            try:
                candidates2 = []
                for fname in os.listdir(upload_dir):
                    if fname.startswith(prefix) and fname.endswith(ext):
                        pattern = r"^.+?_(\d+)" + re.escape(ext) + r"$"
                        m2 = re.match(pattern, fname)
                        if m2:
                            try:
                                candidates2.append((int(m2.group(1)), fname))
                            except Exception:
                                pass
                if candidates2:
                    candidates2.sort(key=lambda x: x[0], reverse=True)
                    resolved_path = os.path.join(upload_dir, candidates2[0][1])
            except Exception:
                pass

    if not resolved_path:
        raise HTTPException(status_code=404, detail="Audio file not found")

    try:
        abs_upload_dir = os.path.abspath(upload_dir)
        abs_resolved = os.path.abspath(resolved_path)
        if os.path.commonpath([abs_upload_dir, abs_resolved]) == abs_upload_dir:
            rel_to_uploads = os.path.relpath(abs_resolved, abs_upload_dir).replace("\\", "/")
            return RedirectResponse(url=f"/uploads/{rel_to_uploads}", status_code=307)
    except Exception:
        pass

    media_type = mimetypes.guess_type(resolved_path)[0] or "audio/mpeg"
    return FileResponse(path=resolved_path, media_type=media_type)
