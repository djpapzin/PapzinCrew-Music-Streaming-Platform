# Website upload flow

1. Open `/upload`, choose an audio file (up to 200 MB), and enter its title and artist.
2. Publish sends the file and metadata to `POST /upload`. The backend checks for duplicate content before storing audio.
3. The backend stores the audio in Backblaze B2 and creates the catalog entry. A successful response includes the saved track ID.
4. The frontend immediately dispatches `library:refresh` and opens `/track/{id}`. The shared catalog used by Home and Quick Play refreshes without waiting for artwork.
5. Audio metadata and cover art finish in the background. Uploading does not automatically start playback.

Uploading directly in the Backblaze console only stores a file. It requires a separate catalog import; use the website for automatic catalog registration.

## Storage policy

Production should set `ENFORCE_B2_ONLY=1`. When B2 is unavailable or rejects an upload, the backend returns 503 and creates no mix entry or temporary local audio copy. When that setting is disabled, local fallback remains available for development.

The upload flow does not change billing settings or storage caps. Keep the Backblaze account caps configured separately.

## Verification

- `frontend/project/src/components/UploadPage.test.tsx` checks the catalog refresh and track-page handoff while artwork is pending.
- `backend/tests/test_upload_validation_and_policy.py` checks validation, duplicates, and failure under the cloud-only policy.
- `backend/tests/test_upload_integration.py` checks catalog persistence with isolated storage fixtures.

Live verification must separately confirm real Backblaze connectivity, a saved catalog entry, and muted playback. Automated storage tests use mocked B2 responses.
