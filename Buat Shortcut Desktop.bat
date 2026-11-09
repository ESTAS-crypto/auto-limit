@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Buat Shortcut Desktop

echo ====================================================
echo        MEMBUAT SHORTCUT DESKTOP QUOTA RADAR
echo ====================================================
echo.

node scripts/create-shortcut.mjs

echo.
ping 127.0.0.1 -n 2 >nul
exit /b 0
