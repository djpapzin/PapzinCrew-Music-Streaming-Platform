# Owner-only browser upload pilot (inactive)

Issue #111. This is a deployment proposal, not a reopened intake route.
`tools/owner_browser_pilot.py` runs separately from the public backend. No ordinary
app route, frontend flag, owner-session cookie, DNS, firewall or cap is changed.
The public worker remains `UPLOADS_ENABLED=0`; `/intake/upload` stays static 503.

## Observable acceptance

- Unauthenticated or wrong-origin POST never parses a body or enters the handler.
- One authenticated browser XHR crosses the real HTTPS audio-host ingress.
- Only the exact synthetic WAV and original test JPEG hashes below are accepted.
- At most one handler invocation, even with concurrent requests or process restart.
  The 0600 O_EXCL attempt latch is durable; every parsed attempt consumes it.
- 27 MiB request limit checked for both declared and streamed bytes, plus Caddy limit.
- Credential only in a protected operator file and the password field/Authorization
  header; never URL, source, logs, browser storage, Drive or GBrain.
- Fixed TEST ONLY title/artist; forced unlisted, downloads off, AI off, B2 only.
- Real B2 bytes/hash, cover, one unlisted row and unchanged public catalog verified
  separately after HTTP201. The page response alone is not a full acceptance pass.
- Pilot expires after twenty minutes, is stopped and ingress restored after the
  one attempt. Any error/timeout/uncertain result means inspect, never retry.

## Exact approved-write proposal

One 150-second silent stereo WAV, 26,460,044 bytes:
`5dcb8b8c0d5e8cfbc593a28a27f26e2c4d86179ff7389f95345e3ab994056257`.
Original JPEG, 8,042 bytes:
`2a06873538a19bef362d68251acbdfed72756a7ade64d0fb599bb62dcadcf70a`.
Combined input 26,468,086 bytes. Handler may recompress JPEG; compare resulting
cover separately. Maximum two new B2 objects/versions and one unlisted row.
Title `TEST ONLY Large Browser Pilot 20261112`. Never promote synthetic records.
No deletion or cap increase is part of this pilot. Keep earlier test ID242.

Files are in the existing local `outputs/browser-intake-20261112` (WAV) and
`outputs/controlled-intake-20261112` (original JPEG) packets. Do not reuse the
locally recompressed cover. Never repeat this fixture after a matching live row.

## Preconditions and deployment boundary

Do not activate before DJ explicitly approves this reviewed revision's temporary
ingress deployment and the single bounded live write. Recheck unchanged $0 caps,
account-wide storage and all-version byte inventory immediately beforehand.
Historical inventory 9,927,030,356 bytes is not current proof of headroom. Require
at least 30 MiB spare under the verified 10 GB allowance, and at least 100 MiB
remaining free daily downloads for verification. Stop if usage is unavailable.

Confirm current deployed backend hashes match the reviewed release, public worker
paused, no existing fixture hash/title, free disk and B2 read-only health. Save
public catalog snapshot and exact B2 inventory privately. No public data writes
are allowed during preflight. Startup repeats pause, duplicate and health checks.

1. Stage this reviewed script under `/opt/papzincrew/backend/tools/` and the proposed
   `backend/deploy/audio-cache-owner-pilot.Caddyfile` separately, not as active config.
   Retain exact current active config backup/hash; compare with proposal, preserving
   current cached-audio routes/TLS/bind settings. If they drifted, stop and review.
2. Validate candidate with the installed Caddy `validate --config <candidate>`.
   Do not validate by starting a competing listener. Confirm no access logging
   of Authorization headers; this gateway disables Uvicorn access logging.
3. After approval, run one foreground process as root (needed only to read the
   existing worker environment) using the installed backend venv:
   `python tools/owner_browser_pilot.py --serve-approved --provider-caps-verified --state-dir /var/lib/papzincrew-owner-pilot-20261112`.
   Use a protected terminal/session, no shell tracing or environment dump. Root
   directory mode0700; process binds loopback18883 only. A preexisting credential
   file aborts startup rather than restarting/resetting the pilot. Keep a process
   supervisor/terminal handle so the process can always be stopped.
4. Read-only service inspection confirms `CanReload=no`, no ExecReload and admin
   API disabled. After the loopback page check and explicit approval for a brief
   cached-audio interruption, install the candidate and use
   `systemctl restart papzincrew-audio.service`. Do not restart the backend,
   firewall or networking services. Restoration requires the same audio-service
   restart. Save the current config first and restore immediately on any failed
   service health/cached-audio check.
5. Verify cached playback still works, normal intake503, no admin/API proxy route,
   pilot unauthorized401 before giving its credential to the owner browser.
6. In local Codex IAB only, open `https://audio.djpapzin.com/intake/pilot`. Enter the
   protected credential without echoing it, choose exact files and submit ONCE.
   Capture sanitized status screenshot. Never store password-field screenshots.
7. On success or failure, stop the pilot process, restore the exact saved ingress
   config, validate it and apply the same approved reload/restart procedure. Confirm
   normal intake503 and pilot404, cached playback still works and worker pause0.
   Expiry is a backstop, not a substitute for removing the temporary route.
8. Verify exactly one unlisted matching row, audio full hash, cover, exact B2 object
   count/byte delta, unchanged public snapshot, browser-muted playback+seek, then
   pause. Save sanitized receipt and outcome to canonical Drive and GBrain. Keep
   latch/receipt for audit; don't delete catalog/storage records or retry ambiguities.

## Limits of the result

This tests a same-origin operator page through the real audio-host HTTPS ingress
and the existing upload handler. It does not certify production UploadPage's
cross-origin CORS flow, physical-phone selection/background upload, 200 MB files,
or public reopening. The previously rehearsed local UploadPage >25 MiB path is
separate evidence. A public reopening decision still needs its own capacity and
CORS acceptance; do not describe this pilot as public intake ready.

## Validation

`pytest backend/tests/test_owner_browser_pilot.py -q`: authentication/origin/expiry,
declared and chunked size limits, exact-file validation, parallel one-attempt
latch, restart refusal, redacted failures and absence of extra proxy/docs routes.
Tests use stub storage; none contact B2 or production. No app dependency changes.

Prepared validation: 8 isolated tests passed. Candidate validated successfully
with the installed VPS Caddy v2.11.7 via stdin, without activating it. Actual local
IAB selected both full-size fixtures and reached `LOCAL-STUB-ONLY` HTTP201 with
the submit button disabled and credential cleared. This used stub storage: zero
B2/production writes. Screenshot is in the browser-intake output packet.
