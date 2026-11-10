@echo off
setlocal
set "DEST=%LOCALAPPDATA%\Daeheung-RT-One-Notifier"
set "SRC=%~dp0"

if not exist "%DEST%" mkdir "%DEST%"
copy /Y "%SRC%Daeheung-RT-One-Notifier.ps1" "%DEST%\Daeheung-RT-One-Notifier.ps1" >nul
copy /Y "%SRC%Start-Daeheung-RT-One-Notifier.bat" "%DEST%\Start-Daeheung-RT-One-Notifier.bat" >nul
copy /Y "%SRC%README.txt" "%DEST%\README.txt" >nul
copy /Y "%SRC%daeheung-rt-one-notifier.ico" "%DEST%\daeheung-rt-one-notifier.ico" >nul

REM Clear cached token so next start forces re-login with notifier client flag
if exist "%DEST%\config.json" del /F /Q "%DEST%\config.json" >nul 2>&1

set "STARTMENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs\MVS Notifier.lnk"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws=New-Object -ComObject WScript.Shell; $s=$ws.CreateShortcut('%STARTMENU%'); $s.TargetPath='%DEST%\Start-Daeheung-RT-One-Notifier.bat'; $s.WorkingDirectory='%DEST%'; $s.IconLocation='%DEST%\daeheung-rt-one-notifier.ico,0'; $s.WindowStyle=7; $s.Save()"

echo Installed to: %DEST%
echo Start Menu shortcut created: MVS Notifier
echo Cached login cleared — please sign in again in the tray app.
echo Startup on login is NOT enabled.
echo.
pause

start "" "%DEST%\Start-Daeheung-RT-One-Notifier.bat"
endlocal
