# MVS server start script
# Encoding: UTF-8

param(
    [switch]$BackendOnly,
    [switch]$FrontendOnly,
    [switch]$SkipChecks,
    [switch]$Help
)

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

if ($Help) {
    Write-ColorOutput "`nMVS server start script usage" "Cyan"
    Write-ColorOutput ("=" * 60) "Gray"
    Write-ColorOutput "`nUsage:" "Yellow"
    Write-ColorOutput "  .\server\start-server.ps1               # start backend + frontend"
    Write-ColorOutput "  .\server\start-server.ps1 -BackendOnly  # start backend only"
    Write-ColorOutput "  .\server\start-server.ps1 -FrontendOnly # start frontend only"
    Write-ColorOutput "  .\server\start-server.ps1 -SkipChecks   # skip checks"
    Write-ColorOutput "`nOptions:" "Yellow"
    Write-ColorOutput "  -BackendOnly   start backend only"
    Write-ColorOutput "  -FrontendOnly  start frontend only"
    Write-ColorOutput "  -SkipChecks    skip preflight checks"
    Write-ColorOutput "  -Help          show this help"
    Write-ColorOutput ("`n" + "=" * 60) "Gray"
    exit 0
}

Write-ColorOutput "`nMVS server start script" "Cyan"
Write-ColorOutput ("=" * 60) "Gray"

if ($BackendOnly -and $FrontendOnly) {
    Write-ColorOutput "BackendOnly and FrontendOnly cannot be used together." "Red"
    exit 1
}

# 스크립트 위치: MVS/server/*.ps1 → 저장소 루트는 한 단계 위
# 일부 실행 방식(인라인/특정 호스트)에서는 $PSScriptRoot가 비어 있을 수 있음
$scriptDir = if (-not [string]::IsNullOrWhiteSpace($PSScriptRoot)) {
    $PSScriptRoot
} elseif ($MyInvocation.MyCommand.Path) {
    Split-Path -Parent $MyInvocation.MyCommand.Path
} else {
    $null
}
$rootPath = if ($scriptDir) { Split-Path -Parent $scriptDir } else { $null }
if (-not $rootPath -or -not (Test-Path -LiteralPath (Join-Path $rootPath "daeheung-rt-one-api"))) {
    $cwd = (Get-Location -ErrorAction SilentlyContinue).Path
    if ($cwd -and (Test-Path -LiteralPath (Join-Path $cwd "daeheung-rt-one-api"))) {
        $rootPath = $cwd
    }
}
$msvServerAtRoot = if ($rootPath) { Join-Path $rootPath "daeheung-rt-one-api" } else { $null }
if (-not $rootPath -or -not (Test-Path -LiteralPath $msvServerAtRoot)) {
    Write-ColorOutput "Could not resolve repository root (folder containing daeheung-rt-one-api). Script directory was empty or invalid." "Red"
    Write-ColorOutput "Run this script from the file: .\server\start-server.ps1 (from repo root), or cd to the MVS repo folder first." "Yellow"
    exit 1
}

function Stop-ProcessOnPort {
    param(
        [int]$Port,
        [string]$ServerName
    )

    $pids = netstat -ano | Select-String ":$Port.*LISTENING" | ForEach-Object {
        ($_.Line -split '\s+')[-1]
    } | Select-Object -Unique | Where-Object { $_ -match '^\d+$' }

    if ($pids) {
        Write-ColorOutput "Stopping processes on port $Port ($ServerName)..." "Yellow"
        foreach ($processId in $pids) {
            try {
                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                Write-ColorOutput "  Stopped process $processId" "Green"
            } catch {
                Write-ColorOutput "  Failed to stop ${processId}: $($_.Exception.Message)" "Red"
            }
        }
        Start-Sleep -Milliseconds 500
    } else {
        Write-ColorOutput "Port $Port ($ServerName) is available." "Green"
    }
}

function Test-Environment {
    Write-ColorOutput "`nChecking environment variables..." "Cyan"

    $envFile = Join-Path $rootPath "daeheung-rt-one-api\.env"
    $envExample = Join-Path $rootPath ".env"

    if (-not (Test-Path $envFile)) {
        Write-ColorOutput ".env file not found: $envFile" "Yellow"
        if (Test-Path $envExample) {
            Write-ColorOutput "Copy the root .env to daeheung-rt-one-api\.env:" "White"
            Write-ColorOutput "  copy .env daeheung-rt-one-api\.env" "Cyan"
        }
        if (-not $SkipChecks) {
            Write-ColorOutput "Cannot start without environment file." "Red"
            exit 1
        }
    } else {
        Write-ColorOutput ".env file found." "Green"
    }
}

function Test-Dependencies {
    Write-ColorOutput "`nChecking dependencies..." "Cyan"

    try {
        $nodeVersion = node --version 2>$null
        if ($nodeVersion) {
            Write-ColorOutput "Node.js installed: $nodeVersion" "Green"
        } else {
            throw "Node.js not found"
        }
    } catch {
        Write-ColorOutput "Node.js is not installed." "Red"
        exit 1
    }

    try {
        $npmVersion = npm --version 2>$null
        if ($npmVersion) {
            Write-ColorOutput "npm installed: $npmVersion" "Green"
        } else {
            throw "npm not found"
        }
    } catch {
        Write-ColorOutput "npm is not installed." "Red"
        exit 1
    }

    $backendModules = Join-Path $rootPath "daeheung-rt-one-api\node_modules"
    $frontendModules = Join-Path $rootPath "daeheung-rt-one-web\node_modules"

    if (-not $FrontendOnly) {
        if (-not (Test-Path $backendModules)) {
            Write-ColorOutput "Backend dependencies missing. Installing..." "Yellow"
            Set-Location "$rootPath\daeheung-rt-one-api"
            npm install
            Set-Location $rootPath
        } else {
            Write-ColorOutput "Backend dependencies OK." "Green"
        }
    }

    if (-not $BackendOnly) {
        if (-not (Test-Path $frontendModules)) {
            Write-ColorOutput "Frontend dependencies missing. Installing..." "Yellow"
            Set-Location "$rootPath\daeheung-rt-one-web"
            npm install
            Set-Location $rootPath
        } else {
            Write-ColorOutput "Frontend dependencies OK." "Green"
        }
    }
}

