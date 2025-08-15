# Backend logs: quick reference

This doc shows fast ways to stream backend logs from Render on Windows.

## Prerequisites
- Render CLI installed (render.exe). If not in PATH, it usually lives at:
  `C:\Users\<you>\AppData\Local\Programs\Render\render.exe`.
- PowerShell.

## One‑time setup
```powershell
# Log in (opens browser)
render login

# Set the active workspace (pick the team that owns the service)
render workspace set
```

## Tail logs using the helper script (recommended)
Script: `scripts/tail-logs.ps1`

- By service name (auto‑resolves Service ID):
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\tail-logs.ps1 -ServiceName "papzincrew-backend"
```

- By Service ID (skips discovery; fastest):
```powershell
# Find the ID on the service page in the Render dashboard (looks like srv-xxxxxxxx)
powershell -ExecutionPolicy Bypass -File .\scripts\tail-logs.ps1 -ServiceId "srv_XXXXXXXX"
```

- Optional debug: save raw JSON of `render services` for parsing issues
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\tail-logs.ps1 -ServiceName "papzincrew-backend" -DumpJson
```

## Tail logs directly with Render CLI
If you prefer not to use the script:
```powershell
# List services (interactive list in the terminal)
render services

# Or JSON list for scripting
render services --output json --confirm

# Stream logs (replace with your Service ID)
render logs --resources srv_XXXXXXXX --tail
```

## Troubleshooting
- "Unknown flag: --service": Newer CLI uses `--resources` and `--tail`.
  - Our script already uses the new flags.
- "Service not found":
  - Ensure the correct workspace: `render workspace set`.
  - List services to confirm names/IDs: `render services`.
- "render is not recognized": Restart terminal or use the full path:
  `C:\Users\<you>\AppData\Local\Programs\Render\render.exe`
- No logs / empty list:
  - Confirm the service is deployed and producing logs.

## Security
- Do not share or commit API keys. Prefer `render login` (interactive) locally.
