param(
  [Parameter(ParameterSetName = 'ByName', Mandatory = $true)]
  [string]$ServiceName,
  [Parameter(ParameterSetName = 'ById', Mandatory = $true)]
  [string]$ServiceId,
  [string]$RenderPath,
  [switch]$DumpJson
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
if (-not $servicesJson) { throw "No JSON output from 'render services'." }
 if ($DumpJson) {
   $tmp = Join-Path $env:TEMP "render-services-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
   $servicesJson | Out-File -FilePath $tmp -Encoding utf8
   Write-Host "Saved raw services JSON to: $tmp" -ForegroundColor Yellow
 }
$root = $servicesJson | ConvertFrom-Json
if (-not $root) { throw "Failed to parse services JSON." }

# Recursively collect candidates that look like service objects
$candidates = [System.Collections.Generic.List[object]]::new()
function Add-Candidates {
  param($node)
  if ($null -eq $node) { return }
  if ($node -is [System.Collections.IEnumerable] -and -not ($node -is [string])) {
    foreach ($item in $node) { Add-Candidates -node $item }
    return
  }
  if ($node.PSObject -and $node.PSObject.Properties) {
    # If it looks like a service (has name and id), record it
    $hasName = $node.PSObject.Properties.Match('name').Count -gt 0
    $hasId = $node.PSObject.Properties.Match('id').Count -gt 0
    if ($hasName -and $hasId) { $candidates.Add($node) }
    foreach ($p in $node.PSObject.Properties) {
      Add-Candidates -node $p.Value
    }
  }
}
Add-Candidates -node $root

if ($candidates.Count -eq 0) {
  Write-Host "No services found in CLI JSON. Raw (truncated):" -ForegroundColor Yellow
  Write-Host ($servicesJson.Substring(0, [Math]::Min(400, $servicesJson.Length)))
  throw "Could not locate service objects. Ensure you're logged in and workspace is set (render workspace set)."
}

# Normalize into simple objects with name/id (stringify to avoid [] display)
$services = $candidates | ForEach-Object {
  $n = $_.name
  $i = $_.id
  if ($n -is [System.Collections.IEnumerable] -and -not ($n -is [string])) { $n = ($n | ForEach-Object { $_ }) -join ' ' }
  if ($i -is [System.Collections.IEnumerable] -and -not ($i -is [string])) { $i = ($i | ForEach-Object { $_ }) -join ' ' }
  [PSCustomObject]@{ name = "$n"; id = "$i" }
}

# Resolve service ID
if ($PSCmdlet.ParameterSetName -eq 'ById') {
  $serviceId = $ServiceId
  $svc = $services | Where-Object { $_.id -eq $serviceId } | Select-Object -First 1
  if (-not $svc) { Write-Host "Warning: Provided ServiceId not found in current workspace listing." -ForegroundColor Yellow }
} else {
  # Try exact name match first, then partial (case-insensitive)
  $svc = $services | Where-Object { $_.name -ieq $ServiceName } | Select-Object -First 1
  if (-not $svc) { $svc = $services | Where-Object { $_.name -ilike "*$ServiceName*" } | Select-Object -First 1 }
  if (-not $svc) {
    Write-Host "Available services (name [id]):" -ForegroundColor Yellow
    $services | Sort-Object name | ForEach-Object { Write-Host " - $($_.name) [$($_.id)]" }
    throw "Service '$ServiceName' not found in active workspace. Try a partial name or run '& $render workspace set'."
  }
  $serviceId = $svc.id
}
Write-Host "Resolved service '$($svc.name)' to ID: $serviceId" -ForegroundColor Green

# Tail logs. Prefer --service form; fallback to positional.
try {
  Write-Host "Tailing logs (Ctrl+C to stop)..." -ForegroundColor Cyan
  & $render logs --resources $serviceId --tail
} catch {
  try {
    & $render logs --resources $serviceId --tail
  } catch {
    Write-Warning "Could not run non-interactive logs. Opening interactive services menu."
    & $render services
  }
}
