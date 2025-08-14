# Backend Management Tools

This directory contains utility scripts for managing the PapzinCrew Music Streaming Platform's backend, focusing on database maintenance and storage operations.

## 🛠️ Available Tools

### 1. `delete_track.py`
**Purpose**: Completely remove a track and its associated files.

**Features**:
- Deletes audio file from B2 storage
- Removes local cover art files
- Cleans up database entry
- Provides detailed logging with emoji indicators

**Usage**:
```bash
python delete_track.py <track_id>
```

**Example**:
```bash
python delete_track.py 42
```

---

### 2. `migrate_local_to_b2.py`
**Purpose**: Migrate locally stored audio files to Backblaze B2 cloud storage.

**Features**:
- Processes single tracks or all local tracks
- Preserves file structure with configurable key prefixes
- Updates database references automatically
- Supports dry-run mode for previewing changes

**Usage**:
```bash
# Migrate all local tracks to B2
python migrate_local_to_b2.py --all

# Migrate a specific track
python migrate_local_to_b2.py --id 42

# Preview changes without modifying anything
python migrate_local_to_b2.py --all --dry-run

# Custom B2 key prefix
python migrate_local_to_b2.py --all --key-prefix "audio/2024"
```

**Environment Variables**:
- `UPLOAD_DIR`: Local directory containing uploads (default: 'uploads')
- `B2_*`: Standard Backblaze B2 credentials

---

### 3. `scan_prune_tracks.py`
**Purpose**: Scan for and optionally remove unplayable tracks.

**Features**:
- Identifies tracks with missing local files
- Distinguishes between local and remote (B2) storage
- Provides detailed report of track status
- Safe preview mode (default) and destructive delete mode

**Usage**:
```bash
# Scan and report unplayable tracks
python scan_prune_tracks.py

# Remove unplayable tracks from database
python scan_prune_tracks.py --delete

# Specify custom upload directory
python scan_prune_tracks.py --upload-dir /path/to/uploads
```

---

## 🔧 Common Requirements

- Python 3.8+
- Database connection (via environment variables)
- Backblaze B2 credentials (for B2 operations)
- Required Python packages (install from `../requirements.txt`)

## ⚠️ Important Notes

1. **Backup your database** before running destructive operations
2. Use `--dry-run` when available to preview changes
3. Database operations are atomic - they will roll back on errors
4. Logs include emoji indicators for better visibility

## 📝 License

Part of the PapzinCrew Music Streaming Platform - See main repository for license information.
