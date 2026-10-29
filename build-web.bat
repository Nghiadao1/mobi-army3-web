@echo off
cd /d "%~dp0"
echo ====================================================
echo   DONG GOI BAN WEB TINH (DIST/)
echo ====================================================
call npm.cmd run build
echo.
echo Hoan tat! Thu muc dist\ san sang upload len Web / GitHub Pages / itch.io / Capacitor APK.
pause

