# Papzin & Crew — Product Requirements Document (PRD)

Status: Draft v1.0  
Date: 2025-08-23  
Authors: DJ Papzin (Letlhogonolo Fanampe), Cascade (assistant)  
Sources: `docs/Papzin_Crew_Business_Plan.md`, `docs/Papzin & Crew.docx`

---

## 1) Summary
Papzin & Crew is a platform connecting DJs (Mega‑Mixers) and music lovers through high‑quality mixtapes. The product enables DJs to upload, enrich, and publish mixes; and enables listeners to discover, stream, and download content. The business model targets a freemium funnel with premium (listeners) and pro (DJs) tiers.

This PRD translates the business intent into actionable, testable product requirements aligned with the current codebase capabilities.


## 2) Goals and Non‑Goals
- **Goals (near‑term)**
  - Enable secure, reliable upload of mixes with automatic metadata and cover art extraction.
  - Store audio and assets in Backblaze B2 by default (B2‑first), with robust fallbacks.
  - Provide low‑latency streaming and safe download links with usage metrics.
  - Offer a simple, modern UI to upload, browse, search, and play mixes on web.
  - Track play and download counts, and expose lightweight stats.

- **Non‑Goals (this version)**
  - Subscriptions, payments, and account plans (Freemium/Premium/Pro) – scoped to later phase.
  - 24/7 online radio (mixes‑only station) – later phase.
  - Voiceover/artwork request workflows, bookings, and A&R ops – later phase.
  - Ads system and ad inventory management – later phase.


## 3) Personas
- **Mega‑Mixer (DJ/Creator)**: uploads mixes, reviews metadata, adds cover art/tracklist, publishes.
- **Listener (Fan)**: discovers, streams, downloads, and shares mixes.
- **Admin/Moderator**: manages catalog integrity, deletes problematic content, monitors health.


## 4) User Stories (Prioritized)
1. **As a DJ**, I can upload an MP3 and see its metadata auto‑extracted so I publish quickly.
2. **As a DJ**, I see upload progress with clear phases and can cancel if needed.
3. **As a Listener**, I can browse the latest mixes and stream instantly on desktop/mobile.
4. **As a Listener**, I can download a mix (if allowed) and the platform counts the download.
5. **As an Admin**, I can remove a mix that violates policy and the library updates immediately.
6. **As any user**, search helps me find mixes by title/artist/tags (baseline relevance).


## 5) Functional Requirements

### 5.1 Upload & Validation
- Accept MP3 (and future compatible formats) up to 100 MB per file.
- Validate extension and content type; respond with structured error codes (e.g., `unsupported_file_type`).
- Duplicate detection before storage write; return 409 when duplicate is detected.
- Progress phases mapping (examples from frontend):
  - 0–40: upload to storage
  - 40–70: processing/metadata
  - 70–100: cover art
- Allow cancellation during upload.
- On success, dispatch UI event to refresh library without page reload.

Implementation references:
- Backend: `backend/app/routers/uploads.py` (B2‑first, validation, duplicate checks, structured errors).
- Frontend: `frontend/project/src/components/UploadPage.tsx` (progress UI, cancel, dispatch `library:refresh`).

### 5.2 Storage (B2‑first)
- Primary storage: Backblaze B2 via S3 API.
- Never write to local disk unless configured as fallback and only after multiple B2 retries.
- If B2 is unconfigured and ENFORCE_B2_ONLY is on, return 503.
- Config via environment variables; do not expose secrets in repo.

Implementation references:
- `backend/app/services/b2_storage.py` (lazy imports, retry/backoff), env via `backend/.env`.

### 5.3 Metadata & Cover Art
- Extract: title, artist, duration, bitrate/quality, size, BPM (if available), and artwork.
- If tags lack artist/title, derive from filename (e.g., "Artist - Title") with Unicode and bracket handling; default to "Unknown Artist" if missing.
- Persist cover art to B2 when present; store URL in DB.

References:
- `backend/app/routers/uploads.py` (fallback parsing), `Mix` model fields in `backend/app/models/models.py`.

### 5.4 Catalog & Entities
- Entities per `backend/app/models/models.py`:
  - `Artist(id, name)`; `Mix` belongs to `Artist` via `artist_id`.
  - `Mix(id, title, original_filename, duration_seconds, file_path, cover_art_url, file_size_mb, quality_kbps, bpm, release_date, description, tracklist, tags, genre, album, year, availability, allow_downloads, display_embed, age_restriction, play_count, download_count)`.
  - Optional `Category` many‑to‑many (future UI), and `TracklistItem` entries.
- Default ordering: newest first.

### 5.5 Streaming & Download
- Stream endpoint resolves B2 URL or proxied path and supports HTTP Range.
- HEAD should return 200/206 for quick reachability checks (used by E2E tests).
- Download endpoint increments `download_count` and enforces availability/privacy.

References:
- Streaming & download: `backend/app/routers/tracks.py` (redirect/proxy logic, counters), play tracking.
- Tests align to accept both redirect and proxy; HEAD used for reachability.

### 5.6 Search & Stats
- Search mixes by title/artist/tags (basic text search).
- Track and expose `play_count` and `download_count` per mix; simple stats endpoint.

References:
- `Mix.play_count`, `Mix.download_count`; endpoints in `backend/app/routers/tracks.py`.

### 5.7 Admin
- Delete mix (and cascade remove `TracklistItem`), validated permissions.
- Startup auto‑migration ensures `play_count` and `download_count` columns exist for legacy DBs.

