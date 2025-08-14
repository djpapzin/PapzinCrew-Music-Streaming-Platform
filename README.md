# Papzin & Crew - Music Streaming Platform

## Live Platform
- Frontend: https://papzincrew.netlify.app/
- Backend: https://papzincrew-backend.onrender.com/ (health: `/health`)

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

## Troubleshooting
- Disallowed CORS origin (400 on OPTIONS): fix `ALLOWED_ORIGINS` (e.g., `https://papzincrew.netlify.app`)
- Data loss on redeploy: ensure PostgreSQL is configured; avoid SQLite on Render’s ephemeral FS
- Upload errors: the backend returns structured errors with `error_code` for UI display

## License
MIT. See `LICENSE.md`.
