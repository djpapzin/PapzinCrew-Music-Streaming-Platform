param(
  [Parameter(Mandatory = $true)]
  [string]$ServiceName,
  [string]$RenderPath
)

$ErrorActionPreference = 'Stop'

function Get-RenderPath {
  param([string]$Override)
  if ($Override -and (Test-Path $Override)) { return $Override }
  try {
    $cmd = Get-Command render -ErrorAction Stop
    if ($cmd -and (Test-Path $cmd.Source)) { return $cmd.Source }
  } catch {}
  $candidate = Join-Path $env:LOCALAPPDATA 'Programs/Render/render.exe'
  if (Test-Path $candidate) { return $candidate }
  throw "Render CLI not found. Install it or provide -RenderPath."
}

$render = Get-RenderPath -Override $RenderPath

Write-Host "Using Render CLI: $render" -ForegroundColor Cyan

# Ensure we can query services in the active workspace
$servicesJson = & $render services --output json --confirm
$services = $servicesJson | ConvertFrom-Json
if (-not $services) { throw "No services returned. Ensure you're logged in and workspace is set (render workspace set)." }

# Try exact name match first, then partial
$svc = $services | Where-Object { $_.name -eq $ServiceName } | Select-Object -First 1
if (-not $svc) {
  $svc = $services | Where-Object { $_.name -like "*$ServiceName*" } | Select-Object -First 1
}
if (-not $svc) {
  Write-Host "Available services:" -ForegroundColor Yellow
  $services | ForEach-Object { Write-Host " - $($_.name) [$($_.id)]" }
  throw "Service '$ServiceName' not found."
}
$serviceId = $svc.id
Write-Host "Resolved service '$($svc.name)' to ID: $serviceId" -ForegroundColor Green

# Tail logs. Prefer --service form; fallback to positional.
try {
  Write-Host "Tailing logs (Ctrl+C to stop)..." -ForegroundColor Cyan
  & $render logs --service $serviceId --follow
} catch {
  try {
    & $render logs $serviceId --follow
  } catch {
    Write-Warning "Could not run non-interactive logs. Opening interactive services menu."
    & $render services
  }
}
