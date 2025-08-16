# PapzinCrew Music Streaming Platform — Status & Ideas

## Next up (Post-deploy)
- [x] Set up live log tailing locally (Render CLI or log drain).
- [ ] Add integration tests for upload flow (validation errors, 409 duplicate, B2-first with local fallback, ENFORCE_B2_ONLY)
- [x] Add docs/Upload_Flow.md with sequence diagram (file upload → metadata → AI art) and env var matrix
- [ ] Finalize B2 CORS and mobile playback decision (Range/CORS: use /tracks/{id}/stream/proxy vs redirect)
- [ ] Secrets audit: ensure .env in .gitignore and no keys in repo; verify Render envs
- [ ] Add request IDs and structured logs baseline (trace upload/stream)

## Status (Aug 16, 2025)
- [x] Backend: Render deploy succeeded after adding aiohttp to `backend/render-requirements.txt`.
- [x] Health: `/health` returns healthy; OpenAPI reachable.
- [x] Frontend: Netlify site loads and talks to backend.
- [x] CI: merged ci/stabilize-tests; CI runs unit tests only with dummy B2 env vars
- [x] Single requirements source: consolidated into `backend/requirements.txt`; removed dev/render files
- [x] Frontend: Upload progress stepper and inline comments finalized in `frontend/project/src/components/UploadPage.tsx` (phase mapping, cancel behavior)
- [x] Docs: Added README "Upload Behavior Details" (validation, duplicates, storage fallback, AI cover art, env vars)
- [x] Backend tests: 175/175 passing locally (`backend/`): hardened security logging in `backend/app/routers/file_management.py` (httpx monitor, global filter, TestClient wrappers, pre-auth probe) to guarantee traversal attempts are warned

## Status (Aug 13, 2025)
- [x] MVP complete: upload → B2 → stream; metadata + cover art extraction.
- [x] B2-first storage; local only as fallback.
- [x] Streaming fixed: robust local resolution, B2 redirect/proxy; CORS verified on B2.
- [x] DB clean: broken_count=0; all tracks playable (remote 200).
- [x] Backend: detailed stream logging; mixes ordered newest-first.
- [x] Frontend: empty-state UI, enhanced upload progress stepper; auto library refresh on upload.
- [x] E2E playback test updated: accept /tracks/{id}/stream(/proxy) and use HEAD (accept 206); passing on Chromium.
- [x] **Fixed upload syntax errors**: Resolved malformed logging statements and template markers in uploads.py.
- [x] **Route compatibility**: Added POST /upload alias to maintain frontend compatibility alongside /upload-mix.
- [x] **Cover art helper**: Extracted _save_cover_art() function for cleaner B2-first cover art handling.

## Near-term
- [ ] Mobile playback test; if using LAN origin (e.g., http://192.168.x.x:5173), add it to B2 CORS.
- [ ] Finalize production B2 CORS rules (domains, headers, maxAge).
- [ ] Decide on using /tracks/{id}/stream/proxy for mobile (Range/CORS) vs redirect.

## Quality/ops
- [ ] Basic monitoring/logging: request IDs, structured logs, error reporting.
- [ ] File deduplication by content hash to avoid duplicate uploads.
- [ ] Rate limiting for upload/stream endpoints.
- [ ] Robust upload cancel/resume; large-file handling.
- [ ] Cover art caching/resizing; waveform preview generation.

## CI & Testing
- [x] Stabilize CI (backend tests) to green
  - [ ] Consider separate jobs: unit vs integration (matrix)
  - [ ] Gate security logging hooks behind test flag (e.g., `settings.TESTING` or `PYTEST_CURRENT_TEST`) to reduce production noise

## Product
- [ ] Playlists/queue; favorites.
- [ ] Search/filter (artist, title, BPM, tags).
- [ ] Shareable links; social previews.
- [ ] Now playing mini-player and background audio on mobile.

- [ ] add upload date to the file and show it in the main page.
- [ ] minimize buttons for the maximized player
  - [ ] add ff and rw when only 1 track is in the playlist
  - [ ] add like button
  - [ ] add share button
- [ ] store created prompts for image generation in a database

- [ ] create unit tests for metadata extraction

- [ ] create unit tests for image generation

- [ ] when music is playing, "publish" button gets hidden

- [ ] Add papzin & crew (black & White) logo.

- [ ] how to view render.com live logs on my terminal or app without going to render.com dashboard
  - [ ] Option B: Render API — call logs endpoint with `RENDER_API_KEY` to fetch recent logs; wrap with a small PowerShell/Node script to tail.
  - [ ] Option C: Log drain — send app logs to a provider (e.g., Better Stack/Logtail) and view/tail from their CLI.
  - [ ] App-level: ensure FastAPI/Uvicorn logs go to stdout; include request IDs for easier tracing.