# Papzin & Crew — Documentation Index

Owner: DJ Papzin  
Last updated: 2025-08-23

## Start Here
- Product overview and scope: [PRD_PapzinCrew.md](PRD_PapzinCrew.md)
- Architecture overview: [Architecture.md](Architecture.md)
- API reference index: [API.md](API.md)
- Data model: [Data_Model.md](Data_Model.md)

## Common Tasks
- Upload flow details: [Upload_Flow.md](Upload_Flow.md)
- B2-first uploads (policy and health): [B2-first-uploads.md](B2-first-uploads.md)
- Backend logs and Render CLI: [logs.md](logs.md)

## Environments & Security
- Backend env: `backend/.env` (secrets only in env vars; never commit).
- CORS via `ALLOWED_ORIGINS` / optional `ALLOWED_ORIGIN_REGEX`.
- Storage is Backblaze B2-first by design; local is fallback only.

## Now / Next / Later
- Now
  - Keep B2-first uploads stable and monitored (timeouts/retries/backoff).
  - Ensure stream/download endpoints respond quickly (redirect or proxy).
- Next
  - Harden search relevance and add filters (genre/tags).
  - Expand unit/E2E tests around upload edge cases and streaming HEAD reachability.
- Later
  - Subscriptions (Premium/Pro), payment provider, 24/7 radio, ads system, request workflows.

## How To Explore the API
- Local dev: `uvicorn app.main:app --reload` → http://127.0.0.1:8000
- Swagger UI: `GET /docs`
- OpenAPI: `GET /openapi.json`

## Pointers to Code
- Uploads: `backend/app/routers/uploads.py` and `backend/app/services/b2_storage.py`
- Streaming/Download/Search/Stats: `backend/app/routers/tracks.py`
- Models: `backend/app/models/models.py` (`Mix`, `Artist`, `Category`, `TracklistItem`)
- Frontend upload UI: `frontend/project/src/components/UploadPage.tsx`

Notes for solo devs:
- Update docs in the same PR as feature changes.
- Keep env var matrix in one place; link here rather than duplicating.
- Use descriptive commit messages for future you.
