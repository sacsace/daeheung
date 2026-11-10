MVS Notifier v1.2 (Windows tray)
================================

Lightweight tray notifier for Minsub Ventures System (MVS).
- Shows Windows balloon tips for new MVS notifications
- Runs in system tray (no browser required while running)
- Separate from web session: logging in on the web elsewhere
  will NOT sign out this notifier
- Auto-refreshes auth token while running
- Does NOT enable Startup by default
- Does NOT modify OS system settings

Install
-------
1. Unzip
2. Run Install.bat
3. Enter API Base URL (example: https://your-server/api) and login

Uninstall
---------
Run Uninstall.bat

Notes
-----
- Requires Windows PowerShell and network access to MVS API
- Right-click tray icon: Open MVS / Check now / Notifications ON·OFF / Re-login / Exit
