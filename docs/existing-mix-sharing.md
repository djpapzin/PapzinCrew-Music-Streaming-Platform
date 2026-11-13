# Existing mix sharing

Owner analytics now includes a public-mix sharing desk. Select a published mix,
prepare deterministic short/long captions and edit them privately in memory.
Edits are discarded on leaving or changing the selection; explicit regeneration
requires confirmation. No files, media, catalog changes, AI calls or sends occur.

Only explicit public, non-synthetic mixes qualify. The owner API returns canonical
site links and catalog title/artist, never storage URLs. Missing credits are
labelled; guest identities and handles require owner verification.

Copy starts a promise-backed ClipboardItem within the user gesture, then fetches
fresh authenticated metadata. Changed fingerprints or withdrawn public access
reject copying, mark the draft stale and preserve edits. A successful check is
point-in-time validation; publication can change afterward. Unsupported clipboard
browsers report an error. Sending and destination approval remain separate.

This complements unlisted guest-release reviews; it does not record release
approval or activate the separate WhatsApp runtime from PR41. No deployment or
public upload reopening is included.
