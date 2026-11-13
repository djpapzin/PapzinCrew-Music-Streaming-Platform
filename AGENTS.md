# Papzin & Crew release workflow

- `main` is the stable production branch. The live Netlify site deploys from `main`; the VPS backend is deployed separately and must match approved backend changes.
- `dev` is the integration branch for future work. Start feature/fix branches from `dev`, open pull requests into `dev`, and run CI there. Promote tested changes with a pull request from `dev` into `main`.
- Do not push directly to `main` or bypass its required checks. Production fixes also need a pull request; carry any production hotfix back into `dev`.
- Keep the shared main clone at `/Users/djpapzin/Projects/PapzinCrew-Music-Streaming-Platform` on `main`. Use a separate worktree for changes and preserve existing work.
- Keep new features, including the proposed WhatsApp question/link/troubleshooting assistant, off production during stabilization. Prioritize reproducible failures over new features until the beta is stable.
- Netlify previews currently share the production API. A frontend preview is not an isolated development database or backend. Use local/isolated backend tests for writes; do not create public test mixes or change real listener data from previews.
- Before promotion, verify CI, catalog loading, muted playback, mobile player behavior, feedback privacy and owner access, and the currently disabled downloads. Keep test uploads unlisted, generated tracklists private, existing tracklists and audio quality unchanged, and Backblaze $0 caps unchanged.
- Use only the local Codex in-app browser for browser checks; leave Safari alone. Do not send WhatsApp/social messages without explicit user authorization.

## Approved playback release scope — 3 November 2026

DJ requested automatic continuation and an approximately ten-second mix-in transition as a follow-up to the Next-playback fix, after approving merge/deployment once checks pass and live verification. This requested playback work is the specific exception to the stabilization feature freeze for this release. Promote through dev and a reviewed main PR only after CI and muted browser playback checks pass; verify the published version live. Other new features remain off production. Physical iPhone audible/background/lock-screen validation must be reported separately from browser emulation.

## Approved existing-mix sharing release — 13 November 2026

DJ explicitly approved “lets merge n deploy” for the reviewed existing-public-mix
sharing desk (issue #122, implementation PR #123, production promotion PR #124).
This is a narrow exception to the earlier stabilization feature freeze: promote
this owner-only, draft-only sharing feature through reviewed dev/main PRs and
verify its live access and copying behavior. Public uploads remain paused; no
new media storage, paid AI, group sending or automatic publication is authorized.
Other features remain outside this release scope.
