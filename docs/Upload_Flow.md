# Upload Flow (Quick Onboarding)

This document summarizes the end-to-end upload pipeline and key environment variables. It complements the inline comments in `frontend/project/src/components/UploadPage.tsx` and the "Upload Behavior Details" section in `README.md`.

## Overview

- Frontend validates file (size/type) and surfaces structured backend errors.
- Progress is shown in phases: Upload (0–40%) → Processing (40–70%) → Cover Art (70–100%).
- Backend performs duplicate detection, metadata extraction, and B2-first storage with local fallback.
- Cover art: use provided image → embedded art → AI-generated fallback (with polling until ready).

## Sequence (high-level)

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant FE as Frontend (UploadPage.tsx)
    participant BE as Backend (FastAPI)
    participant B2 as Backblaze B2
    participant FS as Local FS

    U->>FE: Select audio file
    FE->>FE: Validate size/type (client-side)
    FE->>BE: (Optional) POST check-duplicate (title/artist/size/hash)
    alt Duplicate found
        BE-->>FE: 409 duplicate with duplicate_info
        FE->>U: Prompt user to force or cancel
    end

    FE->>BE: POST upload-mix (multipart form)
    BE->>BE: validate_audio_file; duplicate check; sanitize filename
    BE->>B2: Try upload (retries with timeout)
    alt B2 success
        B2-->>BE: OK (URL/key)
    else B2 exhausted retries
        BE->>FS: Save locally (unless ENFORCE_B2_ONLY)
        FS-->>BE: OK (path)
    end

    BE->>BE: Extract metadata; save/resolve cover art
    alt No user/embedded art
        BE->>BE: Trigger AI cover art generation (async)
    end
    BE-->>FE: 201 Created (track info + cover art pending if applicable)

    loop Cover art polling (FE)
        FE->>BE: GET cover art status (by track/id)
        BE-->>FE: pending|ready|failed + URL if ready
    end

    FE->>U: Show phase progress and completion
```

Notes:
- Frontend maps raw upload progress events to 0–40% and simulates later phases for clarity.
- Duplicate detection can be skipped via a form flag when user forces the upload.
- Polling continues until cover art is ready or a max retry threshold is hit.

## API Endpoints (reference)

- Duplicate check: POST endpoint to check for existing track with provided metadata.
- Upload: POST endpoint that accepts multipart (audio file, metadata, and flags like `skip_duplicate_check`).
- Cover art status: GET endpoint to query generation status by track/id.

Refer to backend routes in `backend/app/routers/uploads.py` for exact paths and payloads.

## Environment Variables (matrix)

| Variable | Scope | Purpose | Default / Example |
|---|---|---|---|
| DATABASE_URL | Backend | PostgreSQL connection; omitted locally to use SQLite | postgresql://USER:PASSWORD@HOST:PORT/DB |
| B2_ACCESS_KEY_ID | Backend | Backblaze B2 auth | — |
| B2_SECRET_ACCESS_KEY | Backend | Backblaze B2 secret | — |
| B2_BUCKET | Backend | B2 bucket for audio/art | papzincrew-music-djpapzin |
| ENFORCE_B2_ONLY | Backend | Disable local fallback if set (strict cloud-only) | 0 |
| UPLOAD_DIR | Backend | Local fallback directory | uploads |
| B2_PUT_TIMEOUT | Backend | Timeout for B2 put operations | (implementation default) |
| B2_MAX_RETRIES | Backend | Max B2 upload retries | (implementation default) |
| B2_RETRY_BACKOFF | Backend | Retry backoff strategy | (implementation default) |
| ALLOWED_ORIGINS | Backend | CORS allowed origins (comma list) | includes Netlify + localhost |
| ALLOWED_ORIGIN_REGEX | Backend | Optional regex CORS | — |
| LOG_LEVEL | Backend | Logging level | INFO |
| ENABLE_UPLOAD_PRINTS | Backend | Verbose upload prints for debugging | 0 |
| VITE_API_URL | Frontend | Backend base URL for API calls | http://127.0.0.1:8000 |

Security reminders:
- Never commit secrets. Use environment variables. Ensure `.env` files are in `.gitignore`.
- Centralized filename sanitization protects against path traversal and reserved names.

## Troubleshooting

- CORS errors: confirm `ALLOWED_ORIGINS` and B2 CORS JSON include your domains and headers.
- Duplicate 409: surface backend `error_code` and `duplicate_info`; provide a force-upload option.
- B2 outages: expect local fallback unless `ENFORCE_B2_ONLY=1`.
- Cover art pending: polling continues until ready; show user-friendly status.
