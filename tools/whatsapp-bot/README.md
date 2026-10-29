# WhatsApp private pilot (development only)

Baileys is an unofficial WhatsApp Web client. Keep the bot on its separate number and test in a small private group before any community rollout. This package currently performs **pairing only**: no incoming-message handler, replies, group joins, history collection or automatic moderation. Linking is not registration: WhatsApp must already be registered on the phone.

Use Node 20 or newer, `npm ci`, then set `WA_BOT_PHONE` to international digits (no leading +) and `WA_AUTH_DIR` to an absolute private directory outside the repository. Run `npm run pair`. On the bot phone: WhatsApp → Linked devices → Link a device → Link with phone number instead. Enter the displayed code. The process exits after linking or five minutes; it is not a running bot service.

Session files allow account access. Keep their directory 0700, files 0600, out of Git, logs, shared folders and screenshots. To revoke, unlink the device from the phone, stop the pilot, then remove that pilot's session directory. Do not log message text or credentials.

The answer engine lives separately at backend/app/services/help_assistant.py. A future transport needs an explicit private test-chat allowlist, command-only replies, deduplication, rate limits and a default-off send switch before it can be enabled. No paid AI services are required. Nothing here deploys the website or changes Backblaze caps.
