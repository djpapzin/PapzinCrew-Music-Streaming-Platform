# Task 199 — Google Drive Batch Import Runbook (Path A)

Status: concrete operator runbook for the **current viable** Google Drive → Backblaze B2 → database import path in this repo.

This is the safest evidence-based path that works with the code already in the repository:

1. **Sync audio files from Google Drive into Backblaze B2 with `rclone`**
2. **Build a manifest from the uploaded B2 objects**
3. **Review the manifest before touching the database**
4. **Dry-run the DB import**
5. **Commit the DB import only after first-batch verification**

This path deliberately **does not** require Google API coding changes or app upload credentials beyond `rclone` + the existing backend DB/B2 configuration.

---

## Why this path is the current best fit

This repo already contains a migration toolkit under `scripts/migration/`:

- `scripts/migration/drive_to_b2_sync.sh`
- `scripts/migration/build_tracks_manifest.py`
- `scripts/migration/import_tracks_to_db.py`

And the backend already expects audio to live in **Backblaze B2**:

- `README.md` documents **B2-first storage**
- `backend/app/services/b2_storage.py` uses B2 S3-compatible env vars
- `backend/app/models/models.py` stores track URLs in `mixes.file_path`
- `backend/app/routers/uploads.py` already creates B2 audio keys under `audio/...`

So the migration plan should use B2 as the canonical storage target and only use the database import step to create the `mixes` rows after the files already exist in B2.

---

## Important current limitation

The current migration importer is best for **one primary artist per batch**.

Why:

- `build_tracks_manifest.py` currently produces rows with:
  - `title`
  - `original_filename`
  - `file_path`
  - optional `artist_id`
- `import_tracks_to_db.py` inserts each row into `mixes`
- It **does not currently create per-row artist names from filenames**
- If you do nothing special, all imported tracks end up under:
  - `--artist-id`, or
  - `MIGRATION_DEFAULT_ARTIST_NAME`

### Practical meaning

For **DJ Papzin / Papzin & Crew-owned mixes**, this flow is viable right now.

For a batch containing many different artists that each need separate `artists` rows, do **not** bulk-commit blindly. Split the batch per artist or extend the manifest/importer first.

---

## What metadata the current flow really preserves

### Preserved reliably now

- audio file in B2
- original filename
- title (derived from filename by default)
- file size
- optional duration if local files are readable by `mutagen`
- artist linkage **only if you explicitly choose/set the target artist for the batch**

### Not automatically handled by the current batch importer

- per-track artist creation from filename
- cover art extraction/upload
- file hash population
- duplicate detection as rich as the live `/upload` route
- BPM / genre / album enrichment

This is why the first batch should be small and verified before larger ingestion.

---

## File naming and folder conventions

### Recommended Google Drive source layout

Use a single Drive root folder for migration, for example:

```text
PapzinCrewUploads/
  2026-03-batch-01/
    DJ Papzin - Intro Mix.mp3
    DJ Papzin - Friday Heat Vol 1.mp3
    DJ Papzin - Amapiano Street Session.ogg
```

You may use nested folders, but keep them intentional. The sync script preserves relative paths into B2 under the configured prefix.

### Recommended filename format

Preferred:

```text
Artist - Title.ext
```

Examples:

- `DJ Papzin - Friday Heat Vol 1.mp3`
- `Papzin & Crew - Durban Night Run.ogg`

### Why this matters

The live upload route in `backend/app/routers/uploads.py` already falls back to filename parsing when metadata is missing and prefers an artist/title structure split on separators like:

- ` - `
- ` – `
- `—`
- `|`
- `•`

For this batch-import path, the current manifest builder still mainly uses the filename as the **title source**, so the same naming convention keeps the dataset clean and makes future importer improvements easier.

### Avoid

- filenames like `Track 01 final FINAL new.mp3`
- mixed separator styles inside one batch
- filenames with no usable title
- putting unrelated artists into one batch unless you are intentionally importing them under one artist record

---

## Environment and operator prerequisites

### 1) Local tools

Install on the machine performing the migration:

```bash
sudo apt-get update
sudo apt-get install -y rclone python3 python3-pip
pip install mutagen sqlalchemy psycopg2-binary
```

Notes:

- `mutagen` is optional but useful for duration extraction
- `psycopg2-binary` is only needed for Postgres
- if using local SQLite only, SQLAlchemy is enough

### 2) Google Drive remote in `rclone`

Create an `rclone` remote such as `gdrive`.

```bash
rclone config
```

Suggested remote name:

```text
gdrive
```

### 3) Backblaze B2 remote in `rclone`

Create a separate `rclone` remote such as `b2`.

Suggested remote name:

```text
b2
```

