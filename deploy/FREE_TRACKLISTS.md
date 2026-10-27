# Free private tracklist suggestions

Owner access only: `/admin`, owner key, Suggested tracklists. Choose ShazamIO,
local reference library or manual suggestions, enter a public mix ID, Check draft.
No public tracklist is created or changed. Each provider has an immutable private
file `<id>-<provider>.json`; legacy `<id>.json` AudD drafts remain readable.
Existing text OR structured tracklists block all new suggestions. Tests and
unlisted/private uploads are excluded. The owner must review identifications;
first detection timestamps are not exact transitions. There is no publish endpoint.

## ShazamIO

Use a separate Python 3.10 environment with `shazamio==0.8.1` (Python 3.10 wheels).
`FREE_TRACKLIST_PYTHON=/opt/papzincrew/recognition-venv/bin/python`.
Requires ffmpeg. This unofficial free client sends fingerprints to Shazam; it
may stop working or be rate limited. One attempt per sample; no bypass or retry.
Up to 12 samples, 12 seconds each, spread across the mix. Nothing is played aloud.
No AudD fallback, API token, payment card or paid recognition service is used.
Set `AUDD_SCANS_ENABLED=0` to disable even direct legacy scan requests.

`FREE_TRACKLIST_SAMPLE_BUDGET` (hard maximum 60) and
`FREE_TRACKLIST_DOWNLOAD_BYTES` (hard maximum 100 MiB) are cumulative allowances.
Default zero disables scans. Reservations in `free-usage.json` are not refunded
on failure. Keep the Backblaze $0 caps; do not automatically reset allowances.
Download once per chosen provider, discard temporary audio, serialize worker jobs.
The worker receives no backend credentials. Manual suggestions need no download.

## Local library (no external recognition service)

Disabled until the operator supplies audfprint and a PRIVATE database of reference
recordings, plus artist/title metadata. It cannot identify music absent from that
library. This is not a global song catalog. Do not upload reference audio to B2.

Set these server-only paths (readable by the backend service):
- `LOCAL_TRACKLIST_SCRIPT`: audfprint.py in a pinned installation of dpwe/audfprint.
- `LOCAL_TRACKLIST_DATABASE`: audfprint fingerprint database (read only).
- `LOCAL_TRACKLIST_METADATA`: JSON mapping exact reference filenames from the
  database to `{"artist":"Artist","title":"Title"}`. Unmapped matches are ignored.

Install audfprint dependencies into the isolated recognition environment. The
adapter runs match with `--find-time-range --max-matches 1 --verbose 1`, requires
at least 10 aligned hashes, and produces private sampled suggestions. Do not
claim the option is ready before providing and validating your reference library.
AcoustID is not enabled: its public free service has non-commercial restrictions
and is not a dependable general DJ-mix matcher.

Manual input: one `MM:SS Artist — Title` or `H:MM:SS Artist — Title` per line,
maximum 200 entries. Stored separately, never overwrites another provider draft.
