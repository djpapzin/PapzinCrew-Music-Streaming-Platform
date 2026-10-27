# VPS API and recovery

The production API can run on the existing Oracle VPS, independent of Render's
monthly free compute allowance. Audio and covers stay in Backblaze B2; the
catalog stays in the existing Neon PostgreSQL database. Do not create an empty
SQLite database or run automatic migrations as part of failover.

## Installed layout

- `/opt/papzincrew/backend`: backend source from the repository.
- `/opt/papzincrew/venv`: isolated Python environment.
- `/etc/papzincrew/backend.env`: existing database/B2 configuration and a stable
  JWT secret, root-owned mode 0600; never commit or log its values.
- `papzincrew-backend.service`: one worker on `127.0.0.1:18882`, dynamic user,
  768 MB memory ceiling and 50% of one CPU. Only its state directory is writable.
- `papzincrew-tunnel.service`: separate Cloudflare tunnel, 256 MB ceiling,
  forwarding only `papzincrew-api.djpapzin.com` to that loopback listener.
  Credentials are loaded through systemd, not command-line tokens.

Install the unit files in `/etc/systemd/system`, validate them, then use
`systemctl enable --now papzincrew-backend papzincrew-tunnel`.
Neither unit requires restarting other VPS services.

The tunnel configuration at `/etc/papzincrew/tunnel.yml` contains its tunnel ID,
the hostname above, the loopback service, and a final `http_status:404` rule.
Use a separate named tunnel and credentials; preserve all existing tunnel routes.

## Checks

`GET /ready` must report a reachable PostgreSQL database. `GET
/tracks/catalog-summary` must show the real catalog (231 public tracks at
migration). Request a small byte range from a known `/tracks/{id}/stream` and
verify status 206, the content range, and audio type. In the live frontend, mute
before playback, verify the time advances, then pause and leave muted.

Keep Backblaze's existing free limits unchanged. Neither a health check nor
successful playback proves new uploads fit within those limits.

## Routing and fallback

All three frontend proxy definitions use the VPS HTTPS origin:
`netlify.toml`, `public/netlify.toml`, and `public/_redirects`. Retain `/api` in
the browser rather than embedding a host in frontend environment variables.

Render remains intact as a manual fallback after its allowance renews. To use
it, first verify its `/ready` and catalog/stream endpoints, then revert all
three proxy origins to `https://papzincrew-backend.onrender.com` and deploy.
There is no automatic retry of write requests across origins: an uncertain
upload must not be duplicated. Both origins use the same catalog and B2 bucket.
Switching origins can require users to sign in again if JWT secrets differ.

To roll back only the VPS deployment, restore frontend routing to a verified
healthy origin first, then disable the two Papzin Crew services. Preserve the
database, B2 objects, environment file, and unrelated services.