### 4) Backend/B2/database env

The backend repo already uses these B2 env names (`backend/.env.example`):

- `B2_ENDPOINT`
- `B2_REGION`
- `B2_BUCKET`
- `B2_ACCESS_KEY_ID`
- `B2_SECRET_ACCESS_KEY`
- `SQLALCHEMY_DATABASE_URL`

Do not invent alternate names if you can avoid it. Keep the migration step aligned with the backend’s actual env model.

---

## Operator template file

Use this repo-local template before the first run:

- `scripts/migration/first-batch.env.example`

Create a real local copy (do not commit secrets):

```bash
cp scripts/migration/first-batch.env.example .migration.first-batch.env
```

Then edit it and load it:

```bash
set -a
source .migration.first-batch.env
set +a
```

---

## Recommended first-batch settings

For the first real import, keep it small:

- **5 to 20 files max**
- one primary artist only
- use one dedicated batch folder, e.g. `2026-03-batch-01/`
- avoid cover-art concerns for batch 1
- prefer MP3 / OGG / M4A that already play cleanly elsewhere

---

## Exact operator steps

## Step 1 — Verify remotes and destination

```bash
rclone lsd gdrive:
rclone lsd b2:
```

Then verify the target bucket/prefix is what Papzin & Crew actually uses.

In this repo, real examples point at bucket names like:

- `papzincrew-music-djpapzin`

Do not accidentally import into a test bucket.

---

## Step 2 — Load migration env

Example:

```bash
cd /home/ubuntu/.openclaw/workspace-papzin-lead/projects/PapzinCrew-Music-Streaming-Platform
cp scripts/migration/first-batch.env.example .migration.first-batch.env
nano .migration.first-batch.env
set -a
source .migration.first-batch.env
set +a
```

At minimum confirm these values:

- `DRIVE_REMOTE`
- `DRIVE_PATH`
- `B2_REMOTE`
- `B2_BUCKET`
- `B2_PREFIX`
- `SQLALCHEMY_DATABASE_URL`
- either `MIGRATION_ARTIST_ID` or `MIGRATION_DEFAULT_ARTIST_NAME`
- `B2_PUBLIC_BASE_URL`

---

## Step 3 — Sync Google Drive to B2

```bash
bash scripts/migration/drive_to_b2_sync.sh
```

What it does:

- syncs `gdrive:<folder>` to `b2:<bucket>/<prefix>`
- writes logs to `logs/migration/`
- emits inventory files for manifest creation:
  - `b2_lsjson_<timestamp>.json`
  - `b2_lsf_<timestamp>.txt`

### Important note about the current sync script

The script uses `rclone sync` with `--ignore-existing`.

That means:

- it is safe for resumable first passes
- but it is **not** the right choice if you expect changed source files to overwrite existing B2 objects during the same import plan

For batch 1, that is fine. Treat the batch as append-only.

---

## Step 4 — Build a manifest from the new B2 objects

Example:

```bash
python scripts/migration/build_tracks_manifest.py \
  --lsjson logs/migration/b2_lsjson_YYYYMMDDTHHMMSSZ.json \
  --b2-prefix "$B2_PREFIX" \
  --artist-id "$MIGRATION_ARTIST_ID" \
  --out-json logs/migration/batch01_manifest.json \
  --out-csv logs/migration/batch01_manifest.csv
```

If you staged a local mirror and want duration extraction from local files, also pass:

```bash
  --local-root /path/to/local/staging/root
```

---

## Step 5 — Review the manifest before importing anything

This step is mandatory.

Open the CSV/JSON and verify:

- all filenames are expected
- no junk files slipped in
- titles look sane
- extensions are correct
- object paths sit under the intended B2 prefix
- the batch is truly single-artist if you are using one shared artist id/name

### Quick terminal checks

```bash
python -m json.tool logs/migration/batch01_manifest.json | head -80
cut -d, -f1-4 logs/migration/batch01_manifest.csv | head -20
```

### What to watch for

If title values look like full filenames or badly cleaned stems, stop and fix filenames before DB import.

---

## Step 6 — Dry-run the DB import

```bash
python scripts/migration/import_tracks_to_db.py \
  --manifest logs/migration/batch01_manifest.json \
  --database-url "$SQLALCHEMY_DATABASE_URL" \
  --base-public-url "$B2_PUBLIC_BASE_URL"
```

Expected behavior:

- no rows committed yet
- output shows counts like:
  - `would_insert=...`
  - `skipped_existing=...`
  - `skipped_invalid=...`

Do **not** proceed if:

- `would_insert` is unexpectedly high
- you expected duplicate skipping and got none
- the artist strategy is wrong

---

## Step 7 — Commit the DB import

Only after the dry-run looks correct:

```bash
python scripts/migration/import_tracks_to_db.py \
  --manifest logs/migration/batch01_manifest.json \
  --database-url "$SQLALCHEMY_DATABASE_URL" \
  --base-public-url "$B2_PUBLIC_BASE_URL" \
  --commit
```

---

## Step 8 — Verify in database

### Count imported rows

```sql
SELECT COUNT(*)
FROM mixes
WHERE tags = 'migration';
```

### Inspect newest imported rows

```sql
SELECT id, title, original_filename, file_path, artist_id, tags
FROM mixes
WHERE tags = 'migration'
ORDER BY id DESC
LIMIT 20;
```

### Confirm artist binding

```sql
SELECT m.id, m.title, a.name AS artist_name
FROM mixes m
JOIN artists a ON a.id = m.artist_id
WHERE m.tags = 'migration'
ORDER BY m.id DESC
LIMIT 20;
```

---

## Step 9 — Verify playback on the actual app

After DB import, test the real user path:

1. open the frontend connected to the real backend
2. confirm the imported tracks appear in library views
3. play at least 2–3 tracks
4. confirm stream URLs resolve correctly
5. confirm title/artist presentation is acceptable

This matters because database success alone does not prove end-user playback success.

---

## Dry-run / first-batch verification checklist

Use this exact order for the first real batch:

### A. Before sync

- [ ] Drive folder contains only intended files
- [ ] filenames mostly follow `Artist - Title.ext`
- [ ] batch is one primary artist only
- [ ] B2 bucket and prefix are correct

### B. After sync

- [ ] `logs/migration/drive_to_b2_sync_*.log` shows success
- [ ] `b2_lsjson_*.json` exists
- [ ] B2 inventory count matches expectation

### C. After manifest build

- [ ] manifest row count matches uploaded files
- [ ] no obvious junk files
- [ ] titles are readable
- [ ] artist strategy is still valid

### D. After import dry-run

- [ ] `would_insert` matches expectation
- [ ] no suspicious `skipped_invalid`
- [ ] no surprise duplicates

### E. After commit

- [ ] rows exist in `mixes`
- [ ] rows point to B2 URLs, not local fallback paths
- [ ] frontend can list and play at least one imported track

---

## Choosing `B2_PUBLIC_BASE_URL`

This value controls how `import_tracks_to_db.py` transforms manifest keys into `mixes.file_path` URLs.

Use the public base URL that matches how the app should reach your bucket.

Examples seen in this repo/history include S3-style public URLs such as:

```text
https://s3.us-east-005.backblazeb2.com/papzincrew-music-djpapzin
```

If your bucket is fronted by another public URL/CDN, use that instead — but be consistent with actual playback configuration.

---

## Rollback plan

## Remove imported DB rows

Because the importer tags inserted rows with `tags = 'migration'`, rollback is straightforward:

```sql
DELETE FROM mixes WHERE tags = 'migration';
```

If needed, narrow further by B2 URL prefix:

```sql
DELETE FROM mixes
WHERE file_path LIKE 'https://s3.us-east-005.backblazeb2.com/papzincrew-music-djpapzin/audio/migration/%';
```

## Remove uploaded B2 objects

Always dry-run first:

```bash
rclone delete "${B2_REMOTE}:${B2_BUCKET}/${B2_PREFIX}" --dry-run
rclone delete "${B2_REMOTE}:${B2_BUCKET}/${B2_PREFIX}"
```

---

## Recommended operating policy for DJ Papzin

### Safe to use now

- Papzin-owned mixes
- one artist or one artist record per batch
- append-only batch imports
- manual manifest review before DB commit

### Not safe to automate yet without extending the importer

- many artists in one batch with separate artist rows
- cover-art-sensitive imports
- fully unattended import straight from Drive to production DB
- assuming filename parsing will create correct per-track artist records automatically

---

## If a follow-up implementation is approved later

The next most valuable upgrade would be:

1. extend `build_tracks_manifest.py` to parse `artist_name` + `title` from `Artist - Title.ext`
2. extend `import_tracks_to_db.py` to create/find artists per row
3. optionally compute/store `file_hash`
4. optionally support CSV editing before commit as a human review gate

That would turn this from a viable single-artist migration path into a safer general-purpose catalog importer.

---

## Exact first move for task 199

For the real first batch, DJ Papzin should:

1. create a small Google Drive folder with **5–10 Papzin mixes only**
2. rename files to **`Artist - Title.ext`**
3. fill `.migration.first-batch.env` from `scripts/migration/first-batch.env.example`
4. run `bash scripts/migration/drive_to_b2_sync.sh`
5. build and inspect the manifest before any DB commit

That is the current viable Path A.
