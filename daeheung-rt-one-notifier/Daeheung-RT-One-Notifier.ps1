# Daeheung R&T One Windows Tray Notifier v1.2
# - System tray + balloon tips (no browser required)
# - Separate auth client (drt_notifier): web login elsewhere does NOT log this app out
# - Auto token refresh; ignores SESSION_SUPERSEDED (web single-session kick)

param(
  [string]$ApiBase = "",
  [switch]$Setup
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Web.Extensions

$AppName = "Daeheung R&T One"
$AppVersion = "1.2"
$UserAgent = "Daeheung-RT-One-Notifier/$AppVersion"
$DataDir = Join-Path $env:LOCALAPPDATA "Daeheung-RT-One-Notifier"
$ConfigPath = Join-Path $DataDir "config.json"
$SeenPath = Join-Path $DataDir "seen-ids.json"
$PollSeconds = 30
$RefreshEveryTicks = 40  # ~20 minutes at 30s poll

if (-not (Test-Path $DataDir)) {
  New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
}

function Read-JsonFile([string]$Path, $Default) {
  if (-not (Test-Path $Path)) { return $Default }
  try {
    $raw = Get-Content -Path $Path -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($raw)) { return $Default }
    return (ConvertFrom-Json $raw)
  } catch {
    return $Default
  }
}

function Write-JsonFile([string]$Path, $Object) {
  ($Object | ConvertTo-Json -Depth 6) | Set-Content -Path $Path -Encoding UTF8
}

function Get-NotifierHeaders([string]$Token) {
  $h = @{
    "User-Agent"   = $UserAgent
    "X-DRT-Client" = "drt_notifier"
  }
  if ($Token) {
    $h["Authorization"] = "Bearer $Token"
  }
  return $h
}

function Show-LoginDialog([string]$DefaultApi) {
  $form = New-Object System.Windows.Forms.Form
  $form.Text = "$AppName $AppVersion - Login"
  $form.Size = New-Object System.Drawing.Size(420, 280)
  $form.StartPosition = "CenterScreen"
  $form.FormBorderStyle = "FixedDialog"
  $form.MaximizeBox = $false
  $form.MinimizeBox = $false

  $lblApi = New-Object System.Windows.Forms.Label
  $lblApi.Text = "API Base URL"
  $lblApi.Location = New-Object System.Drawing.Point(16, 16)
  $lblApi.AutoSize = $true

  $txtApi = New-Object System.Windows.Forms.TextBox
  $txtApi.Location = New-Object System.Drawing.Point(16, 36)
  $txtApi.Width = 370
  $txtApi.Text = if ($DefaultApi) { $DefaultApi } else { "http://localhost:5000/api" }

  $lblUser = New-Object System.Windows.Forms.Label
  $lblUser.Text = "User ID"
  $lblUser.Location = New-Object System.Drawing.Point(16, 70)
  $lblUser.AutoSize = $true

  $txtUser = New-Object System.Windows.Forms.TextBox
  $txtUser.Location = New-Object System.Drawing.Point(16, 90)
  $txtUser.Width = 370

  $lblPass = New-Object System.Windows.Forms.Label
  $lblPass.Text = "Password"
  $lblPass.Location = New-Object System.Drawing.Point(16, 124)
  $lblPass.AutoSize = $true

  $txtPass = New-Object System.Windows.Forms.TextBox
  $txtPass.Location = New-Object System.Drawing.Point(16, 144)
  $txtPass.Width = 370
  $txtPass.UseSystemPasswordChar = $true

  $lblNote = New-Object System.Windows.Forms.Label
  $lblNote.Text = "Web login elsewhere will not sign out this app."
  $lblNote.Location = New-Object System.Drawing.Point(16, 172)
  $lblNote.AutoSize = $true
  $lblNote.ForeColor = [System.Drawing.Color]::DimGray

  $btnOk = New-Object System.Windows.Forms.Button
  $btnOk.Text = "Login"
  $btnOk.Location = New-Object System.Drawing.Point(210, 200)
  $btnOk.DialogResult = [System.Windows.Forms.DialogResult]::OK

  $btnCancel = New-Object System.Windows.Forms.Button
  $btnCancel.Text = "Cancel"
  $btnCancel.Location = New-Object System.Drawing.Point(300, 200)
  $btnCancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel

  $form.Controls.AddRange(@($lblApi, $txtApi, $lblUser, $txtUser, $lblPass, $txtPass, $lblNote, $btnOk, $btnCancel))
  $form.AcceptButton = $btnOk
  $form.CancelButton = $btnCancel

  $result = $form.ShowDialog()
  if ($result -ne [System.Windows.Forms.DialogResult]::OK) { return $null }
  return [pscustomobject]@{
    apiBase = $txtApi.Text.Trim().TrimEnd("/")
    userid  = $txtUser.Text.Trim()
    password = $txtPass.Text
  }
}

