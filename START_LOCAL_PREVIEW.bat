@echo off
cd /d "%~dp0"
echo Starting local preview...
where node >nul 2>nul
if %errorlevel%==0 (
  node server.js
) else (
  start "" index.html
)
pause
