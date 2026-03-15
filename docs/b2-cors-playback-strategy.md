# B2 CORS + Playback Strategy (Draft)

_Status: draft only — safe default guidance for the current MVP. This is **not** a production-final sign-off._

## Canonical draft files

- Bucket CORS draft: `b2-cors.json`
- Mirror copy kept in backend folder for convenience: `backend/cors-b2.json`

Both JSON files are intentionally kept identical in this draft so docs/config do not drift.

## Draft playback posture

Use a conservative two-path approach for now:

1. Default playback URL: `GET /tracks/{id}/stream`
2. Compatibility fallback: `GET /tracks/{id}/stream/proxy`

Why this draft posture:

- `stream` keeps the normal redirect/served path simple
- `stream/proxy` remains available when mobile/browser Range or CORS behavior is inconsistent
- this avoids forcing all playback through the proxy before mobile validation is finished

## Draft CORS posture

The draft CORS JSON is intentionally **not wildcard-open**.

Allowed origins are currently limited to:

- `https://papzincrew.netlify.app`
- `http://localhost:5173`
- `http://127.0.0.1:5173`

If a temporary LAN/mobile dev origin is needed later (for example `http://192.168.x.x:5173`), add that exact origin deliberately instead of switching to `*`.

## Headers / methods in scope

Current draft allows only what playback should need:

- Methods: `GET`, `HEAD`
- Allowed headers: `origin`, `range`, `accept`, `content-type`
- Exposed headers: `Accept-Ranges`, `Content-Range`, `Content-Length`, `Content-Type`, `ETag`

## What is still open

Before calling this production-final, re-check:

- real mobile playback from Android on the intended frontend origin
- whether any extra frontend origin(s) are required
- whether proxy fallback should remain fallback-only or become the default path for specific clients
- CDN / cache behavior, if introduced later

## Operator note

If playback fails with a CORS complaint:

- first confirm the frontend origin exactly matches the B2 CORS JSON
- then retry with `/tracks/{id}/stream/proxy`
- do **not** widen B2 CORS to `"*"` unless there is an explicit security review
