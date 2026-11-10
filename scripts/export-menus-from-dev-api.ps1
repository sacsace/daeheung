# 개발 백엔드 API에서 메뉴·권한 JSON 추출
# 사용: .\scripts\export-menus-from-dev-api.ps1 [-DevApiBase "http://localhost:5000/api"] [-OutFile "backup\menus-dev-export.json"]

param(
  [string]$DevApiBase = "http://localhost:5000/api",
  [string]$OutFile = (Join-Path $PSScriptRoot "..\daeheung-rt-one-api\data\menus-dev-export.json"),
  [string]$UserId = "root",
  [string]$Password = "admin123",
  [int]$TenantId = 1
)

$ErrorActionPreference = "Stop"

function Flatten-MenuTree {
  param($nodes, $parentId = $null)
  $result = @()
  foreach ($n in $nodes) {
    $result += [PSCustomObject]@{
      id          = $n.id
      tenant_id   = $TenantId
      parent_id   = $parentId
      name_ko     = $n.name_ko
      name_en     = $n.name_en
      route       = $n.route
      icon        = $n.icon
      order       = $n.order
      level       = $n.level
      is_active   = if ($null -ne $n.is_active) { $n.is_active } else { $true }
      description = $n.description
    }
    if ($n.children -and $n.children.Count -gt 0) {
      $result += Flatten-MenuTree -nodes $n.children -parentId $n.id
    }
  }
  return $result
}

Write-Host "=== 개발 서버 로그인 ($DevApiBase) ==="
$login = Invoke-RestMethod -Uri "$DevApiBase/auth/login" -Method POST `
  -Body (@{ userid = $UserId; password = $Password } | ConvertTo-Json) `
  -ContentType "application/json"

$token = $login.data.token
$userId = $login.data.user.id
$headers = @{ Authorization = "Bearer $token" }

Write-Host "=== 메뉴 트리 조회 (user=$userId) ==="
$menuResp = Invoke-RestMethod -Uri "$DevApiBase/menus/user/$userId/tenant/${TenantId}?language=ko" -Headers $headers
$flatMenus = Flatten-MenuTree -nodes $menuResp.data

Write-Host "=== 권한 조회 (root/admin) ==="
$usersResp = Invoke-RestMethod -Uri "$DevApiBase/users" -Headers $headers
$targetUsers = @($usersResp.data | Where-Object { $_.role -in @('root', 'admin') })
if ($targetUsers.Count -eq 0) { $targetUsers = @($login.data.user) }

$permissions = @()
foreach ($u in $targetUsers) {
  $permResp = Invoke-RestMethod -Uri "$DevApiBase/menus/permissions/user/$($u.id)" -Headers $headers
  foreach ($p in $permResp.data) {
    if (-not $p.menu) { continue }
    $permissions += [PSCustomObject]@{
      user_id     = $p.user_id
      userid      = $u.userid
      menu_id     = $p.menu_id
      menu_route  = $p.menu.route
      can_view    = $p.can_view
      can_create  = $p.can_create
      can_edit    = $p.can_edit
      can_delete  = $p.can_delete
    }
  }
}

$payload = [PSCustomObject]@{
  exported_at = (Get-Date).ToUniversalTime().ToString("o")
  tenant_id   = $TenantId
  source      = $DevApiBase
  menus       = $flatMenus
  permissions = $permissions
}

$dir = Split-Path $OutFile -Parent
if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($OutFile, ($payload | ConvertTo-Json -Depth 10), $utf8NoBom)

Write-Host "✅ 메뉴 $($flatMenus.Count)건, 권한 $($permissions.Count)건 → $OutFile"
