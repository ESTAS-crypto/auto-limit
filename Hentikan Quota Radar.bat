@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Hentikan Quota Radar

echo ====================================================
echo             MENGHENTIKAN QUOTA RADAR
echo ====================================================
echo.

node scripts/stop.mjs

echo.
ping 127.0.0.1 -n 2 >nul
exit /b 0
