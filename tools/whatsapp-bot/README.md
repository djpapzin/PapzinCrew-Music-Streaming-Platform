# WhatsApp private pilot (development only)

Baileys is an unofficial WhatsApp Web client. Keep the bot on its separate number and test in a small private group before any community rollout. This package currently performs **pairing only**: no incoming-message handler, replies, group joins, history collection or automatic moderation. Linking is not registration: WhatsApp must already be registered on the phone.

Use Node 20 or newer, `npm ci`, then set `WA_BOT_PHONE` to international digits (no leading +) and `WA_AUTH_DIR` to an absolute private directory outside the repository. Run `npm run pair`. On the bot phone: WhatsApp → Linked devices → Link a device → Link with phone number instead. Enter the displayed code. The process exits after linking or five minutes; it is not a running bot service.

Session files allow account access. Keep their directory 0700, files 0600, out of Git, logs, shared folders and screenshots. To revoke, unlink the device from the phone, stop the pilot, then remove that pilot's session directory. Do not log message text or credentials.

The answer engine lives separately at backend/app/services/help_assistant.py. A future transport needs an explicit private test-chat allowlist, command-only replies, deduplication, rate limits and a default-off send switch before it can be enabled. No paid AI services are required. Nothing here deploys the website or changes Backblaze caps.

## One-to-one reply test

`pilot.mjs` is an explicit opt-in, 30-minute session with a maximum of 20 replies. Set `WA_ENABLE_TEST_REPLIES=1`, `WA_TESTER_PHONE` to the approved tester's international digits, and `WA_BOT_PHONE` to the linked bot's digits. Set `WA_AUTH_DIR`, `WA_CATALOG_FILE` and `WA_PYTHON` to absolute paths; Python's `PYTHONPATH` must point at the isolated development answer engine. No web API route or production backend changes are needed.

Only fresh `!crew` commands from that tester in one-to-one chat are answered. Examples: `!crew what is Papzin & Crew?`, `!crew music won't play`, `!crew downloads`, `!crew Many More`. All groups, other senders, history, media and outgoing/self messages are ignored. Five seconds between commands; duplicates are not retried. The process stops on disconnect and does not auto-restart. Message text and phone numbers are not logged or persisted by the application; account/session state is kept in private files for linking.

The catalog file is a read-only snapshot of public API records, reduced to public ID, title, artist and created date. Do not put a database export or unlisted/private records there. Only canonical site links can be sent; source-storage URLs are excluded. Refresh the snapshot before a new test. Existing tracklists, music, feedback, caps and website deployments are untouched.

The tester number must be supplied by DJ Papzin before replies are enabled. Do not choose a number from contacts or message anyone to recruit testers. No community rollout is included in this pilot.
