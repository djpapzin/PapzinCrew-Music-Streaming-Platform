# PapzinCrew Music Streaming Platform - Quick Start Guide

## 🚀 Getting Started

This guide will help you quickly start both the backend and frontend servers for the PapzinCrew Music Streaming Platform with AI-assisted upload functionality.

## Prerequisites

- Python 3.8+ installed
- Node.js 16+ installed
- Git installed

## 🔧 Quick Start Commands

### 1. Start Python FastAPI Backend

```bash
cd backend
# Activate virtual environment if needed (Windows)
# .venv\Scripts\activate
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Start React Frontend

```bash
cd frontend/project
npm install
npm run dev
```

## 🎵 Features Available

Once both servers are running, you'll have access to:

- **AI-Assisted Upload**: Automatic metadata extraction; optional AI-generated cover art when missing
- **Multi-phase Progress**: Uploading (0–40%), Processing metadata (40–70%), AI cover art (70–100%), with speed and ETA
- **Cancel Upload**: Cancel during active phases
- **Auto-play Integration**: Uploaded tracks can start playing after publish
- **Seamless Navigation**: Smooth transition from upload to now playing

## 📍 Access Points

- **Frontend**: http://localhost:5173 (or the port shown in terminal)
- **Backend API**: http://localhost:8000
- **Upload Page**: http://localhost:5173/upload

## 🔐 Environment

- Frontend: set `VITE_API_URL` (e.g., `http://localhost:8000`). If unset, defaults to `http://localhost:8000`.
- Backend: copy `backend/.env.example` to `backend/.env` and configure Backblaze B2 credentials if available. When B2 is not configured or fails, uploads fall back to local storage.

## 🛠️ Troubleshooting

### Backend Issues
- Make sure you're in the `backend` directory
- Activate the virtual environment if you have one
- Install dependencies: `pip install -r requirements.txt`

### Frontend Issues
- Make sure you're in the `frontend/project` directory
- Clear node_modules if needed: `rm -rf node_modules && npm install`
- Check if port 5173 is available

### 409 Conflict during upload
- Cause: duplicate detected by backend when not forcing overwrite.
- Fix: Click "Upload Anyway" on the duplicate banner to resend with `skip_duplicate_check=true`.
- Verify in browser DevTools → Network → POST /upload → Form Data contains `skip_duplicate_check: true`.

## 🎯 Testing the Upload Feature

1. Navigate to http://localhost:5173/upload
2. Drag and drop an audio file or click to select
3. Watch as metadata is automatically extracted
4. Fill in any additional details
5. Click "Publish" to upload
6. The track will automatically start playing after upload

## 🔁 Duplicate / Overwrite Flow

- The app checks for duplicates before uploading. If detected, a banner appears with track details.
- Click "Upload Anyway" to force upload; the request includes `skip_duplicate_check=true`.
- When forced and B2 is configured, the backend creates a unique B2 key to avoid DB unique constraint issues.
- If you still see 409, confirm the flag is present in the Network tab and retry.
- Custom cover art prompt is optional; leave blank to generate automatically.

## 📝 Notes

- The backend uses FastAPI with automatic metadata extraction
- The frontend uses React with Vite for fast development
- Upload progress is tracked with a multi-phase UI and detailed status
- Cover art is extracted from files when present; AI-generated when missing (no API key required)
- Storage: Backblaze B2 by default (when configured); local `uploads` used as fallback

## Maintenance: Scan and prune unplayable tracks

- Tool: `backend/tools/scan_prune_tracks.py`
- Purpose: Detects tracks that won’t play and optionally deletes their DB rows.
- Playable criteria:
  - Remote: `file_path` starting with `http://` or `https://` (B2/remote) → OK
  - Local: resolves `/uploads/...` or `uploads/...` to your `UPLOAD_DIR` and checks existence; also tries the basename and numbered variants like `name_1.mp3`.
- Usage (run from `backend/`):
  - Scan only:
    - `python tools/scan_prune_tracks.py`
  - Scan with explicit upload dir:
    - `python tools/scan_prune_tracks.py --upload-dir uploads`
  - Delete unplayable (destructive):
    - `python tools/scan_prune_tracks.py --delete`
- Notes:
  - Make a DB backup before using `--delete`.
  - This script does not restart or affect the running server.

---

**Happy streaming! 🎶**
