# Papzin & Crew - Music Streaming Platform
[![CI](https://github.com/djpapzin/PapzinCrew-Music-Streaming-Platform/actions/workflows/ci.yml/badge.svg)](https://github.com/djpapzin/PapzinCrew-Music-Streaming-Platform/actions/workflows/ci.yml)
[![Frontend](https://img.shields.io/website?down_message=offline&label=frontend&up_message=online&url=https%3A%2F%2Fpapzincrew.netlify.app%2F)](https://papzincrew.netlify.app/)
[![Backend health](https://img.shields.io/website?down_message=unhealthy&label=backend%20health&up_message=healthy&url=https%3A%2F%2Fpapzincrew-backend.onrender.com%2Fhealth)](https://papzincrew-backend.onrender.com/health)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)

## Live Platform
- Frontend: https://papzincrew.netlify.app/
- Backend: https://papzincrew-backend.onrender.com/ (health: `/health`)

## Logs
[Backend logs: quick reference](docs/logs.md)

## About The Project
Papzin & Crew connects independent artists and listeners. DJs and creators upload mixes/tracks; listeners discover, play, and share.

## Architecture
- Backend: FastAPI (Uvicorn) + SQLAlchemy + Alembic
- Database: PostgreSQL (production on Render). SQLite auto-used locally if DATABASE_URL is not set.
- Storage: Backblaze B2 for audio/cover art (local filesystem fallback for dev)
- Frontend: React (Vite + TypeScript + Tailwind)
- Hosting: Backend on Render, Frontend on Netlify

## Tech Stack
- Python 3.11, FastAPI, SQLAlchemy 2.x, Alembic, psycopg2-binary
- React 18, Vite, TypeScript, Tailwind CSS
- Backblaze B2 (boto3), Mutagen for metadata

## Getting Started (Local)
### Prerequisites
- Python 3.11+
- Node.js 18+

### Backend Setup
```bash
# From repo root
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
# source venv/bin/activate

pip install -r requirements.txt

# Optional: create backend/.env (see Environment)
uvicorn app.main:app --reload
# http://127.0.0.1:8000 (health: /health)
```

### Frontend Setup
```bash
# From repo root
cd frontend/project
npm install
# (Optional) create .env with: VITE_API_URL=http://127.0.0.1:8000
npm run dev
# http://localhost:5173
```

## Environment
Create `backend/.env` with any of the following as needed:
```
# Database (omit for local SQLite dev)
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME

# Backblaze B2 (omit to use local storage fallback)
B2_ACCESS_KEY_ID=...
B2_SECRET_ACCESS_KEY=...
B2_BUCKET=papzincrew-music-djpapzin

# CORS
ALLOWED_ORIGINS=https://papzincrew.netlify.app,http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173
# ALLOWED_ORIGIN_REGEX=  # optional

# Logging
LOG_LEVEL=INFO
ENABLE_UPLOAD_PRINTS=0
```
Frontend (optional) `frontend/project/.env`:
```
VITE_API_URL=http://127.0.0.1:8000
```

## Upload Flow Overview
- Validates file type/size; extracts metadata via Mutagen.
- Shows progress phases: file upload → processing → cover art.
- Duplicate detection with optional forced upload; structured error codes returned.
- B2-first storage; local fallback.

### Upload Behavior Details

• __Validation__
  - Max size: 100MB (frontend and backend aligned)
  - Type: validated by extension and Mutagen sniffing; backend responds with structured errors
  - Common error codes: `file_too_large`, `unsupported_file_type`, `invalid_audio_file` (may include `detected_type`)

• __Duplicate detection__
  - Pre-upload check via `POST /upload/check-duplicate` using title, artist, size, optional file hash and duration
  - On the main upload, backend may return HTTP 409 with `error_code: duplicate_track` and `duplicate_info`
  - Frontend can force upload by setting `skip_duplicate_check=true` in the multipart form data

• __Storage strategy (B2-first with local fallback)__
  - If B2 is configured: upload to B2 with retry/timeout
  - If B2 upload exhausts retries: fallback to local filesystem (unless disabled)
  - If B2 is not configured: save locally by default (dev/test)
  - If `ENFORCE_B2_ONLY=1` and B2 unavailable: return 503 (no local write)
  - Filenames are sanitized centrally via `sanitize_filename` and made unique before write

• __Cover art flow__
  1) User-provided image (if any)
  2) Extract embedded art from audio metadata
  3) AI-generated art fallback (with status polling). All use B2-first + local fallback

• __Relevant environment variables__
  - `UPLOAD_DIR` (default: `uploads`) – local fallback directory
  - `ENFORCE_B2_ONLY` (default: 0) – when true, disables local fallback
  - `B2_PUT_TIMEOUT`, `B2_MAX_RETRIES`, `B2_RETRY_BACKOFF` – control B2 upload behavior
  - `ENABLE_UPLOAD_PRINTS` – verbose upload logging

• __Security__
  - Centralized filename sanitization prevents traversal and reserved-name issues
  - Paths validated before local writes; secrets must be kept in environment variables

## Deployment
### Render (Backend)
- This repo includes `render.yaml` (Render Blueprint).
- Use Render Dashboard → New → Blueprint, connect this repo.
- Ensure env vars on the backend service:
  - DATABASE_URL (auto-wired from pg service in render.yaml)
  - B2_ACCESS_KEY_ID, B2_SECRET_ACCESS_KEY, B2_BUCKET
  - ALLOWED_ORIGINS must include https://papzincrew.netlify.app (watch for typos)

### Netlify (Frontend)
- Build command: `npm ci && npm run build`
- Publish directory: `frontend/project/dist`
- Environment: `VITE_API_URL=https://papzincrew-backend.onrender.com`

## Continuous Integration (CI)
- Jobs: Backend Tests (Python 3.11) and Frontend Build (Node 18).
- Status: see badge above or view workflow runs: https://github.com/djpapzin/PapzinCrew-Music-Streaming-Platform/actions/workflows/ci.yml
- Run backend tests locally:
  ```bash
  cd backend
  python -m venv venv
  # Windows
  venv/Scripts/activate
  # macOS/Linux
  # source venv/bin/activate
  pip install -r requirements.txt
  # if present
  [ -f requirements-dev.txt ] && pip install -r requirements-dev.txt || pip install pytest pytest-cov
  pytest -q
  ```
- Common CI failures:
  - Tests rely on external services (e.g., Backblaze B2). Mock or provide env vars in CI.
  - Missing env in CI (B2_*): tests expecting B2 may fail; adjust tests or set safe defaults.
  - Consider marking slow/integration tests with `@pytest.mark.integration` and skipping them in CI.

## Troubleshooting
- Disallowed CORS origin (400 on OPTIONS): fix `ALLOWED_ORIGINS` (e.g., `https://papzincrew.netlify.app`)
- Data loss on redeploy: ensure PostgreSQL is configured; avoid SQLite on Render’s ephemeral FS
- Upload errors: the backend returns structured errors with `error_code` for UI display

## License
MIT. See `LICENSE.md`.
