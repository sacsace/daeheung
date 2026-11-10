@echo off
setlocal
set "DEST=%LOCALAPPDATA%\Daeheung-RT-One-Notifier"
set "STARTMENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs\MVS Notifier.lnk"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\MVS Notifier.lnk"

taskkill /F /FI "WINDOWTITLE eq MVS Notifier*" >nul 2>&1

if exist "%STARTMENU%" del /F /Q "%STARTMENU%"
if exist "%STARTUP%" del /F /Q "%STARTUP%"
if exist "%DEST%" rmdir /S /Q "%DEST%"

echo Uninstalled MVS Notifier.
pause
endlocal
