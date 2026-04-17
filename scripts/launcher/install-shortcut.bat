@echo off
chcp 65001 >nul 2>&1
setlocal

set "SHORTCUT_NAME=SDV-auto"
set "TARGET=%~dp0sdv-launcher.bat"
set "WORKDIR=%~dp0"
set "START_MENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs"
set "SHORTCUT_PATH=%START_MENU%\%SHORTCUT_NAME%.lnk"

powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = '%TARGET%'; $s.WorkingDirectory = '%WORKDIR%'; $s.Description = 'Simple Doc Viewer - auto server + PWA window'; $s.WindowStyle = 7; $s.Save()"

if exist "%SHORTCUT_PATH%" (
  echo.
  echo   [OK] Shortcut created: %SHORTCUT_PATH%
  echo.
  echo   Start menu: search "SDV-auto" and run
  echo   If SDV server is off, it starts automatically and opens PWA window.
  echo.
) else (
  echo   [FAIL] Shortcut creation failed
  exit /b 1
)

endlocal
