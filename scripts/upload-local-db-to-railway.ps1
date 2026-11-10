param(
  [string]$DumpPath
)

$ErrorActionPreference = "Stop"

function Get-EnvValueFromFile {
  param(
    [string]$FilePath,
    [string]$Key
  )
  if (!(Test-Path $FilePath)) { return $null }
  $line = Get-Content $FilePath |
    Where-Object { $_ -and -not $_.StartsWith("#") } |
    Where-Object { $_ -match ("^" + [Regex]::Escape($Key) + "=") } |
    Select-Object -First 1
  if (!$line) { return $null }
  return $line.Split("=", 2)[1].Trim()
}

function Get-LocalDbConfig {
  $envDev = Join-Path $PSScriptRoot "..\daeheung-rt-one-api\env.development"
  $rootEnv = Join-Path $PSScriptRoot "..\.env"

  $dbHost = Get-EnvValueFromFile $envDev "DB_HOST"
  $dbPort = Get-EnvValueFromFile $envDev "DB_PORT"
  $dbName = Get-EnvValueFromFile $envDev "DB_NAME"
  $dbUser = Get-EnvValueFromFile $envDev "DB_USER"
  $dbPass = Get-EnvValueFromFile $envDev "DB_PASSWORD"

  if (!$dbHost) { $dbHost = Get-EnvValueFromFile $rootEnv "DB_HOST" }
  if (!$dbPort) { $dbPort = Get-EnvValueFromFile $rootEnv "DB_PORT" }
  if (!$dbName) { $dbName = Get-EnvValueFromFile $rootEnv "DB_NAME" }
  if (!$dbUser) { $dbUser = Get-EnvValueFromFile $rootEnv "DB_USER" }
  if (!$dbPass) { $dbPass = Get-EnvValueFromFile $rootEnv "DB_PASSWORD" }

  if (!$dbHost -or !$dbPort -or !$dbName -or !$dbUser) {
    throw "로컬 DB 환경 변수를 찾을 수 없습니다. env.development 또는 .env를 확인하세요."
  }

  return @{
    Host = $dbHost
    Port = $dbPort
    Name = $dbName
    User = $dbUser
    Password = $dbPass
    FallbackPassword = (Get-EnvValueFromFile $rootEnv "DB_PASSWORD")
  }
}

function Get-PgBinPath {
  $base = "C:\Program Files\PostgreSQL"
  if (!(Test-Path $base)) { return $null }
  $dirs = Get-ChildItem $base -Directory | Sort-Object Name -Descending
  foreach ($dir in $dirs) {
    $bin = Join-Path $dir.FullName "bin"
    if (Test-Path (Join-Path $bin "pg_dump.exe")) {
      return $bin
    }
  }
  return $null
}

function Get-RailwayPublicUrl {
  $vars = railway variables --json --service Postgres | ConvertFrom-Json
  if (!$vars.DATABASE_PUBLIC_URL) {
    throw "Railway DATABASE_PUBLIC_URL을 찾을 수 없습니다. railway 로그인/프로젝트 연결 상태를 확인하세요."
  }
  return $vars.DATABASE_PUBLIC_URL
}

$pgBin = Get-PgBinPath
if (!$pgBin) {
  throw "pg_dump/pg_restore를 찾을 수 없습니다. PostgreSQL을 설치한 후 다시 실행하세요."
}

$local = Get-LocalDbConfig
$dumpDir = Join-Path $PSScriptRoot "..\backup"
if (!(Test-Path $dumpDir)) { New-Item -ItemType Directory -Path $dumpDir | Out-Null }
$dumpFile = if ($DumpPath) { $DumpPath } else { Join-Path $dumpDir "daeheung-rt-one.dump" }

Write-Host "=== 로컬 DB 덤프 생성 ==="
$passwords = @()
if ($local.Password) { $passwords += $local.Password }
if ($local.FallbackPassword -and $local.FallbackPassword -ne $local.Password) { $passwords += $local.FallbackPassword }

$dumpOk = $false
foreach ($pwd in $passwords) {
  $env:PGPASSWORD = $pwd
  & (Join-Path $pgBin "pg_dump.exe") -Fc -h $local.Host -p $local.Port -U $local.User -d $local.Name -f $dumpFile
  if ($LASTEXITCODE -eq 0) {
    $dumpOk = $true
    break
  }
}

if (!$dumpOk) {
  throw "로컬 DB 덤프 실패: DB_PASSWORD가 일치하지 않습니다. env.development 또는 .env를 확인하세요."
}

Write-Host "✅ 덤프 완료: $dumpFile"

Write-Host "=== Railway DB 복원 ==="
$railwayUrl = (Get-RailwayPublicUrl) + "?sslmode=require"
& (Join-Path $pgBin "pg_restore.exe") --clean --if-exists --no-owner --no-privileges -d $railwayUrl $dumpFile
if ($LASTEXITCODE -ne 0) {
  throw "Railway DB 복원 실패: Railway TCP 프록시 연결/SSL 상태를 확인하세요."
}

Write-Host "✅ Railway DB 복원 완료"
