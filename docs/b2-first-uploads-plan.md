# Enforce B2-First Uploads — Implementation & Test Plan

## Goal
Ensure uploads write to Backblaze B2 first using streaming (no local temp files). Use local storage only if B2 explicitly fails, and clearly report which storage was used in the response and logs.

## Requirements
- Primary storage: B2 via `put_bytes` (streamed from request), no local temp writes.
- Fallback: Local only when B2 returns an error; include reason in logs and response.
- Response shape: include `storage: "b2" | "local"` and `location` (`b2_key` or `local_path`).
- Logging: correlation ID per upload; record storage used, duration, and any fallback reason.
- Config: validate B2 env on startup (fail-fast in production if missing).

## Current Touchpoints
- Service: `backend/app/services/b2_storage.py`
- Route: `backend/app/routers/uploads.py`
- Config/env: `backend/.env`, `backend/app/main.py`

## Implementation Steps
1) Service layer (B2)
   - Confirm `b2_storage.py` uses B2 SDK `put_bytes` streaming (no local writes).
   - Return typed result: `{ ok: bool, key?: str, error_code?: str, detail?: str }`.
   - Map common failures to stable `error_code`s: `auth_error`, `bucket_not_found`, `timeout`, `network_error`, `rate_limited`.

2) Upload flow (`uploads.py`)
   - Attempt B2 first. On success, 201 response:
     ```json
     { "storage": "b2", "location": "<b2_key>", "track": { /* metadata */ } }
     ```
   - On B2 failure: log warning with `error_code` and detail; attempt local fallback.
   - On local success: 201 response with `storage: "local"`, `location: "<path>"`, and `fallback_from_b2: true`.
   - On total failure: 5xx with structured error `{ error_code, error, detail, hints }`.

3) Config validation
   - On startup: if `ENV=production` and required B2 vars missing → raise and stop.
   - In non-prod: warn when B2 disabled (local-only mode).

4) Response & logging
   - Include `storage` and `location` in success responses.
   - Log correlation ID, timings, storage used, and fallback reason.

## Tests
1) Unit (mock B2 client)
   - B2 success returns `{ ok: true, key }`.
   - B2 error paths surface mapped `error_code`s.

2) Integration (route tests)
   - Happy path: B2 success → 201 with `storage: "b2"` and key.
   - Forced failure: mock B2 to throw → local fallback → 201 with `storage: "local"` and `fallback_from_b2: true`.
   - Total failure: both B2 and local fail → 5xx structured error.

3) Manual QA checklist
   - Upload small MP3 → verify B2 object exists and response shows `storage: "b2"`.
   - Temporarily break B2 creds → verify local fallback and accurate response fields.
   - Inspect logs for correlation ID, timings, and storage used.

## Deliverables
- Updated `b2_storage.py` with result contract and error mapping.
- Updated `uploads.py` flow and responses.
- Unit + integration tests.
- Docs: B2-first policy, env requirements, fallback behavior.
