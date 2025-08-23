# Data Model

Owner: DJ Papzin  
Last updated: 2025-08-23

Source of truth: `backend/app/models/models.py`

## Entities

### Artist (`artists`)
- `id: int` — PK
- `name: str` — required, indexed
- Relations: `mixes: List[Mix]`

### Mix (`mixes`)
- `id: int` — PK
- `title: str` — required, indexed
- `original_filename: str | null`
- `duration_seconds: int` — required
- `file_path: str` — required, unique. For B2-first, this may be a B2 key or URL; for local fallback, a validated path.
- `cover_art_url: str | null`
- `file_size_mb: float` — required
- `quality_kbps: int` — required
- `bpm: int | null`
- `release_date: datetime` — timezone-aware UTC via `AwareDateTime` (default: now UTC)
- Descriptive fields: `description: str | null`, `tracklist: str | null`, `tags: str | null`, `genre: str | null`, `album: str | null`, `year: int | null`
- Visibility/Policy: `availability: str='public'`, `allow_downloads: str='yes'`, `display_embed: str='yes'`, `age_restriction: str='all'`
- Counters: `play_count: int=0`, `download_count: int=0`
- FKs: `artist_id: int` → `artists.id` (required)
- Relations: `artist: Artist`, `categories: List[Category]` (many-to-many), `tracklist_items: List[TracklistItem]` (cascade delete)

### Category (`categories`)
- `id: int` — PK
- `name: str` — unique, indexed, required
- `description: str | null`
- Relations: `mixes: List[Mix]` (many-to-many via `mix_category`)

### TracklistItem (`tracklist_items`)
- `id: int` — PK
- `track_title: str` — required
- `track_artist: str` — required
- `timestamp_seconds: int` — required (position in the mix)
- FKs: `mix_id: int` → `mixes.id`
- Relations: `mix: Mix`

### Association Table `mix_category`
- Columns: `mix_id (PK, FK)`, `category_id (PK, FK)`

## Relationship Overview
- `Artist (1) ── (many) Mix`
- `Mix (many) ── (many) Category` via `mix_category`
- `Mix (1) ── (many) TracklistItem`

## Notes
- `AwareDateTime` ensures UTC awareness across SQLite/Postgres. SQLite strips tzinfo, so the custom type restores UTC on read and binds as naive UTC on write.
- `file_path` is unique to prevent duplicates at the storage layer. Duplicate detection logic also runs pre-write at upload time.
- Counters (`play_count`, `download_count`) are incremented by streaming/download endpoints.
