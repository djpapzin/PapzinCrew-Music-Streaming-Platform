# Owner-only tracklist suggestions

Open Catalog overview → Owner analytics. Enter the existing private owner key, then the mix ID under Suggested tracklists. Check the draft before generating one. Only public mixes without either a text tracklist or structured tracklist items are eligible. Test/unlisted/private uploads cannot be scanned.

Generated results are private filesystem drafts, never catalog writes. Copy and review them manually. No approval/publication endpoint is provided and existing tracklists are never replaced. Times are first recognition samples, not exact transition boundaries. Blends, edits and unreleased tracks can be missed.

## Activation — disabled by default

An AudD account is required. Verify unused free credits in that account and leave paid billing/automatic top-up disabled. Do not reuse that token in other tools without reducing this app's remaining allowance. Do not paste tokens into the browser frontend or commit them.

Configure root-only /etc/papzincrew/backend.env:
- AUDD_API_TOKEN: the account token
- AUDD_FREE_REQUEST_BUDGET: verified remaining free credits, capped at 300, default 0
- AUDD_FREE_DOWNLOAD_BYTES: verified available Backblaze free download allowance to allocate, capped at 104857600 (100 MiB), default 0
- TRACKLIST_DRAFT_DIR=/var/lib/papzincrew/tracklist-drafts (outside the public uploads directory)

Keep Backblaze's $0 caps unchanged. No new B2 objects are created. AudD downloads the existing audio URL, so each scan reserves the full file size against the download budget. This conservative reservation does not guarantee AudD never re-fetches a URL; the Backblaze $0 cap is the final protection. Each scan samples 12 seconds per minute, up to 30 samples/first 30 minutes, and reserves all potential provider requests before sending. Files exceeding the remaining allowance are blocked. The 100 MiB ceiling is a pilot limit, not a daily auto-reset.

Usage reservations in usage.json survive restarts, use an exclusive lock and are never refunded after failures/uncertain responses. Existing draft jobs are returned instead of scanned again. No automatic scan or retry occurs. Review failed jobs and provider usage before an operator removes a failed draft or increases any budget. Never reset usage merely to bypass a cap.

Background jobs are intentionally small and single-server. If the service restarts during a scan, a draft may remain queued/scanning. The owner must inspect provider usage before changing it; the app will not retry and risk duplicate charges.
