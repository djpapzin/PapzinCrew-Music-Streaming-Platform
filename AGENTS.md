# Papzin & Crew release workflow

- `main` is the stable production branch. The live Netlify site deploys from `main`; the VPS backend is deployed separately and must match approved backend changes.
- `dev` is the integration branch for future work. Start feature/fix branches from `dev`, open pull requests into `dev`, and run CI there. Promote tested changes with a pull request from `dev` into `main`.
- Do not push directly to `main` or bypass its required checks. Production fixes also need a pull request; carry any production hotfix back into `dev`.
- Keep the shared main clone at `/Users/djpapzin/Projects/PapzinCrew-Music-Streaming-Platform` on `main`. Use a separate worktree for changes and preserve existing work.
- Keep new features, including the proposed WhatsApp question/link/troubleshooting assistant, off production during stabilization. Prioritize reproducible failures over new features until the beta is stable.
- Netlify previews currently share the production API. A frontend preview is not an isolated development database or backend. Use local/isolated backend tests for writes; do not create public test mixes or change real listener data from previews.
- Before promotion, verify CI, catalog loading, muted playback, mobile player behavior, feedback privacy and owner access, and the currently disabled downloads. Keep test uploads unlisted, generated tracklists private, existing tracklists and audio quality unchanged, and Backblaze $0 caps unchanged.
- Use only the local Codex in-app browser for browser checks; leave Safari alone. Do not send WhatsApp/social messages without explicit user authorization.
