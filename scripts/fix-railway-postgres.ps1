# Railway Postgres volume fix + DB connection check
# Before run: railway login
#             cd daeheung-rt-one-api
#             railway link -p d8a07574-bfb8-4edd-8a34-80bf46beee1d -s mvs-backend

param(
    [switch]$SkipVolumeFix,
    [switch]$RunMigrations,
    [switch]$Help
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$serverDir = Join-Path $root "daeheung-rt-one-api"

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

if ($Help) {
    Write-Host "Usage: .\scripts\fix-railway-postgres.ps1 [-SkipVolumeFix] [-RunMigrations]"
    exit 0
}

Push-Location $serverDir
try {
    railway whoami 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Run railway login first, then retry."
    }

    if (-not $SkipVolumeFix) {
        Write-Step "List Postgres volumes"
        railway volume list --json 2>&1

        Write-Step "Attach volume at /var/lib/postgresql/data"
        Write-Host "If volume exists, verify Mount Path in Railway dashboard." -ForegroundColor Yellow
        railway volume add --service Postgres --mount-path /var/lib/postgresql/data 2>&1

        Write-Step "Restart Postgres"
        railway service restart --service Postgres --yes --json 2>&1

        Write-Host "Waiting 30s for Postgres..." -ForegroundColor Yellow
        Start-Sleep -Seconds 30
    }

    Write-Step "Read Postgres DATABASE_URL"
    $pgVars = railway variable list --service Postgres --json 2>&1 | ConvertFrom-Json
    $internalUrl = $pgVars.DATABASE_URL
    $publicUrl = $pgVars.DATABASE_PUBLIC_URL

    if (-not $internalUrl) {
        throw "Postgres DATABASE_URL not found."
    }

    Write-Step "Set mvs-backend DATABASE_URL"
    railway variable set "DATABASE_URL=$internalUrl" --json 2>&1

    Write-Step "Redeploy mvs-backend"
    railway redeploy --yes 2>&1

    Write-Host "Waiting 90s for deploy..." -ForegroundColor Yellow
    Start-Sleep -Seconds 90

    Write-Step "Check /health"
    try {
        $health = Invoke-RestMethod -Uri "https://mvs-backend-production.up.railway.app/health" -TimeoutSec 20
        Write-Host "OK: $($health | ConvertTo-Json -Compress)" -ForegroundColor Green
    } catch {
        Write-Host "Health check failed - see Deploy Logs" -ForegroundColor Red
    }

    if ($RunMigrations) {
        Write-Step "Run migrations via SSH on mvs-backend"
        railway ssh --service mvs-backend -- node scripts/run-migrations.cjs 2>&1
    }

    Write-Step "Done"
    Write-Host "Verify: Postgres logs, /health, login at www.mvsystem.in" -ForegroundColor Gray
    if ($publicUrl) {
        Write-Host "Local migration test: set DATABASE_URL from DATABASE_PUBLIC_URL + sslmode=require" -ForegroundColor Gray
    }

} finally {
    Pop-Location
}
