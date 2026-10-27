# Papzin & Crew public domain

Primary frontend: https://crew.djpapzin.com
Netlify project: papzincrew (3e62c377-3464-4dd3-b260-54c1c001b2d5)
Cloudflare DNS: crew CNAME papzincrew.netlify.app, DNS only, automatic TTL.
Netlify issues the free HTTPS certificate. The root djpapzin.com and www personal portfolio are unchanged.

API requests use the existing same-origin /api proxy to papzincrew-api.djpapzin.com. Keep the API rule ahead of the host redirect so older open clients remain functional. Public Netlify page links redirect to the matching crew.djpapzin.com path; deploy previews are unaffected. The backend must allow the new exact HTTPS origin for direct catalog recovery.

Music remains in Backblaze, catalog in Neon and backend on the existing VPS. No paid hosting or new storage service is required.
