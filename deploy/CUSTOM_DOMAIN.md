# Papzin & Crew domains

- Production: https://mixes.djpapzin.com, built from `main` on the `papzincrew` Netlify project.
- Development: https://crew.djpapzin.com, built from `dev` on a separate Netlify project.

Cloudflare manages the DNS-only CNAMEs. Netlify issues the HTTPS certificates. Both frontends proxy `/api/*` to `papzincrew-api.djpapzin.com`, so use an isolated backend for development tests that write data.

The existing `papzincrew.netlify.app` public URLs redirect to the matching path on `mixes.djpapzin.com`. Keep the API proxy ahead of the redirect so older clients can still reach the API. Both named HTTPS origins are supported for direct API recovery and owner sessions. If the backend defines an explicit `ALLOWED_ORIGINS` list, include both domains in it.

Before repointing `crew.djpapzin.com`, verify the production domain over HTTPS, including catalog loading, mix playback and owner access. The root and `www` domains serve the personal portfolio.
