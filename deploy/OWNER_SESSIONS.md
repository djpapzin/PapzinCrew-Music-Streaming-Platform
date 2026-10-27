# Remember owner device

Admin → Owner analytics → enter owner key once → optionally check Remember this
private device for 30 days → Unlock admin. Anonymous stats load automatically on
future visits when Owner analytics is expanded. Feedback/draft tools use the same
session. Sign out of admin revokes that device immediately and removes private UI.
Without Remember: browser session cookie, server expiry 8 hours. Remember: fixed
30 days. Browser/private-mode cookie deletion requires unlocking again.

Secure/HttpOnly/SameSite=Strict host-only __Host-papzin-owner cookie, path /.
No owner key or session token in localStorage/sessionStorage. Server stores only
SHA256 of random 256-bit session tokens in OWNER_SESSION_DIR (default private VPS
state directory /var/lib/papzincrew/owner-sessions), 0600 files, 0700 directory.
Each record expires and is bound to a hash of the current owner key; rotating the
key invalidates all sessions. Maximum 100 active devices. No database/paid service.

Session creation requires exact owner key plus approved Origin. Cookie-authenticated
writes and logout require approved Origin (crew.djpapzin.com or old Netlify origin;
additional exact developer origins only through OWNER_SESSION_ORIGINS). Read
endpoints are private/no-store. Legacy header-key clients remain supported.
The same-origin /api Netlify proxy must forward Set-Cookie/Cookie; verify on the
real HTTPS domain. Do not test remembered access on deploy-preview hosts.
