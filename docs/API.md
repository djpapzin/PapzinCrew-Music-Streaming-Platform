# API Reference Index

Owner: DJ Papzin  
Last updated: 2025-08-23

This is a practical index. For full schemas, use FastAPI docs:
- Swagger UI: `GET /docs`
- OpenAPI JSON: `GET /openapi.json`

## Base URLs
- Local dev: `http://127.0.0.1:8000`
- Production: `https://papzincrew-backend.onrender.com`

## Endpoints (representative)

- Upload
  - `POST /upload` — multipart form (audio file + fields). Validates type/size, B2-first storage, metadata extraction.
  - `POST /upload/check-duplicate` — optional preflight; returns 409 on duplicate with `duplicate_info`.

- Library
  - `GET /tracks` — list mixes (newest first). Supports pagination (see FastAPI docs for params if present).
  - `GET /tracks/search?q=...` — baseline text search by title/artist/tags.
  - `GET /tracks/{id}` — optional read if implemented; otherwise list + search provide main access.

- Playback
  - `GET /tracks/{id}/stream` — resolves to B2 URL or proxies local file. Supports `HEAD` (expect 200/206) for reachability checks.
  - `GET /tracks/{id}/download` — enforces availability/privacy; increments `download_count` for remote or local.
  - `GET /tracks/{id}/stats` — returns `play_count` and `download_count`.

- Admin
  - `DELETE /admin/tracks/{id}` — delete a mix and cascade `TracklistItem`s. Permission-guarded.

## Response and Errors
- Structured validation errors include `error_code` (e.g., `unsupported_file_type`, `file_too_large`, `duplicate_track`).
- Upload success includes storage info (B2 vs local) and track metadata payload.

## Where to look in code
- Uploads: `backend/app/routers/uploads.py`
- Tracks (stream/download/search/stats): `backend/app/routers/tracks.py`
- Models/Schemas: `backend/app/models/models.py` (+ Pydantic schemas under `backend/app/`)

## Testing Notes
- HEAD is used in E2E tests for `/tracks/{id}/stream` to avoid big downloads.
- B2-first behavior is covered by unit tests and retries/backoff; local fallback only when configured/allowed.
