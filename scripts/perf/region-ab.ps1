# scripts/perf/region-ab.ps1
#
# Region A/B measurement helper (read-only GETs only).
#
# Measures per-target latency against a deployed Thriv environment and records
# the Vercel routing headers (`x-vercel-id`, `x-vercel-cache`) so the function
# region (e.g. sin1 vs bom1) is visible in the output.
#
# Usage (Windows PowerShell 5.1, curl.exe required, nothing else):
#   powershell -ExecutionPolicy Bypass -File scripts/perf/region-ab.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/perf/region-ab.ps1 -BaseUrl https://thriv-five.vercel.app -Runs 5
#   powershell -ExecutionPolicy Bypass -File scripts/perf/region-ab.ps1 -Targets '/;/api/products'
#   (-Targets takes a semicolon-separated list when launched with -File)
#
# Notes:
#   * No redirects are followed (-L omitted) - timings are for the first response.
#   * One warm-up pass per target is recorded but excluded from the medians;
#     it absorbs cold starts on first function hit.
#   * A run served from the edge cache (x-vercel-cache: HIT) has no function
#     segment in x-vercel-id; such runs cannot distinguish regions. The script
#     reports the cache status per run so those runs are visible.
#
# This script never writes to the service: only GET requests.

[CmdletBinding()]
param(
    [string]$BaseUrl = 'https://thriv-five.vercel.app',

    [ValidateRange(1, 100)]
    [int]$Runs = 3,

    [ValidateRange(0, 10)]
    [int]$WarmupRuns = 1,

    # Seconds to sleep between consecutive probes OF THE SAME TARGET. Use ~65
    # when targets are ISR-cached (revalidate = 60) and no admin-side
    # invalidation is available: it lets the 60s window lapse so the next hit
    # is function-backed instead of an edge HIT.
    [ValidateRange(0, 600)]
    [int]$PauseSeconds = 0,

    [string[]]$Targets = @(
        '/',
        '/api/products',
        '/order/invalid-token-12345',
        '/admin/login',
        '/product/zara-wide-leg-vintage-wash-denim'
    )
)

$ErrorActionPreference = 'Stop'

# `powershell -File` passes -Targets as a single literal string, so arrays do
# not survive the shell boundary. Accept both: a real array (interactive use)
# and a semicolon-separated string (script use), e.g.
#   -Targets '/;/api/products'
$targetList = @(
    $Targets |
        ForEach-Object { $_ -split ';' } |
        ForEach-Object { $_.Trim() } |
        Where-Object { $_ -ne '' }
)
if ($targetList.Count -eq 0) { throw "No targets supplied." }

$curl = Get-Command curl.exe -ErrorAction SilentlyContinue
if (-not $curl) { throw "curl.exe not found on PATH." }

$base = $BaseUrl.TrimEnd('/')

# Single-quoted: PowerShell must not expand the %{...} placeholders.
$fmt = '%{http_code}|%{time_namelookup}|%{time_starttransfer}|%{time_total}|%{size_download}'

function Get-Median {
    param([double[]]$Values)
    $sorted = @($Values | Sort-Object)
    $n = $sorted.Count
    if ($n -eq 0) { return [double]::NaN }
    if ($n % 2 -eq 1) { return [double]$sorted[[int](($n - 1) / 2)] }
    return ([double]$sorted[$n / 2 - 1] + [double]$sorted[$n / 2]) / 2
}

function Invoke-Probe {
    param(
        [string]$Url,
        [string]$HeaderFile
    )

    if (Test-Path -LiteralPath $HeaderFile) { Remove-Item -LiteralPath $HeaderFile -Force }

    $out = & $curl.Source -s -o NUL -D $HeaderFile --connect-timeout 10 --max-time 30 -X GET $Url --write-out $fmt 2>$null
    $exit = $LASTEXITCODE

    if ($exit -ne 0 -or [string]::IsNullOrWhiteSpace($out)) {
        return [pscustomobject]@{
            HttpCode = 'FAIL'
            TtfbMs   = $null
            TotalMs  = $null
            Bytes    = $null
            Cache    = ''
            VercelId = ''
            FnRegion = ''
        }
    }

    $parts = $out.Trim() -split '\|'
    $id = ''
    $cache = ''
    if (Test-Path -LiteralPath $HeaderFile) {
        $lines = [System.IO.File]::ReadAllLines($HeaderFile)
        for ($i = $lines.Count - 1; $i -ge 0; $i--) {
            $line = $lines[$i]
            if (-not $id -and $line -match '^(?i)x-vercel-id:\s*(.+)$') { $id = $Matches[1].Trim() }
            if (-not $cache -and $line -match '^(?i)x-vercel-cache:\s*(.+)$') { $cache = $Matches[1].Trim() }
        }
    }

    # x-vercel-id format: <edge-region>::<function-region>::<id> for function
    # responses, <edge-region>::<id> for edge-served (static/cached) responses.
    $fnRegion = ''
    $segments = $id -split '::'
    if ($segments.Count -ge 3) { $fnRegion = $segments[1] }

    [pscustomobject]@{
        HttpCode = $parts[0]
        TtfbMs   = if ($parts.Count -gt 2) { [math]::Round([double]$parts[2] * 1000, 0) } else { $null }
        TotalMs  = if ($parts.Count -gt 3) { [math]::Round([double]$parts[3] * 1000, 0) } else { $null }
        Bytes    = if ($parts.Count -gt 4) { [int]$parts[4] } else { $null }
        Cache    = $cache
        VercelId = $id
        FnRegion = $fnRegion
    }
}

