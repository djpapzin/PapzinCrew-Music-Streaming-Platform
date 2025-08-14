# PapzinCrew Music Streaming Platform - Quick Start Guide

## 🚀 Live Platform
- Frontend: https://papzincrew.netlify.app/
- Backend: https://papzincrew-backend.onrender.com/ (health: `/health`)

## 🧪 Local Development
### Prereqs
- Python 3.11+
- Node.js 18+

### Start Backend (FastAPI)
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
uvicorn app.main:app --reload  # http://127.0.0.1:8000
```

### Start Frontend (Vite + React)
```bash
# From repo root
cd frontend/project
npm install
# Optional: set API URL for local backend
# echo "VITE_API_URL=http://127.0.0.1:8000" > .env
npm run dev  # http://localhost:5173
```

## 🔐 Environment
Create `backend/.env` as needed:
```
# Database (omit for local SQLite dev)
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME

# Backblaze B2 (omit to use local storage fallback)
B2_ACCESS_KEY_ID=...
B2_SECRET_ACCESS_KEY=...
B2_BUCKET=papzincrew-music-djpapzin

# CORS
ALLOWED_ORIGINS=https://papzincrew.netlify.app,http://localhost:5173,http://127.0.0.1:5173
# ALLOWED_ORIGIN_REGEX=  # optional

# Logging
LOG_LEVEL=INFO
ENABLE_UPLOAD_PRINTS=0
```
Optional `frontend/project/.env`:
```
VITE_API_URL=http://127.0.0.1:8000
```

## ⬆️ Upload Flow
- Validates type/size, parses metadata via Mutagen (max ~100MB).
- Progress phases: upload → processing → cover art.
- Duplicate detection with optional forced upload; backend returns structured `error_code`s.
- Storage: B2-first; local filesystem fallback when B2 unset/unavailable.

## ☁️ Production Deployment
This repo includes a Render Blueprint: `render.yaml`.

### Backend on Render
1. In Render: New → Blueprint → connect this repo.
2. Render creates:
   - PostgreSQL DB (persistent)
   - Web Service for FastAPI backend
3. Verify environment on the backend service:
   - DATABASE_URL (auto from Render Postgres)
   - B2_ACCESS_KEY_ID, B2_SECRET_ACCESS_KEY, B2_BUCKET
   - ALLOWED_ORIGINS must include `https://papzincrew.netlify.app`
4. Deploy. Health check: `GET /health` should return OK.

### Frontend on Netlify
- Build command: `npm ci && npm run build`
- Publish directory: `frontend/project/dist`
- Environment: `VITE_API_URL=https://papzincrew-backend.onrender.com`

## ✅ Verify Persistence
- Upload a track via the live frontend.
- Confirm it plays.
- Redeploy/restart the backend in Render and refresh the frontend.
- The track should still be present (PostgreSQL-backed). If not, check `DATABASE_URL`.

## 🧪 Continuous Integration (CI)
- CI runs on pushes/PRs to `main`.
- Jobs:
  - Backend Tests (Python 3.11): runs `pytest -q` in `backend/`.
  - Frontend Build (Node 18): builds Vite app in `frontend/project/`.
- Local test quickstart:
  ```bash
  cd backend
  python -m venv venv
  venv/Scripts/activate  # Windows
  # source venv/bin/activate  # macOS/Linux
  pip install -r requirements.txt
  # Optional
  [ -f requirements-dev.txt ] && pip install -r requirements-dev.txt || pip install pytest pytest-cov
  pytest -q
  ```
- Notes:
  - Tests expecting B2 or external services may fail in CI. Mock or set safe env defaults.
  - Consider marking integration tests and skipping them in CI.

## 📜 View Render Logs from Terminal
- Render CLI (recommended):
  1) Install "Render CLI".
  2) `render services list` → find your backend service ID.
  3) Tail logs: `render logs --service <SERVICE_ID> -f`
- Render API: Use `RENDER_API_KEY` to fetch logs via HTTP and tail with a small script.
- Log drains: Configure a drain to a log platform (e.g., Better Stack) and use their CLI.

## 🧰 Troubleshooting
- CORS blocked: ensure `ALLOWED_ORIGINS` exactly matches frontend origin (no typos).
- Data loss after redeploy: using SQLite on Render’s ephemeral filesystem — switch to PostgreSQL.
- Upload rejected: check backend response `error_code` (`file_too_large`, `unsupported_file_extension`, `invalid_audio_file`, etc.).
- B2 errors: verify credentials and bucket name; local fallback will be used if unset.

Happy streaming! 🎶