function Invoke-MvsLogin($ApiBase, $UserId, $Password) {
  $payload = [ordered]@{
    userid   = $UserId
    password = $Password
    client   = "drt_notifier"
  }
  $json = ($payload | ConvertTo-Json -Compress)
  $resp = Invoke-RestMethod -Method Post -Uri "$ApiBase/auth/login" `
    -ContentType "application/json; charset=utf-8" `
    -Headers (Get-NotifierHeaders "") `
    -Body ([System.Text.Encoding]::UTF8.GetBytes($json))
  if (-not $resp.success -or -not $resp.data.token) {
    throw "Login failed"
  }
  return [pscustomobject]@{
    apiBase = $ApiBase
    token   = [string]$resp.data.token
    userid  = $UserId
    webBase = ($ApiBase -replace "/api$", "")
    version = $AppVersion
  }
}

function Invoke-MvsRefresh([string]$ApiBase, [string]$Token) {
  $resp = Invoke-RestMethod -Method Post -Uri "$ApiBase/auth/refresh" `
    -Headers (Get-NotifierHeaders $Token) `
    -ContentType "application/json; charset=utf-8" `
    -Body "{}"
  if (-not $resp.success -or -not $resp.data.token) {
    throw "Refresh failed"
  }
  return [string]$resp.data.token
}

function Get-ApiErrorCode($ErrorRecord) {
  try {
    $detail = [string]$ErrorRecord.ErrorDetails.Message
    if (-not [string]::IsNullOrWhiteSpace($detail)) {
      $obj = $detail | ConvertFrom-Json
      if ($obj.code) { return [string]$obj.code }
    }
  } catch { }
  try {
    $resp = $ErrorRecord.Exception.Response
    if (-not $resp) { return $null }
    $stream = $resp.GetResponseStream()
    if (-not $stream) { return $null }
    $reader = New-Object System.IO.StreamReader($stream)
    $body = $reader.ReadToEnd()
    $reader.Close()
    if ([string]::IsNullOrWhiteSpace($body)) { return $null }
    $obj = $body | ConvertFrom-Json
    return [string]$obj.code
  } catch {
    return $null
  }
}

