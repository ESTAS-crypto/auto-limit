#!/usr/bin/env bash

# mulai.sh: Menjalankan Quota Radar di macOS dan Linux

set -e
cd "$(dirname "$0")"

echo "===================================================="
echo "            MEMULAI QUOTA RADAR (UNIX)             "
echo "===================================================="
echo ""

# 1. Cek Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js tidak ditemukan!"
    echo "Quota Radar memerlukan Node.js versi 20 atau lebih baru."
    exit 1
fi

NODE_VER=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_VER" -lt 20 ]; then
    echo "[ERROR] Versi Node.js Anda ($NODE_VER) di bawah 20!"
    echo "Quota Radar memerlukan minimal Node.js v20."
    exit 1
fi

# 2. Cek node_modules
if [ ! -d "node_modules" ]; then
    echo "[INFO] Menginstal dependensi paket..."
    if [ -f "package-lock.json" ]; then
        npm ci
    else
        npm install
    fi
fi

# 3. Cek .env.local
if [ ! -f ".env.local" ]; then
    echo "[INFO] Konfigurasi belum ditemukan. Menjalankan wizard setup..."
    npm run setup
fi

# 4. Cek folder .next (build)
if [ ! -d ".next" ]; then
    echo "[INFO] Menyiapkan build produksi Next.js..."
    npm run build
fi

# 5. Jalankan start:all
echo "[INFO] Menjalankan server dan background worker..."
npm run start:all

