# B2-first Uploads: Design, Config, and Health

This backend uploads to Backblaze B2 first and only falls back to local storage when B2 is explicitly unavailable or fails.

- Primary: Backblaze B2 (S3-compatible)
- Fallback: Local filesystem under `UPLOAD_DIR`
- Health: `/storage/health` reports configuration and connectivity

## Environment Variables

Required for B2:
- `B2_ENDPOINT` (e.g., `https://s3.us-west-002.backblazeb2.com`)
- `B2_REGION` (e.g., `us-west-002`)
- `B2_BUCKET`
- `B2_ACCESS_KEY_ID`
- `B2_SECRET_ACCESS_KEY`

Optional tuning:
- `B2_CONNECT_TIMEOUT` (default: 3)
- `B2_READ_TIMEOUT` (default: 10)
- `B2_MAX_ATTEMPTS` (default: 2)
- `B2_PUT_TIMEOUT` (async put overall timeout, default: 20)

General:
- `UPLOAD_DIR` (default: `uploads`) used only for fallback and static serving at `/uploads`
- `LOG_LEVEL` (default: `INFO`)
- `AI_COVER_TIMEOUT_SECONDS` (default: `45.0`)
- `ENABLE_UPLOAD_PRINTS` (default: `1`)

## Upload Behavior

Route: `POST /upload`

1. Validate request (no temp disk writes for validation).
2. Read bytes in-memory and compute hash.
3. Attempt B2 upload via `B2Storage.put_bytes_safe()`.
4. If B2 succeeds, respond with storage details for B2.
5. If B2 fails or not configured, save locally and mark as fallback.
6. Cover art handling follows the same B2-first, local-fallback policy.

Success response includes storage details:
```json
{
  "id": 123,
  "stream_url": "/tracks/123/stream",
  "storage": "b2",            // or "local"
  "location": "audio/Artist - Title.mp3",  // or local path when fallback
  "fallback_from_b2": true      // present only if local fallback used due to B2 error
}
```

## Health Endpoint

Route: `GET /storage/health`

- `status`: "ok" | "degraded" | "disabled"
- `b2`: detailed config/connectivity payload

Examples:
- Disabled (not configured):
```json
{"status":"disabled","b2":{"configured":false,"ok":false,"error_code":"not_configured"}}
```
- OK:
```json
{"status":"ok","b2":{"configured":true,"ok":true,"endpoint":"...","bucket":"...","region":"..."}}
```
- Degraded (e.g., auth error):
```json
{"status":"degraded","b2":{"configured":true,"ok":false,"error_code":"auth_error","detail":"..."}}
```

## Logging

Key logs during upload:
- Start, input metadata, hash, B2 attempt, timing
- B2 error codes and details on failure
- Local fallback path and URL

## Testing

- Health endpoint tests: `backend/tests/test_storage_health.py`
- Upload tests (B2 success/failure/not-configured): `backend/tests/test_upload_b2_first.py`

Run:
```bash
pytest -q backend/tests
```
