#!/usr/bin/env node

/**
 * scripts/setup.mjs
 * Wizard Terminal Berbahasa Indonesia untuk Quota Radar.
 * Mengonfigurasi Supabase URL, Service Role Key, Encryption Key,
 * dan migrasi database.
 */

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  boldGreen: '\x1b[1;32m',
};

async function main() {
  console.clear();
  console.log(`${colors.boldGreen}====================================================${colors.reset}`);
  console.log(`${colors.boldGreen}          WIZARD SETUP QUOTA RADAR                  ${colors.reset}`);
  console.log(`${colors.dim}  Pemantau Kuota Akun Antigravity & Rotasi Otomatis  ${colors.reset}`);
  console.log(`${colors.boldGreen}====================================================${colors.reset}\n`);

  const rl = readline.createInterface({ input, output });
  const ask = async (q) => {
    try {
      return (await rl.question(q)).trim();
    } catch {
      return '';
    }
  };

  try {
    console.log(`${colors.cyan}[1/4] Konfigurasi Supabase${colors.reset}`);
    console.log(`Buka dashboard Supabase (https://supabase.com) > Project Settings > API.\n`);

    const supabaseUrl = await ask(`${colors.bright}Supabase Project URL${colors.reset} (contoh: https://xyz.supabase.co): `);
    const anonKey = await ask(`${colors.bright}Supabase Anon Key${colors.reset} (public): `);
    const serviceRoleKey = await ask(`${colors.bright}Supabase Service Role Key${colors.reset} (secret): `);

    // 2. Generate Kunci Enkripsi 32-byte
    console.log(`\n${colors.cyan}[2/4] Membuat Kunci Enkripsi (AES-256-GCM)${colors.reset}`);
    const encryptionKey = crypto.randomBytes(32).toString('hex');
    console.log(`${colors.green}✔ Kunci enkripsi 32-byte berhasil dibuat.${colors.reset}`);

    // 3. Tes koneksi Supabase jika URL diberikan
    console.log(`\n${colors.cyan}[3/4] Menguji Koneksi Supabase...${colors.reset}`);
    if (supabaseUrl && (serviceRoleKey || anonKey)) {
      try {
        const testRes = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/`, {
          headers: {
            apikey: serviceRoleKey || anonKey,
            Authorization: `Bearer ${serviceRoleKey || anonKey}`,
          },
        });
        if (testRes.ok || testRes.status === 404 || testRes.status === 200) {
          console.log(`${colors.green}✔ Koneksi ke Supabase berhasil diuji!${colors.reset}`);
        } else {
          console.log(`${colors.yellow}⚠ Mendapat status ${testRes.status} dari Supabase. Kunci mungkin perlu diperiksa kembali, namun konfigurasi tetap disimpan.${colors.reset}`);
        }
      } catch (err) {
        console.log(`${colors.yellow}⚠ Tidak dapat menghubungi URL Supabase (${err.message}). Konfigurasi tetap akan disimpan.${colors.reset}`);
      }
    } else {
      console.log(`${colors.dim}Kunci Supabase dilewati. Mode MockProvider akan aktif secara default.${colors.reset}`);
    }

    // 4. Migrasi Database Postgres
    console.log(`\n${colors.cyan}[4/4] Migrasi Database Postgres${colors.reset}`);
    console.log(`Pilihan migrasi:`);
    console.log(`1. Otomatis lewat Connection String Postgres`);
    console.log(`2. Manual lewat Supabase SQL Editor (Salin file .sql)`);
    
    const dbUrl = await ask(`\nMasukkan Connection String Postgres (tekan Enter untuk lewati manual): `);

    let migrationExecuted = false;
    if (dbUrl) {
      console.log(`Menjalankan migrasi otomatis...`);
      try {
        // Dinamis import pg jika terpasang
        const { default: pg } = await import('pg');
        const client = new pg.Client({
          connectionString: dbUrl,
          ssl: { rejectUnauthorized: false },
        });
        await client.connect();

        const migrationSql = fs.readFileSync(path.join(rootDir, 'supabase', 'migrations', '0001_init.sql'), 'utf-8');
        await client.query(migrationSql);

        const seedSql = fs.readFileSync(path.join(rootDir, 'supabase', 'seed.sql'), 'utf-8');
        await client.query(seedSql);

        await client.end();
        console.log(`${colors.green}✔ Migrasi dan seed database berhasil dijalankan!${colors.reset}`);
        migrationExecuted = true;
      } catch (err) {
        console.log(`${colors.red}✖ Gagal menjalankan migrasi otomatis: ${err.message}${colors.reset}`);
        console.log(`${colors.yellow}Silakan jalankan migrasi secara manual via Supabase SQL Editor.${colors.reset}`);
      }
    }

    if (!migrationExecuted) {
      console.log(`\n${colors.yellow}---------------- PETUNJUK MIGRASI MANUAL ----------------${colors.reset}`);
      console.log(`1. Buka project Supabase Anda di peramban.`);
      console.log(`2. Pilih menu "SQL Editor" di bilah sisi kiri.`);
      console.log(`3. Salin dan tempel isi file:`);
      console.log(`   - ${colors.bright}supabase/migrations/0001_init.sql${colors.reset}`);
      console.log(`   - ${colors.bright}supabase/seed.sql${colors.reset} (opsional data awal)`);
      console.log(`4. Klik tombol "Run" untuk mengeksekusi tabel dan RLS.`);
      console.log(`${colors.yellow}----------------------------------------------------------${colors.reset}\n`);
    }

    // 5. Tulis .env.local
    const envContent = [
      `# Quota Radar Environment Configuration`,
      `NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl || 'https://your-project.supabase.co'}`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey || 'your-anon-key'}`,
      `SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey || 'your-service-role-key'}`,
      `ENCRYPTION_KEY=${encryptionKey}`,
      `DATABASE_URL=${dbUrl || ''}`,
      `QUOTA_PROVIDER=mock`,
      `CCS_HOME=`,
      `ANTIGRAVITY_CLI_DIR=`,
      `SWITCH_COMMAND=`,
      `PORT=3000`,
      `HOST=127.0.0.1`,
      `POLL_INTERVAL_SECONDS=60`,
      '',
    ].join('\n');

    fs.writeFileSync(path.join(rootDir, '.env.local'), envContent, 'utf-8');
    console.log(`${colors.green}✔ File .env.local berhasil disimpan.${colors.reset}`);

    // Pastikan .gitignore memuat .env.local
    const gitignorePath = path.join(rootDir, '.gitignore');
    let gitignoreContent = '';
    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    }
    if (!gitignoreContent.includes('.env*.local') && !gitignoreContent.includes('.env.local')) {
      fs.appendFileSync(gitignorePath, '\n.env*.local\n.env\n', 'utf-8');
      console.log(`${colors.green}✔ .gitignore diperbarui.${colors.reset}`);
    }

    console.log(`\n${colors.boldGreen}====================================================${colors.reset}`);
    console.log(`${colors.boldGreen}         SETUP SELESAI & SIAP DIGUNAKAN!            ${colors.reset}`);
    console.log(`${colors.dim}  Jalankan Quota Radar dengan:                       ${colors.reset}`);
    console.log(`  ${colors.bright}Mulai Quota Radar.bat${colors.reset} (Windows) atau ${colors.bright}./mulai.sh${colors.reset} (Linux/Mac)`);
    console.log(`${colors.boldGreen}====================================================${colors.reset}\n`);

  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(`\n${colors.red}Terjadi kesalahan saat wizard setup:${colors.reset}`, err);
  process.exit(1);
});

