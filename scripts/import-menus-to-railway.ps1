# 개발서버에서 추출한 menus-dev-export.json 을 Railway 운영 DB에 반영
# 사전: git push 로 daeheung-rt-one-api/data/menus-dev-export.json 이 배포되어 있어야 함

param(
  [string]$BackendUrl = "https://mvs-backend-production.up.railway.app",
  [string]$BootstrapKey = "mvs-super-secret-jwt-key-2025-prod!!",
  [string]$JsonFile = (Join-Path $PSScriptRoot "..\daeheung-rt-one-api\data\menus-dev-export.json")
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $JsonFile)) {
  throw "메뉴 JSON 없음. 먼저 실행: npm run db:export:menus:dev"
}

Write-Host "=== Railway 메뉴 import ($BackendUrl) ==="
$headers = @{
  "x-bootstrap-key"     = $BootstrapKey
  "x-sync-permissions"  = "1"
}

try {
  $r = Invoke-RestMethod -Uri "$BackendUrl/api/system/import-menus" -Method POST -Headers $headers -TimeoutSec 300
  $r | ConvertTo-Json
  Write-Host "✅ 운영 서버 메뉴 반영 완료"
} catch {
  Write-Host $_.Exception.Message
  if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
  exit 1
}