References:
- Startup migration: `backend/app/main.py` (ALTER TABLE safeguard).


## 6) Non‑Functional Requirements
- **Performance**: First audio byte under 1s median on broadband; stream seeks under 300ms.
- **Reliability**: B2 retries with backoff; local fallback only when configured and safe.
- **Security**: Strict CORS via env; input sanitization (`sanitize_filename`), path validation, and permission checks; secrets in env only.
- **Scalability**: B2 for assets, Render for API; stateless app ready for horizontal scale.
- **Observability**: Structured logs for upload/stream decisions, 404s, and validation errors.
- **Compatibility**: Pydantic v2, SQLAlchemy v2 compliant; no deprecation warnings.


## 7) API Surface (representative)
- `POST /upload` – upload mix; returns created Mix with metadata and `cover_art_url`.
- `GET /tracks` – list mixes (newest first) with pagination.
- `GET /tracks/{id}/stream` – stream (redirects to B2 or proxies); supports HEAD.
- `GET /tracks/{id}/download` – increments count; returns file or redirect.
- `GET /tracks/search?q=...` – basic search by text.
- `GET /tracks/{id}/stats` – returns play/download counts.
- `DELETE /admin/tracks/{id}` – admin delete.

Response schemas align with `Mix` and related Pydantic models; structured error codes on validation failure.


## 8) Data Model
Key tables from `backend/app/models/models.py`:
- `artists(id, name)`
- `mixes(id, title, original_filename, duration_seconds, file_path [B2 URL or proxy path], cover_art_url, file_size_mb, quality_kbps, bpm, release_date, description, tracklist, tags, genre, album, year, availability, allow_downloads, display_embed, age_restriction, play_count, download_count, artist_id)`
- `mix_category(mix_id, category_id)`
- `categories(id, name, description)`
- `tracklist_items(id, track_title, track_artist, timestamp_seconds, mix_id)`


## 9) Acceptance Criteria (MVP)
- Uploading a valid MP3 ≤100MB stores the file in B2, extracts metadata/artwork, and returns a Mix with `cover_art_url` when present.
- Upload progress UI shows three phases and an overall progress bar; Cancel halts upload.
- Duplicate detection returns 409 before any storage writes.
- When B2 is unconfigured and enforcement is on, `POST /upload` returns 503.
- `GET /tracks` returns items sorted by `id` desc; newly uploaded items appear without reload.
- `GET /tracks/{id}/stream` returns a playable source (redirect/206 proxy) and increments play count appropriately.
- `GET /tracks/{id}/download` increments `download_count` for both remote and local.
- Basic search returns relevant results by title/artist.
- Admin can delete a track; related `TracklistItem` rows are removed.
- No Pydantic/SQLAlchemy deprecation warnings at runtime and tests.


## 10) Release Plan
- **v1 (Current)**: Upload → B2, metadata/art, stream/download, library, basic stats, admin delete, CORS, logging.
- **v1.1**: Harden search, schema validation polish, more unit/E2E coverage.
- **v2**: Subscriptions (Premium/Pro), payments, account tiers, listener features (no ads, 320kbps), DJ pro features.
- **v2.1**: 24/7 mixes‑only radio; scheduling and content rotation.
- **v2.2**: Ads inventory and targeting; voiceover/artwork request workflows; booking flows.


## 11) Metrics / KPIs
- Listener: DAU/WAU/MAU, play counts, completion rate, time to first play.
- Creator: monthly uploads, upload success rate, time‑to‑publish.
- Quality: error rates (4xx/5xx), B2 retry rate, median stream start/seek time.
- Growth: search queries, conversion from visitor → listener → uploader.


## 12) Risks & Mitigations
- **Copyright**: Infringement notices; implement takedown workflows, admin tooling, and legal templates.
- **Storage/Costs**: B2 egress/storage costs; enforce bitrate limits, caching/redirects, and download policies.
- **Data Integrity**: Schema drift; startup migrations and Alembic for future managed migrations.
- **CORS/Security**: Strict env‑driven origins, robust filename/path validation, role‑based guardrails.


## 13) Assumptions & Dependencies
- Infra: Backend on Render, Frontend on Netlify, Storage on Backblaze B2, DB on Postgres.
- CI: GitHub Actions with backend pytest and frontend Vitest/Playwright.
- Secrets: managed via environment variables; `.env*` files git‑ignored.


## 14) Open Questions
- Subscription tiers: exact feature gating (e.g., 320kbps, early releases, tracklist edit). Payment provider?
- Radio: music licensing approach, scheduling rules, georestrictions?
- Search relevance: do we need full‑text search (Postgres tsvector) and filters (genre/tags)?
- Content policy: DMCA/takedown process and SLA.
- Quotas: per‑DJ upload limits, storage caps, and retention rules.


## 15) Appendix
- Source business plan services to map in future phases:
  - Cruize mix requests, Cruize Friday guest nominations, voiceovers, artwork requests, 24/7 radio, subscriptions (listeners & DJs), bookings, promotion & marketing hooks.
- Testing references:
  - Backend unit tests and E2E coverage; HEAD expectations for `/tracks/{id}/stream` reachability.
- Notable implementation details:
  - B2‑first with retries/backoff, local fallback only after multiple failures and only when configured.
  - Auto migration ensures `play_count` and `download_count` columns exist.
