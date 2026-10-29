# WhatsApp private pilot (development only)

Baileys is an unofficial WhatsApp Web client. Keep the bot on its separate number and test in a small private group before any community rollout. Pairing is separate from the explicitly enabled private reply service below. Groups, history collection and automatic moderation remain blocked by default. Linking is not registration: WhatsApp must already be registered on the phone.

Use Node 20 or newer, `npm ci`, then set `WA_BOT_PHONE` to international digits (no leading +) and `WA_AUTH_DIR` to an absolute private directory outside the repository. Run `npm run pair`. On the bot phone: WhatsApp → Linked devices → Link a device → Link with phone number instead. Enter the displayed code. The process exits after linking or five minutes; it is not a running bot service.

Session files allow account access. Keep their directory 0700, files 0600, out of Git, logs, shared folders and screenshots. To revoke, unlink the device from the phone, stop the pilot, then remove that pilot's session directory. Do not log message text or credentials.

The answer engine lives separately at backend/app/services/help_assistant.py. A future transport needs an explicit private test-chat allowlist, command-only replies, deduplication, rate limits and a default-off send switch before it can be enabled. No paid AI services are required. Nothing here deploys the website or changes Backblaze caps.

## One-to-one reply test

`pilot.mjs` is an explicit opt-in, 30-minute session with a maximum of 20 replies. Set `WA_ENABLE_TEST_REPLIES=1`, `WA_TESTER_PHONE` to the approved tester's international digits, and `WA_BOT_PHONE` to the linked bot's digits. Set `WA_AUTH_DIR`, `WA_CATALOG_FILE` and `WA_PYTHON` to absolute paths; Python's `PYTHONPATH` must point at the isolated development answer engine. No web API route or production backend changes are needed.

Only fresh `!crew` commands from that tester in one-to-one chat are answered. Examples: `!crew what is Papzin & Crew?`, `!crew music won't play`, `!crew downloads`, `!crew Many More`. All groups, other senders, history, media and outgoing/self messages are ignored. Five seconds between commands; duplicates are not retried. The process stops on disconnect and does not auto-restart. Message text and phone numbers are not logged or persisted by the application; account/session state is kept in private files for linking.

The catalog file is a read-only snapshot of public API records, reduced to public ID, title, artist and created date. Do not put a database export or unlisted/private records there. Only canonical site links can be sent; source-storage URLs are excluded. Refresh the snapshot before a new test. Existing tracklists, music, feedback, caps and website deployments are untouched.

The tester number must be supplied by DJ Papzin before replies are enabled. Do not choose a number from contacts or message anyone to recruit testers. No community rollout is included in this pilot.

## Owner profile and requests

See deploy/WHATSAPP_HELPER.md for the profile, reviewed facts and role boundaries. Set WA_OWNER_PHONE explicitly to the verified owner and WA_REQUEST_DIR to an absolute private directory. Without the matching owner number, owner commands are denied. Only private change drafts are stored; there is no GitHub posting, Codex messaging or code execution. The pilot remains restricted to the configured tester and blocks every group. Run `npm test` for listener and owner access checks.

## GitHub change requests

1. `!crew change <what should change and why>` saves a private draft.
2. `!crew preview <ID>` shows the exact issue title/body and PUBLIC repository destination.
3. `!crew submit <ID> CONFIRM` posts that preview and returns the issue link.
4. `!crew request <ID>` shows recorded status; `!crew sync <ID>` reconciles an uncertain submission without creating another issue.

Only the verified owner can use these commands. The adapter runs fixed `gh api` issue operations through the existing VPS account, with arguments passed directly (no shell interpolation). It cannot push code, dispatch a coding workflow, merge or deploy. Issues instruct that work belongs on dev and main requires DJ Papzin’s explicit approval. Creating an issue does not implement it. Repository visibility is public; do not submit secrets/private details. No paid models or coding agents are invoked.

For an ongoing owner service, use deploy/papzincrew-whatsapp-owner.service with a private environment file. Persistent mode refuses to start unless the tester and owner numbers match. It keeps groups blocked and limits replies to 20 per 30 minutes. The initial community rollout remains out of scope.

Plain conversation: enable WA_NATURAL_CHAT=1. Try “Hi”, “Send me the Many More mix”, “The music won’t play”, “When is the next mix coming?” or “I have a suggestion”. Feedback is previewed and saved privately only after yes. The owner can say “show feedback”. Optional WA_LISTENER_PHONES is an explicit allowlist; no new contacts or groups are enabled automatically. Natural messages never submit GitHub issues or run owner commands. Full details are in deploy/WHATSAPP_HELPER.md.


## Release assistant (development; off by default)

Set `WA_RELEASE_ASSISTANT=1` only after approval to enable the private workflow. Incoming group messages remain blocked. The existing owner envelope check applies to every release command and attachment; listeners cannot create, inspect, approve or send release drafts. No paid model or media service is used.

- `prepare guest48` — see reviewed release details and missing assets.
- `preview guest48 teaser` / `preview guest48 launch` — see exact text, attachment and selected recipients. The actual attachment is returned in the owner's private chat.
- `approve guest48 teaser` — approve that exact preview, without sending it.
- `send guest48 teaser` — a separate explicit action. It is blocked in the private pilot.
- `!crew release guest48 teaser text <new text>` — edit; prior approval becomes invalid.
- Attach an MP4 video with caption `!crew release guest48 teaser`, or JPEG/PNG cover with caption `!crew release guest48 artwork`.

A new release can be prepared with `!crew release new ID | title | DJ credit | YYYY-MM-DD | https://crew.djpapzin.com/track/ID`. A duplicate ID never overwrites owner edits. Tracklist and alternative-platform links are optional; neither is invented or required. Assets remain private on the existing VPS (0600 files/0700 directory), with 30 MB video and 5 MB cover limits, at most 50 release records, and a 15 GB free-disk floor. The original media bytes are preserved; nothing is uploaded to Backblaze or transcribed/generated through a paid provider.

**Group setup is a separate approval step.** Leave `WA_RELEASE_GROUP_SEND` unset and `WA_RELEASE_GROUPS_FILE` unset in the private test. No group is selected or enabled automatically. After DJ explicitly approves recipient groups, an absolute private JSON config may contain `{key,name,jid}` entries; only configured group IDs can be selected via `!crew release guest48 groups key1,key2`. Set `WA_RELEASE_GROUP_SEND=1` only after that separate approval. Any changed text, attachment or recipient invalidates approval. A current public-catalog check and South Africa release-date check also gate sending. Approval itself never sends or schedules anything.

Delivery attempts are recorded before transmission. Repeat commands do not duplicate a recorded send. If any delivery is uncertain, the batch stops and automatic retries are blocked across restarts; the owner must inspect WhatsApp before any reconciliation. Do not clear delivery markers to force a resend.

Guest 48 first test: release title Cruize Friday Guest 48, credit Mr Dominate SA, date 2026-10-30 SAST, canonical mix 241. The actual user-supplied teaser was tested in an isolated private VPS folder, with group sending disabled and zero group messages. The running bot and website were not changed by that test. Keep original audio, existing tracklists, public catalog and Backblaze $0 caps unchanged.