function Test-DatabaseConnection {
    Write-ColorOutput "`nDatabase connection will be checked on startup." "Cyan"
}

function Start-BackendServer {
    Write-ColorOutput "`nStarting backend server..." "Cyan"

    $backendPath = Join-Path $rootPath "daeheung-rt-one-api"
    if (-not (Test-Path $backendPath)) {
        Write-ColorOutput "Backend directory not found: $backendPath" "Red"
        exit 1
    }

    Stop-ProcessOnPort -Port 5000 -ServerName "Backend"

    $backendPathEscaped = $backendPath -replace "'", "''"
    $backendCmds = @(
        "Write-Host '========================================' -ForegroundColor Cyan",
        "Write-Host '  Daeheung R&T One API' -ForegroundColor Cyan",
        "Write-Host '========================================' -ForegroundColor Cyan",
        "Set-Location '$backendPathEscaped'",
        "Remove-Item -Path Env:DATABASE_URL -ErrorAction SilentlyContinue",
        "Get-Content -Path '.env' | ForEach-Object { if ($_ -match '^(DB_HOST|DB_PORT|DB_NAME|DB_USER|DB_PASSWORD|PORT)=(.*)$') { Set-Item -Path ('Env:' + $matches[1]) -Value $matches[2] } }",
        "if ($env:DB_NAME -eq 'mvs' -or $env:DB_USER -eq 'mvs_user') { Write-Host 'Refusing to start against the MSV database.' -ForegroundColor Red; exit 1 }",
        "npm run dev"
    )
    $command = $backendCmds -join "; "

    Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoExit", "-Command", $command)
    Write-ColorOutput "Backend server started on port 5000." "Green"
}

function Start-FrontendServer {
    Write-ColorOutput "`nStarting frontend server..." "Cyan"

    $frontendPath = Join-Path $rootPath "daeheung-rt-one-web"
    if (-not (Test-Path $frontendPath)) {
        Write-ColorOutput "Frontend directory not found: $frontendPath" "Red"
        exit 1
    }

    Stop-ProcessOnPort -Port 3000 -ServerName "Frontend"

    if (-not $FrontendOnly) {
        Write-ColorOutput "Waiting for backend to start (3s)..." "Yellow"
        Start-Sleep -Seconds 3
    }

    $frontendPathEscaped = $frontendPath -replace "'", "''"
    $frontendCmds = @(
        "Write-Host '========================================' -ForegroundColor Green",
        "Write-Host '  MVS Frontend Server' -ForegroundColor Green",
        "Write-Host '========================================' -ForegroundColor Green",
        "Set-Location '$frontendPathEscaped'",
        "Set-Item -Path Env:PORT -Value 3000",
        "Set-Item -Path Env:BROWSER -Value 'none'",
        "npm start"
    )
    $command = $frontendCmds -join "; "

    Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoExit", "-Command", $command)
    Write-ColorOutput "Frontend server started on port 3000." "Green"
}

try {
    if (-not $SkipChecks) {
        Test-Dependencies
        Test-Environment
        Test-DatabaseConnection
    }

    if ($BackendOnly) {
        Start-BackendServer
    } elseif ($FrontendOnly) {
        Start-FrontendServer
    } else {
        Start-BackendServer
        Start-FrontendServer
    }

    Write-ColorOutput "`nWaiting for servers to start (5s)..." "Yellow"
    Start-Sleep -Seconds 5

    Write-ColorOutput "`nServers started." "Green"
    Write-ColorOutput ("=" * 60) "Gray"
    Write-ColorOutput "`nURLs:" "Cyan"

    if (-not $FrontendOnly) {
        Write-ColorOutput "  Frontend: http://localhost:3000" "White"
    }
    if (-not $BackendOnly) {
        Write-ColorOutput "  Backend API: http://localhost:5000" "White"
        Write-ColorOutput "  Health check: http://localhost:5000/health" "White"
        Write-ColorOutput "  API docs: http://localhost:5000/api" "White"
    }

    Write-ColorOutput "`nTest accounts:" "Cyan"
    Write-ColorOutput "  ID: root / admin / user1" "White"
    Write-ColorOutput "  PW: admin123" "White"

    Write-ColorOutput "`nHow to stop:" "Yellow"
    Write-ColorOutput "  - Press Ctrl+C in each PowerShell window" "White"
    Write-ColorOutput "  - Or run .\server\stop-server.ps1" "White"

    Write-ColorOutput ("`n" + "=" * 60) "Gray"
    Write-ColorOutput ""
} catch {
    Write-ColorOutput "`nError: $($_.Exception.Message)" "Red"
    Write-ColorOutput "Stack trace:" "Yellow"
    if ($_.ScriptStackTrace) {
        Write-ColorOutput $_.ScriptStackTrace "Red"
    }
    exit 1
}
