@echo off
cd /d "%~dp0"
echo ====================================================
echo   KHOI DONG ARMY 3 OFFLINE WEB (VITE DEV SERVER)
echo   Mo trinh duyet tai: http://localhost:5173
echo ====================================================
start "" "http://localhost:5173"
call npm.cmd run dev
pause

