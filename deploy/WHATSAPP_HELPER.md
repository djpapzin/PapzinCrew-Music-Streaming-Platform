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

Owner-only commands: !crew owner; !crew change <description>; !crew requests; !crew request <ID>; !crew learn (explains reviewed updates). Drafts live in WA_REQUEST_DIR outside Git, directory 0700 and file 0600. They remain private until the owner reviews !crew preview <ID> and explicitly sends !crew submit <ID> CONFIRM. The repository is PUBLIC, and the preview warns of this. !crew sync <ID> reconciles an uncertain result without posting again. Repeated submissions of a recorded issue return its link. Ambiguous network results pause posting until reconciliation; a repeated request never blindly creates another issue. Do not include secrets in requests. Maximum 100 drafts, 1000 characters each; only the latest ten appear in the list.

No website mutation, arbitrary shell execution, Codex messaging, AI subscription, automatic learning, moderation, unsolicited announcements or group joins are enabled. GitHub forwarding uses the VPS’s existing authenticated GitHub CLI without copying or exposing credentials. The adapter has fixed issue-only API endpoints for djpapzin/PapzinCrew-Music-Streaming-Platform; it has no code, workflow, branch or merge operations. Existing CLI authentication may have broader account permissions; those permissions have not been expanded or presented as a new narrowly scoped token. A dedicated GitHub App is a possible later improvement. The public issue preview and explicit owner confirmation are required before posting. Requests should create development work, never bypass dev-to-main review or production checks. Listener feedback must never become executable instructions.

## Running the private test

Use the existing private session. Set WA_BOT_PHONE, WA_TESTER_PHONE, WA_OWNER_PHONE, WA_REQUEST_DIR, WA_AUTH_DIR, WA_CATALOG_FILE, WA_PYTHON, PYTHONPATH and WA_ENABLE_TEST_REPLIES=1. Do not put phone numbers or session files in Git. `node pilot.mjs` defaults to at most 30 minutes/20 replies, five seconds apart, stops on disconnect and never joins groups. WA_OWNER_SERVICE=1 requires tester==owner, permits 20 replies per rolling 30-minute window, and uses systemd for reconnects. Logout exits 78 and stops for owner relinking. The papzincrew-whatsapp-owner.service unit uses existing VPS resources, a 256 MB memory ceiling, read-only application files, private temporary storage and no new incoming port. Its private environment file stays outside Git. WA_ENABLE_GITHUB_ISSUES=1 enables issue forwarding; unset it to keep drafts local. The name/About were saved through the verified bot account in iPhone Mirroring. The new About UI expires descriptions; this one was set for one week with existing contact-only visibility. No profile picture has been added.

The Python engine and catalog are isolated pilot files, not production code or database writes. Backblaze caps, main, production and existing mixes/tracklists stay unchanged. Credential documents are now serialized and replaced atomically; unreadable files stop startup rather than silently resetting. The earlier profile update interrupted a credential save. That stale device was revoked and a fresh session was successfully linked with atomic saves. The name/About are confirmed on WhatsApp. Live owner-menu and clearly labelled private draft-save tests passed; the pilot remains limited to the owner in a one-to-one chat. Run Node auth/policy/owner tests and Python help tests before copying updated files. New functionality remains a draft PR into dev until reviewed.

## Plain-language listener version

WA_NATURAL_CHAT=1 accepts ordinary text from the configured owner/tester and any explicitly approved WA_LISTENER_PHONES list (comma-separated international digits). No listener numbers are enabled by this change. Other senders and every group remain blocked. Owner role comes from the verified sender, never a display name or message claim. Natural conversation never invokes owner commands or GitHub submission; the explicit owner command path remains separate.

Listeners can ask for a mix by name, describe playback trouble, ask about releases or say “I have a suggestion”. Feedback is conversational: ask for the message, show its exact text, and save only after yes. Cancel or ten minutes without a reply discards the in-memory draft. Sensitive-looking input is refused. Reports contain no automatic sender name/phone or chat history and are saved privately in listener-feedback.json inside WA_REQUEST_DIR (0600), capped at 500. The owner can say “show feedback” to read the latest five. This is separate from the website Feedback inbox; the bot does not claim to notify the owner immediately or change the website. No paid AI provider is used. Reviewed patterns handle common questions; unrecognised wording may need clarification.

Before inviting listeners, test with an explicitly approved small contact list. Community-group access, announcements, moderation and unsolicited messages are not enabled by this change. The website and main remain unchanged.


## Release assistant rollout

The next private feature is documented in tools/whatsapp-bot/README.md. Owner-only release cards hold teaser, artwork, title, DJ credit, date and canonical listening link. Start with Guest 48, credited to Mr Dominate SA, on Friday 30 October 2026. Its listing is already owner-approved/public; group announcements still need separate approval.

First stage: prepare and preview privately, accept the owner's MP4/JPEG/PNG attachments, and require an exact preview approval. Enable this private workflow only after DJ approves the bot deployment. Keep group sending disabled, group config absent, community groups unjoined, and main unchanged. Existing listener help/feedback and GitHub owner-request controls retain their permissions.

Later stage: DJ identifies the exact groups; configure only those recipients after explicit approval. Each announcement needs a fresh preview naming those groups, explicit approval of that version, and a separate send instruction. There is no automatic schedule, broadcast, group join or paid AI call. Feedback continues in the existing private listener-feedback flow; this feature does not claim to read community conversations or automatically collect group replies.


### Private deployment approved — 30 October 2026

DJ approved enabling the release assistant in the existing private owner chat with Guest 48 and the original teaser. The private VPS service is connected with `WA_RELEASE_ASSISTANT=1`, `WA_RELEASE_GROUP_SEND=0`, and no group configuration. Guest 48 was freshly seeded and its teaser attached; no preview approvals or delivery attempts were copied from the simulated test. All 32 bot tests passed against the deployed files. No groups were added or messaged; main and the public website were unchanged.

DJ can now send “prepare guest48”, “preview guest48 teaser” and “preview guest48 launch” in the existing private chat. Artwork is not seeded; the launch preview is text-only unless DJ attaches artwork. Group sending remains a later, separate explicit approval.


### Live private commands verified — 30 October 2026

The owner authorised sending the three test commands. Desktop WhatsApp was blocked by a low-storage warning, so the test used the existing signed-in Codex in-app WhatsApp Web session. Initial commands exposed a transport filter rejecting device-suffixed LID addresses. The filter now normalises numeric linked-device suffixes while preserving the same verified owner/listener allowlists and group block; a regression test covers unknown senders and group spoofing.

After the fix, prepare guest48 returned its title, Mr Dominate SA credit and date; preview guest48 teaser returned the draft plus the actual video privately; preview guest48 launch returned the announcement with canonical mix link. No approve/send commands were issued. Group sending remains off, no recipients are configured, and main is unchanged. Temporary diagnostics recorded envelope shape only and were removed after verification. All 33 private bot tests passed.
