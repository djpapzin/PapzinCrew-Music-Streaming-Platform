# Drive -> B2 -> DB Migration Runbook

This folder provides an executable migration path for bulk track ingest:

1. Sync files from Google Drive to Backblaze B2 (`rclone`)
2. Build a manifest (JSON/CSV)
3. Import missing rows into `mixes` table (idempotent by `file_path`)

---

## 0) Prerequisites

```bash
# Ubuntu/Debian (example)
sudo apt-get update
sudo apt-get install -y rclone python3 python3-pip

# Optional duration metadata extraction
pip install mutagen

# DB insert script dependency
pip install sqlalchemy psycopg2-binary
```

> If your DB is SQLite only, `psycopg2-binary` is not required.

---

## 1) Configure rclone remotes (Google Drive + B2)

### 1.1 Configure Google Drive remote (name: `gdrive`)

```bash
rclone config
# n) New remote
# name> gdrive
# Storage> drive
# client_id / client_secret: optional (blank is okay)
# scope> drive.readonly (or drive if needed)
# root_folder_id> (optional specific folder ID)
# service_account_file> (optional)
# auto config> yes (or no for headless flow)
# confirm and save
```

### 1.2 Configure Backblaze B2 remote (name: `b2`)

```bash
rclone config
# n) New remote
# name> b2
# Storage> b2
# account> <B2_KEY_ID>
# key> <B2_APPLICATION_KEY>
# endpoint> (optional; default usually fine)
# save
```

### 1.3 Verify remotes

```bash
rclone lsd gdrive:
rclone lsd b2:
```

---

## 2) Environment variables (no hardcoded secrets)

Set these in shell or `.env` before running scripts:

```bash
# rclone sync settings
export DRIVE_REMOTE="gdrive"
export DRIVE_PATH="PapzinCrewUploads"         # folder in Google Drive
export B2_REMOTE="b2"
export B2_BUCKET="papzincrew"
export B2_PREFIX="audio/migration"            # destination prefix inside B2 bucket

# optional performance/retry tuning
export RCLONE_TRANSFERS=8
export RCLONE_CHECKERS=16
export RCLONE_RETRIES=12
export RCLONE_LOW_LEVEL_RETRIES=32
export RCLONE_RETRY_SLEEP="10s"

# DB import settings
export DATABASE_URL="postgresql+psycopg2://user:pass@host:5432/dbname"  # or SQLALCHEMY_DATABASE_URL
export MIGRATION_ARTIST_ID=1                      # optional if already known
export MIGRATION_DEFAULT_ARTIST_NAME="PapzinCrew Migration"
export B2_PUBLIC_BASE_URL="https://f002.backblazeb2.com/file/papzincrew"
```

---

## 3) Run migration in order

### Step A: Sync Drive -> B2

```bash
bash scripts/migration/drive_to_b2_sync.sh
```

Outputs:
- `logs/migration/drive_to_b2_sync_<timestamp>.log`
- `logs/migration/b2_lsjson_<timestamp>.json`
- `logs/migration/b2_lsf_<timestamp>.txt`

### Step B: Build manifest

From latest `lsjson` output:

```bash
python scripts/migration/build_tracks_manifest.py \
  --lsjson logs/migration/b2_lsjson_<timestamp>.json \
  --b2-prefix "$B2_PREFIX" \
  --artist-id "${MIGRATION_ARTIST_ID:-}" \
  --out-json logs/migration/tracks_manifest.json \
  --out-csv logs/migration/tracks_manifest.csv
```

Alternative inputs:

```bash
# from lsf
python scripts/migration/build_tracks_manifest.py --lsf logs/migration/b2_lsf_<timestamp>.txt

# from local synced folder (if you staged files locally)
python scripts/migration/build_tracks_manifest.py --local-dir /path/to/synced/files
```

### Step C: Import to DB (dry-run first)

```bash
python scripts/migration/import_tracks_to_db.py \
  --manifest logs/migration/tracks_manifest.json \
  --database-url "$DATABASE_URL" \
  --base-public-url "$B2_PUBLIC_BASE_URL"
```

Commit mode:

```bash
python scripts/migration/import_tracks_to_db.py \
  --manifest logs/migration/tracks_manifest.json \
  --database-url "$DATABASE_URL" \
  --base-public-url "$B2_PUBLIC_BASE_URL" \
  --commit
```

---

## 4) Verification checklist

### B2 verification

```bash
rclone lsf -R "${B2_REMOTE}:${B2_BUCKET}/${B2_PREFIX}" | head
rclone size "${B2_REMOTE}:${B2_BUCKET}/${B2_PREFIX}"
```

### DB verification

```sql
-- Count imported records by migration tag
SELECT COUNT(*) FROM mixes WHERE tags = 'migration';

-- Sample recent inserts
SELECT id, title, file_path, artist_id
FROM mixes
WHERE tags = 'migration'
ORDER BY id DESC
LIMIT 20;
```

Idempotency check: rerun import with same manifest; `skipped_existing` should increase and no duplicates should be created.

---

## 5) Rollback notes

### DB rollback

If wrong rows were inserted and you used migration tag:

```sql
DELETE FROM mixes WHERE tags = 'migration';
```

Or targeted rollback by path prefix:

```sql
DELETE FROM mixes
WHERE file_path LIKE 'https://f002.backblazeb2.com/file/papzincrew/audio/migration/%';
```

### B2 rollback (delete uploaded prefix)

```bash
# Dry run first
rclone delete "${B2_REMOTE}:${B2_BUCKET}/${B2_PREFIX}" --dry-run

# Then execute
rclone delete "${B2_REMOTE}:${B2_BUCKET}/${B2_PREFIX}"
```

---

## Script quick reference

- `drive_to_b2_sync.sh`  
  Reliable Drive -> B2 sync with retry and logs.
- `build_tracks_manifest.py`  
  Generates normalized JSON/CSV manifest from `lsjson`/`lsf`/local dir.
- `import_tracks_to_db.py`  
  Imports only missing rows (unique by `file_path`), dry-run by default.
