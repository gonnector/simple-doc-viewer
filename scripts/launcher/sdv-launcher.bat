@echo off
chcp 65001 >nul 2>&1
REM SDV Launcher - auto server + PWA app window
REM 1. If port 3000 is LISTENING, open PWA window immediately
REM 2. Otherwise spawn minimized server window, wait 3s, then open PWA
REM 3. PWA window via Chrome/Edge --app flag

setlocal
set "SERVER_DIR=E:\project\simple-doc-viewer"
set "SERVER_PORT=3000"
set "SERVER_URL=http://localhost:%SERVER_PORT%/"

REM Port listening check
netstat -ano | findstr ":%SERVER_PORT% " | findstr LISTENING >nul 2>&1
if errorlevel 1 (
  REM Server not running - spawn minimized
  start "SDV Server" /MIN cmd /c "cd /d %SERVER_DIR% && node server.js"
  timeout /t 3 /nobreak >nul
)

REM Find installed browser (Edge first, then Chrome)
set "BROWSER="
for %%B in (
  "%PROGRAMFILES(X86)%\Microsoft\Edge\Application\msedge.exe"
  "%PROGRAMFILES%\Microsoft\Edge\Application\msedge.exe"
  "%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"
  "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
  "%PROGRAMFILES%\Google\Chrome\Application\chrome.exe"
  "%PROGRAMFILES(X86)%\Google\Chrome\Application\chrome.exe"
) do (
  if exist %%~B (
    set "BROWSER=%%~B"
    goto :launch
  )
)

:launch
if defined BROWSER (
  start "" "%BROWSER%" --app=%SERVER_URL%
) else (
  start "" "%SERVER_URL%"
)

endlocal
