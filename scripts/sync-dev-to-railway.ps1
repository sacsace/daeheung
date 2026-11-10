# 개발서버 → Railway 운영 동기화 (스키마·메뉴·사용자)
param(
  [string]$BackendUrl = "https://mvs-backend-production.up.railway.app",
  [string]$BootstrapKey = "mvs-super-secret-jwt-key-2025-prod!!",
  [string]$DevApiBase = "http://localhost:5000/api",
  [switch]$SkipExport,
  [switch]$SkipMigrate,
  [switch]$SkipMenus,
  [switch]$SkipUsers
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$serverDir = Join-Path $root "daeheung-rt-one-api"

function Invoke-Bootstrap {
  param([hashtable]$ExtraHeaders, [string]$Label)
  $headers = @{ "x-bootstrap-key" = $BootstrapKey }
  foreach ($k in $ExtraHeaders.Keys) { $headers[$k] = $ExtraHeaders[$k] }
  Write-Host "`n==> $Label"
  $r = Invoke-RestMethod -Uri "$BackendUrl/api/system/bootstrap-database" -Method POST -Headers $headers -TimeoutSec 600
  $r | ConvertTo-Json -Compress
}

Push-Location $root
try {
  if (-not $SkipExport) {
    Write-Host "=== 1) 개발 메뉴 export ==="
    & (Join-Path $root "scripts\export-menus-from-dev-api.ps1") -DevApiBase $DevApiBase

    Write-Host "`n=== 2) 개발 사용자·부서 export ==="
    Push-Location $serverDir
    $env:NODE_ENV = "development"
    $env:DATABASE_URL = "postgresql://mvs_user:Korean%402026@localhost:5432/mvs"
    node scripts/export-departments.cjs
    node scripts/export-users.cjs
    Pop-Location
  }

  if (-not $SkipMigrate) {
    Invoke-Bootstrap -ExtraHeaders @{ "x-migrate-only" = "1" } -Label "운영 DB 마이그레이션"
  }

  if (-not $SkipMenus) {
    Write-Host "`n==> 운영 메뉴 import"
    $menuHeaders = @{
      "x-bootstrap-key"    = $BootstrapKey
      "x-sync-permissions" = "1"
    }
    $menuResp = Invoke-RestMethod -Uri "$BackendUrl/api/system/import-menus" -Method POST -Headers $menuHeaders -TimeoutSec 300
    $menuResp | ConvertTo-Json -Compress
  }

  if (-not $SkipUsers) {
    Write-Host "`n==> 운영 부서 import"
    $deptHeaders = @{ "x-bootstrap-key" = $BootstrapKey }
    try {
      $deptResp = Invoke-RestMethod -Uri "$BackendUrl/api/system/import-departments" -Method POST -Headers $deptHeaders -TimeoutSec 300
      $deptResp | ConvertTo-Json -Compress
    } catch {
      Write-Host "부서 import 건너뜀 또는 실패: $($_.Exception.Message)"
    }

    Write-Host "`n==> 운영 사용자 import"
    $userHeaders = @{ "x-bootstrap-key" = $BootstrapKey }
    $userResp = Invoke-RestMethod -Uri "$BackendUrl/api/system/import-users" -Method POST -Headers $userHeaders -TimeoutSec 300
    $userResp | ConvertTo-Json -Compress
  }

  Write-Host "`n✅ 개발→운영 동기화 완료. https://www.mvsystem.in 새로고침 후 메뉴를 확인하세요."
} finally {
  Pop-Location
}
