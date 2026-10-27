# Beta feedback inbox

Header: Feedback (speech bubble on mobile), no account required. Testers enter a
problem description and optional name. The form shows the included page path and
coarse device type. No queries, fragments, cookies, playback logs, screenshots,
email addresses or user agents are collected automatically. Warns against
including passwords/private details. Reports stay private and are never emailed.

Owner: /admin → Owner analytics → enter existing owner key → Load feedback.
Newest 100 reports are displayed as plain React text; there is no public listing.
Storage: FEEDBACK_DIR (default /var/lib/papzincrew/feedback) on existing VPS state
disk, outside served upload paths. Directory 0700, records 0600, atomic writes.
No database migration, new service or Backblaze storage/download is required.

Bounds: 10–3000 character message, optional name ≤80, body ≤16KB, honeypot,
global 30 reports/hour and 1000 total records; reject rather than silently drop.
UUID idempotency preserves one report across uncertain-connection retries.
Failure keeps the message in memory for retry; closing/reloading the page does
not persist it. No reports are deleted automatically. On inbox full, owner can
archive reviewed reports outside the active directory under the same privacy
controls. This small beta inbox is not an internet-scale anti-spam service.
