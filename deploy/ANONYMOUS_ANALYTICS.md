# Anonymous beta analytics

Existing VPS only; no external analytics SDK or paid service. Daily UTC aggregate
files in /var/lib/papzincrew/anonymous-stats (ANONYMOUS_STATS_DIR override), outside
served paths, 0700 directory/0600 files. Retention 30 days, pruning on collection.
No visitor/event IDs, IPs, names, user agents, URLs, referrers or raw event history
are stored in analytics. Hosting/proxy operational access logs remain separate.

Visits are per-tab sessions, at most one per 30 minutes between page loads. They
are not unique people, returning-user counts or cross-device tracking. A timestamp
in sessionStorage prevents reload inflation; no identifier/cookie is created.
Admin landings and deploy previews are excluded from visit collection.
Settings offers an opt-out (boolean only); DNT/GPC disable all event sending.
Stats are best effort: ad blockers, browser termination, offline use and timer
throttling can lose measurements. No offline queue or retries.

Player: request → first playing event startup, with resumes separately counted.
Failed requests/media errors counted once per request; cancelled plays excluded
from failures. Listening uses playing wall time, excludes pauses/seeks/buffering,
flushes every 15 seconds and on stop/pagehide, capped at 30 seconds per flush.
Muted playback counts and cannot establish whether someone actually heard it.
No full audio URLs, titles, error text or existing local playback logs are sent.

Owner only: Admin → Owner analytics → private key → Load anonymous stats.
Last 30 days summary plus per-mix totals. Public collector cannot read stats.
Payload ≤1KB, enum validation, 50,000 events/day and 5,000 mix IDs/day hard caps.
Public counts can be spoofed; these are directional beta metrics, not billing data.
Catalog, tracklists, music files and Backblaze limits are unchanged.
