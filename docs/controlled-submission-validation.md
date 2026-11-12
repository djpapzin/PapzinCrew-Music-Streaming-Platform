# Controlled submission validation — 12 November 2026

Issue #107 / PR #108. Codex reviewed the original prompt-removal diff, then
tested the complete local submission path and fixed three observed blockers.

## Environment and limits

Frontend: `http://127.0.0.1:5176`; backend: `http://127.0.0.1:8016`.
Used the local Codex in-app browser, a new SQLite database, temporary filesystem
uploads and synthetic silent audio. The test server discarded inherited service
configuration, disabled dotenv loading, blocked outbound socket connections,
disabled B2 and replaced AI artwork generation with a no-op. Metadata parsing,
validation, storage, API routes and browser forms used the application code.
This verifies the local storage path; it is not a live B2 upload or production
release acceptance. Production uploads remain paused. No test mix was published.

## Observations and fixes

- Ordinary upload forms hide internal task-ID setup instructions; explicitly
  supplied Paperclip task context still uses the existing integration.
- Legacy search/list endpoints exposed unlisted and private mixes. Search,
  track lists, artist collections and category collections now filter public
  discovery. Filtering precedes track-list pagination. Direct unlisted review
  links remain available; private direct links still require authorization.
  Existing null-visibility compatibility matches the public catalog.
- Local streams returned HTTP 200 with an empty body, preventing owner review
  playback. They now send bounded 64 KiB reads with content length and byte-range
  responses. HEAD has no body or play-count write. The metadata DB session closes
  before streaming. Audio bytes are unchanged; remote redirects and the bounded
  production-cache delivery route retain their existing behavior.
- Paused intake hid My uploads, although navigation and completion links pointed
  there. Saved review links now remain accessible while new submissions are paused.

## Completed checks

- Registered a local test account through the UI and verified automatic sign-in.
- Submitted a 180-second WAV (large-file path) and 180-second MP3 (metadata-scan
  path), each with a chosen PNG converted by the normal cover preparation flow.
- Both completion pages showed the correct title, selected artwork and 3:00
  duration. Both database records remained unlisted after all checks.
- My uploads retained both links across navigation/reload and with intake paused.
  At 390 px, the page had no horizontal overflow and retained both review links.
- After repairing empty delivery, WAV playback advanced beyond 32 seconds.
  MP3 playback advanced, sought to 1:30 and 2:50, then paused around 2:56.
  All media remained muted and was paused at cleanup. Silent fixtures establish
  decoding/progress, not audible quality or physical-phone background behavior.
- HTTP range requests returned 206 and exactly 1,024 audio bytes. Tests cover
  complete bodies, bounded/suffix/open ranges, invalid ranges and HEAD behavior.
- Duplicate audio returned 409; invalid audio returned 400. Exactly two unlisted
  submissions remained. Catalog/search/artist discovery omitted both.
- Anonymous owner analytics returned 403; an isolated test owner key returned 200.
  No real owner credential was used. Actual musical approval/publication remains
  a separate manual owner action under `deploy/UPLOAD_REVIEW.md`; it was not
  simulated by promoting synthetic uploads.

## Validation and review

`python -m pytest -q --tb=short` in backend: **373 passed**.
FFmpeg and FFprobe are required for the existing M4A integrity tests; missing
local tools were installed before the successful complete run.

`NODE_OPTIONS=--no-experimental-webstorage npm run test:run` in frontend/project:
**181 passed**. `npm run build` and `git diff --check` passed.

Review checked explicit-task integration, public visibility before pagination,
nested collection serialization, direct-link access rules, real audio delivery,
HEAD/range semantics, DB release before long responses and paused-intake routing.
No remaining actionable finding was identified in this scoped Codex review.
This is the implementing Codex agent's review, not an independent second-agent
approval. Required CI must pass on the final pushed revision before merge.

Production promotion needs specific DJ approval and includes separate backend
deployment of the three changed routers as well as the frontend. Reopening
community uploads remains a separate decision. Do not treat a frontend preview
as an isolated backend: previews share production API data.
