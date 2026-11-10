@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Quota Radar

echo ====================================================
echo             MEMULAI QUOTA RADAR
echo ====================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js tidak ditemukan!
    echo Quota Radar memerlukan Node.js versi 20 atau lebih baru.
    echo Membuka halaman unduh Node.js...
    start https://nodejs.org/
    pause
    exit /b 1
)

for /f "usebackq tokens=*" %%i in (`node -e "console.log(process.versions.node.split('.')[0])"`) do set NODE_VER=%%i
if %NODE_VER% lss 20 (
    echo [ERROR] Versi Node.js Anda %NODE_VER% di bawah 20!
    echo Quota Radar memerlukan minimal Node.js v20.
    echo Membuka halaman unduh Node.js...
    start https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo [INFO] Menginstal dependensi paket - pertama kali jalan...
    if exist "package-lock.json" (
        call npm ci
    ) else (
        call npm install
    )
    if %errorlevel% neq 0 (
        echo [ERROR] Gagal menginstal dependensi.
        pause
        exit /b 1
    )
)

if not exist ".env.local" (
    echo [INFO] Konfigurasi belum ditemukan. Menjalankan wizard setup...
    call npm run setup
)

echo [INFO] Memverifikasi dan menyiapkan build produksi Next.js...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build produksi gagal.
    pause
    exit /b 1
)

echo.
echo [INFO] Menjalankan server dan background worker...
call npm run start:all

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Terjadi kesalahan saat menjalankan Quota Radar.
)
echo.
echo Quota Radar telah berhenti.
pause
