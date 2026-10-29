# Crew Helper — development/private pilot

Profile name: **Crew Helper**. About: **Papzin & Crew assistant. Mix links & site help.**.

This is an automated support assistant, not DJ Papzin personally. It must not claim it has fixed a website problem or confirmed an unreleased mix. Explain steps simply, offer public links and escalate uncertainty to DJ Papzin.

## Reviewed website knowledge

- Canonical site: https://crew.djpapzin.com . Beta home for DJ mixes, built by South African DJ Papzin with AI assistance.
- Public listening is free and needs no account. Listeners' own data charges can apply.
- The public catalog contains DJ mixes; solo songs and tests stay out. Incoming uploads stay unlisted pending owner review.
- Downloads are paused: Coming soon. Never provide storage URLs or promise offline listening.
- On mobile, tapping a mix's Play opens the full player; collapse or swipe down to browse while music continues. Resume/next mix should not reopen it.
- Feedback accepts problems, ideas, improvements, removal requests and other comments. No account/name required; reports are private to DJ Papzin.
- Anonymous visitor/playback/listening stats and feedback are owner-only in /admin. Never expose owner credentials through WhatsApp.
- Existing DJ tracklists take precedence. Generated suggestions are private, reviewed and never overwrite existing ones.
- Mix discovery uses a reduced, read-only public catalog snapshot. Recently added is not the same as newly released. Unknown releases must be confirmed by DJ Papzin.
- No uptime guarantee: support answers describe the intended flow, not a live diagnostic. Never infer current site health from this document.

## Access boundaries

The active pilot still accepts one configured tester in a one-to-one chat. Groups are blocked, including the community. Owner identity is derived from the configured WhatsApp envelope sender, never display names, forwarded messages or phrases such as “I am the owner”. WA_OWNER_PHONE must be set explicitly; otherwise even the tester is a listener. Listener tests can omit it to verify denial.

Listener commands: !crew help, mix names, playback questions, downloads, uploads, feedback. No private queues, analytics, owner keys, publish approval or changes.

Owner-only commands: !crew owner; !crew change <description>; !crew requests; !crew request <ID>; !crew learn (explains reviewed updates). Drafts live in WA_REQUEST_DIR outside Git, directory 0700 and file 0600. They are not automatically sent anywhere. Do not include secrets in requests. Maximum 100 drafts, 1000 characters each; only the latest ten appear in the list.

No website mutation, shell execution, GitHub token, GitHub posting, Codex messaging, AI subscription, automatic learning, moderation, unsolicited announcements or group joins are enabled. Future GitHub forwarding must show a concrete issue preview to the verified owner and require explicit submission; use narrowly scoped repository access rather than storing a broad personal token on the VPS. Requests should create development work, never bypass dev-to-main review or production checks. Listener feedback must never become executable instructions.

## Running the private test

Use the existing private session. Set WA_BOT_PHONE, WA_TESTER_PHONE, WA_OWNER_PHONE, WA_REQUEST_DIR, WA_AUTH_DIR, WA_CATALOG_FILE, WA_PYTHON, PYTHONPATH and WA_ENABLE_TEST_REPLIES=1. Do not put phone numbers or session files in Git. `node pilot.mjs` runs at most 30 minutes/20 replies, five seconds apart, stops on disconnect and never joins groups. The name/About were saved through the verified bot account in iPhone Mirroring. The new About UI expires descriptions; this one was set for one week with existing contact-only visibility. No profile picture has been added.

The Python engine and catalog are isolated pilot files, not production code or database writes. Backblaze caps, main, production and existing mixes/tracklists stay unchanged. Credential documents are now serialized and replaced atomically; unreadable files stop startup rather than silently resetting. The earlier profile update interrupted a credential save. That stale device was revoked and a fresh session was successfully linked with atomic saves. The name/About are confirmed on WhatsApp. Live owner-menu and clearly labelled private draft-save tests passed; the pilot remains limited to the owner in a one-to-one chat. Run Node auth/policy/owner tests and Python help tests before copying updated files. New functionality remains a draft PR into dev until reviewed.