$headerFile = Join-Path $env:TEMP ('region-ab-' + [guid]::NewGuid().ToString('N') + '.headers')
$rows = New-Object System.Collections.Generic.List[object]

function Start-Pause {
    if ($PauseSeconds -gt 0) { Start-Sleep -Seconds $PauseSeconds }
}

Write-Host "Region A/B probe - base: $base - $(Get-Date -Format s)"
Write-Host "Targets: $($targetList.Count) - measured runs/target: $Runs - warm-up runs/target: $WarmupRuns`n"

foreach ($target in $targetList) {
    $url = $base + $target

    for ($w = 1; $w -le $WarmupRuns; $w++) {
        $probe = Invoke-Probe -Url $url -HeaderFile $headerFile
        $rows.Add([pscustomobject]@{
            Target = $target; Phase = "warmup-$w"; Code = $probe.HttpCode; TtfbMs = $probe.TtfbMs
            TotalMs = $probe.TotalMs; Bytes = $probe.Bytes; Cache = $probe.Cache
            FnRegion = $probe.FnRegion; VercelId = ($probe.VercelId -replace '^(.{50}).+$', '$1...')
        })
        if ($w -lt $WarmupRuns -or $Runs -gt 0) { Start-Pause }
    }

    for ($r = 1; $r -le $Runs; $r++) {
        $probe = Invoke-Probe -Url $url -HeaderFile $headerFile
        $rows.Add([pscustomobject]@{
            Target = $target; Phase = "run-$r"; Code = $probe.HttpCode; TtfbMs = $probe.TtfbMs
            TotalMs = $probe.TotalMs; Bytes = $probe.Bytes; Cache = $probe.Cache
            FnRegion = $probe.FnRegion; VercelId = ($probe.VercelId -replace '^(.{50}).+$', '$1...')
        })
        if ($r -lt $Runs) { Start-Pause }
    }
}

if (Test-Path -LiteralPath $headerFile) { Remove-Item -LiteralPath $headerFile -Force }

Write-Host '--- Raw runs (warm-up + measured) ---'
$rows | Format-Table Target, Phase, Code, TtfbMs, TotalMs, Bytes, Cache, FnRegion, VercelId -AutoSize | Out-String | Write-Host

Write-Host '--- Medians per target (measured runs only) ---'
$summary = foreach ($target in $targetList) {
    $measured = @($rows | Where-Object { $_.Target -eq $target -and $_.Phase -like 'run-*' -and $_.TtfbMs -ne $null })
    if ($measured.Count -eq 0) {
        [pscustomobject]@{ Target = $target; N = 0; MedianTtfbMs = 'FAIL'; MinTtfbMs = ''; MaxTtfbMs = ''; MedianTotalMs = ''; Regions = '' }
        continue
    }
    [pscustomobject]@{
        Target        = $target
        N             = $measured.Count
        MedianTtfbMs  = [math]::Round((Get-Median -Values ($measured | ForEach-Object { [double]$_.TtfbMs })), 0)
        MinTtfbMs     = ($measured | Measure-Object -Property TtfbMs -Minimum).Minimum
        MaxTtfbMs     = ($measured | Measure-Object -Property TtfbMs -Maximum).Maximum
        MedianTotalMs = [math]::Round((Get-Median -Values ($measured | ForEach-Object { [double]$_.TotalMs })), 0)
        Regions       = (($measured | ForEach-Object { if ($_.FnRegion) { $_.FnRegion } else { 'edge' } } | Select-Object -Unique) -join ',')
    }
}
$summary | Format-Table -AutoSize | Out-String | Write-Host

Write-Host 'Reminder: compare medians across the sin1 block and the bom1 block;'
Write-Host 'the difference isolates the function region because the client->edge leg is identical.'
