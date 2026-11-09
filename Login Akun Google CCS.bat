@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Login Akun Google CCS Antigravity

echo ====================================================
echo      LOGIN AKUN GOOGLE ANTIGRAVITY KE CCS
echo ====================================================
echo.
echo Menghubungkan akun Google Antigravity Anda via CCS...
echo Jendela browser atau link OAuth akan muncul untuk login.
echo.

call "%APPDATA%\npm\ccs.cmd" agy --auth --accept-agr-risk
if %errorlevel% neq 0 (
    call ccs agy --auth --accept-agr-risk
)

echo.
echo ====================================================
echo Daftar akun Antigravity yang tersimpan di CCS:
call "%APPDATA%\npm\ccs.cmd" agy --accounts
echo ====================================================
echo.
echo Silakan buka Quota Radar untuk melihat kuota akun Anda.
pause

