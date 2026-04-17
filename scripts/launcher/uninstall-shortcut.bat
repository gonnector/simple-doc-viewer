@echo off
chcp 65001 >nul 2>&1
setlocal

set "SHORTCUT_NAME=SDV-auto"
set "START_MENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs"
set "SHORTCUT_PATH=%START_MENU%\%SHORTCUT_NAME%.lnk"

if exist "%SHORTCUT_PATH%" (
  del "%SHORTCUT_PATH%"
  echo   [OK] Shortcut removed: %SHORTCUT_PATH%
) else (
  echo   [SKIP] No shortcut found: %SHORTCUT_PATH%
)

endlocal
