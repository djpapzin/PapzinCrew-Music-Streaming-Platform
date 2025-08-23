# Architecture Overview

Owner: DJ Papzin  
Last updated: 2025-08-23

## System Diagram

Frontend (Netlify, Vite/React)
    ↓ HTTP (CORS)
Backend (Render, FastAPI)
   ↙             ↘
PostgreSQL     Backblaze B2 (S3)
(Render)       (Audio + Cover Art)

Notes:
- Backend is stateless; assets live in B2; DB persists on Render Postgres.
- CORS is configured via env (`ALLOWED_ORIGINS`, optional `ALLOWED_ORIGIN_REGEX`).

## Key Flows

### Upload (B2-first)
1. Frontend validates file, shows phase progress (Upload → Processing → Cover Art).
2. Backend validates, checks duplicate, sanitizes filename.
3. Backend attempts B2 upload with retries/backoff (no local temp writes).
4. If B2 unavailable and fallback allowed, save to local; else return 503 when enforced.
5. Extract metadata and cover art; persist mix + artist to DB.

### Stream & Download
- Stream: resolve B2 URL or proxy local path; supports Range and HEAD for reachability.
- Download: enforces availability/privacy, increments `download_count`.
- Play counting occurs on streaming/reads (implementation-specific).

## Code Map
- Uploads: `backend/app/routers/uploads.py`
- Storage: `backend/app/services/b2_storage.py`
- Tracks (stream/search/download/stats): `backend/app/routers/tracks.py`
- Models: `backend/app/models/models.py`
- Frontend upload UI: `frontend/project/src/components/UploadPage.tsx`

## Operational Concerns
- Logging: structured logs for upload decisions, stream redirects/proxy, 404s.
- Health: add storage health endpoint if needed (B2 configured/ok/degraded).
- Security: filename sanitization and path validation; env-only secrets; strict CORS.

## Environments
- Local: SQLite if `DATABASE_URL` not set; optional B2 envs omitted → local fallback.
- Production: Render (backend + Postgres), Netlify (frontend), B2 (storage).