function Get-MvsNotifications($ApiBase, $Token) {
  $resp = Invoke-RestMethod -Method Get -Uri "$ApiBase/notifications?page=1&limit=20" `
    -Headers (Get-NotifierHeaders $Token)
  if ($resp.success -and $resp.data) { return @($resp.data) }
  return @()
}

$config = Read-JsonFile -Path $ConfigPath -Default $null
if ($Setup -or -not $config -or -not $config.token) {
  $login = Show-LoginDialog -DefaultApi $(if ($ApiBase) { $ApiBase } elseif ($config) { $config.apiBase } else { "" })
  if (-not $login) { exit 0 }
  try {
    $config = Invoke-MvsLogin -ApiBase $login.apiBase -UserId $login.userid -Password $login.password
    Write-JsonFile -Path $ConfigPath -Object $config
  } catch {
    [System.Windows.Forms.MessageBox]::Show("Login failed: $($_.Exception.Message)", $AppName) | Out-Null
    exit 1
  }
}

$script:SeenIds = New-Object "System.Collections.Generic.HashSet[string]"
$seenLoaded = Read-JsonFile -Path $SeenPath -Default @()
foreach ($id in @($seenLoaded)) { [void]$script:SeenIds.Add([string]$id) }
$script:Primed = $false
$script:Enabled = $true
$script:TickCount = 0
$script:AuthFailStreak = 0

$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Text = "$AppName $AppVersion"
$iconPath = Join-Path $PSScriptRoot "daeheung-rt-one-notifier.ico"
if (Test-Path $iconPath) {
  try {
    $notify.Icon = New-Object System.Drawing.Icon $iconPath
  } catch {
    $notify.Icon = [System.Drawing.SystemIcons]::Application
  }
} else {
  $notify.Icon = [System.Drawing.SystemIcons]::Application
}
$notify.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$miOpen = $menu.Items.Add("Open Daeheung R&T One")
$miCheck = $menu.Items.Add("Check now")
$miToggle = $menu.Items.Add("Notifications: ON")
$miRelogin = $menu.Items.Add("Re-login")
$miExit = $menu.Items.Add("Exit")
$notify.ContextMenuStrip = $menu

function Save-Seen {
  $arr = @($script:SeenIds)
  if ($arr.Count -gt 300) { $arr = $arr[-300..-1] }
  Write-JsonFile -Path $SeenPath -Object $arr
}

function Save-Config {
  Write-JsonFile -Path $ConfigPath -Object $config
}

function Show-Tip([string]$Title, [string]$Body) {
  if (-not $script:Enabled) { return }
  $notify.BalloonTipTitle = $Title
  $notify.BalloonTipText = $(if ($Body) { $Body } else { " " })
  $notify.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
  $notify.ShowBalloonTip(6000)
}

function Try-RefreshToken {
  try {
    $newToken = Invoke-MvsRefresh -ApiBase $config.apiBase -Token $config.token
    $config.token = $newToken
    $config.version = $AppVersion
    Save-Config
    $script:AuthFailStreak = 0
    return $true
  } catch {
    $code = Get-ApiErrorCode $_
    # Web single-session kick must never force notifier logout
    if ($code -eq "SESSION_SUPERSEDED") {
      return $false
    }
    return $false
  }
}

function Sync-Notifications([bool]$ForceTip) {
  $script:TickCount++
  if ($script:TickCount -ge $RefreshEveryTicks) {
    $script:TickCount = 0
    [void](Try-RefreshToken)
  }

  try {
    $rows = Get-MvsNotifications -ApiBase $config.apiBase -Token $config.token
    $script:AuthFailStreak = 0
  } catch {
    $code = Get-ApiErrorCode $_
    # Ignore web session-kick; keep running with current token / refresh
    if ($code -eq "SESSION_SUPERSEDED") {
      [void](Try-RefreshToken)
      return
    }
    if (Try-RefreshToken) {
      try {
        $rows = Get-MvsNotifications -ApiBase $config.apiBase -Token $config.token
        $script:AuthFailStreak = 0
      } catch {
        $script:AuthFailStreak++
        if ($ForceTip -or $script:AuthFailStreak -ge 5) {
          Show-Tip $AppName "Session expired. Use Re-login from the tray menu."
        }
        return
      }
    } else {
      $script:AuthFailStreak++
      if ($ForceTip -or $script:AuthFailStreak -ge 5) {
        Show-Tip $AppName "Cannot reach Daeheung R&T One. Check network or Re-login."
      }
      return
    }
  }

  if (-not $script:Primed) {
    foreach ($row in $rows) {
      $id = [string]($row.id)
      if ($id) { [void]$script:SeenIds.Add($id) }
    }
    $script:Primed = $true
    Save-Seen
    if ($ForceTip) { Show-Tip $AppName "Connected. Waiting for new notifications." }
    return
  }

  foreach ($row in $rows) {
    $id = [string]($row.id)
    if (-not $id -or $script:SeenIds.Contains($id)) { continue }
    [void]$script:SeenIds.Add($id)
    if ($row.read) { continue }
    $title = if ($row.title) { [string]$row.title } else { $AppName }
    $msg = if ($row.message) { [string]$row.message } else { "" }
    Show-Tip $title $msg
  }
  Save-Seen
}

$miOpen.add_Click({
  $url = if ($config.webBase) { $config.webBase } else { "http://localhost:3000" }
  Start-Process $url
})

$miCheck.add_Click({ Sync-Notifications -ForceTip $true })

$miToggle.add_Click({
  $script:Enabled = -not $script:Enabled
  $miToggle.Text = $(if ($script:Enabled) { "Notifications: ON" } else { "Notifications: OFF" })
})

$miRelogin.add_Click({
  $login = Show-LoginDialog -DefaultApi $config.apiBase
  if (-not $login) { return }
  try {
    $config = Invoke-MvsLogin -ApiBase $login.apiBase -UserId $login.userid -Password $login.password
    Write-JsonFile -Path $ConfigPath -Object $config
    $script:Primed = $false
    $script:AuthFailStreak = 0
    Show-Tip $AppName "Logged in. Web sessions stay independent."
    Sync-Notifications -ForceTip $false
  } catch {
    [System.Windows.Forms.MessageBox]::Show("Login failed: $($_.Exception.Message)", $AppName) | Out-Null
  }
})

$miExit.add_Click({
  $notify.Visible = $false
  $notify.Dispose()
  [System.Windows.Forms.Application]::Exit()
})

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = ($PollSeconds * 1000)
$timer.add_Tick({ Sync-Notifications -ForceTip $false })
$timer.Start()

Show-Tip $AppName "v$AppVersion running. Web login elsewhere will not sign you out."
Sync-Notifications -ForceTip $false

[System.Windows.Forms.Application]::Run()
