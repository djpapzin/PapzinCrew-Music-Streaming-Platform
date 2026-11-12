# Guest release desk

Issue #116. Owner-only preparation within `/admin`, using the existing remembered
owner session. The panel lists unlisted catalog entries and records private checks
for release-ready audio, title/guest credit, approved artwork or presentation,
muted playback/hidden discovery and DJ Papzin's separate musical review.

The owner explicitly records final approval. This saves a private preparation
record; it does not publish, schedule, upload or send anything. Canonical mix links
remain unlisted and accessible to anyone holding them. Publication and specific
sharing destinations/time require separate approval. Tracklists and extra platform
links are optional. No supplied metadata or tracklists are edited/generated.

The draft uses only the selected title, artist and canonical link. The owner can
edit it before recording final approval; editing a review clears that approval.
Copy revalidates the current server review to reject stale/withdrawn approvals.
Clipboard access starts synchronously in the user gesture with a promise-backed
ClipboardItem; content resolves only after validation. This follows the WebKit
workaround https://bugs.webkit.org/show_bug.cgi?id=222262. Browsers without this
API receive a manual-copy/reload instruction. Physical iPhone verification remains
separate from local unit/browser tests.
After actual publication, verify the public link before using the copied draft.

Any change to audio URL/hash, title, artist, artwork, duration, original filename,
tracklist or visibility invalidates the saved approval and checks. Stale captions
are regenerated from current metadata; private notes remain recoverable. Saves
require both the current metadata fingerprint and private review revision, so
another device cannot silently overwrite a concurrent save.

Known live synthetic hashes and explicit test/QA names cannot receive final
release approval. This gate never changes visibility and is not a publication API.
Only unlisted entries can be reviewed; private/public mixes are excluded.

Private JSON records use `RELEASE_REVIEW_DIR` (default
`/var/lib/papzincrew/release-reviews`), directory0700/files0600, file locking,
atomic replacement and fsync. Before an authorized deployment, verify this path
is writable by the existing backend service and within its permitted persistent
state directories; configure the environment variable to an existing allowed
private location if required. Do not create root-owned review files manually.
No database migration or paid/external service is required. All routes are under
existing owner auth with private/no-store responses and existing cookie-origin
checks for mutations. Review JSON is never served publicly.

Acceptance: unauthorized API denial, no public/catalog/B2 mutations, durable
private review, stale/concurrent edit rejection, test approval refusal, optional
tracklist/cover-presentation decision, recoverable failed saves, and copying only
a freshly validated final-approved draft. Browser rehearsals use an isolated
local DB/files and synthetic owner session; they are not musical approval for a
real release. Netlify previews share production API and must not be used for test
writes. Production uploads remain paused and Backblaze caps unchanged.
