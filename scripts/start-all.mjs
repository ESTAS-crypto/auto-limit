#!/usr/bin/env node

/**
 * scripts/start-all.mjs
 * Menjalankan server Next.js dan Background Polling Worker secara bersamaan.
 * Memilih port kosong mulai dari 3000 jika port 3000 sedang terpakai,
 * menunggu hingga server siap, lalu otomatis membuka antarmuka di peramban.
 */

import net from 'node:net';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Muat .env.local jika ada
dotenv.config({ path: path.join(rootDir, '.env.local') });

const PID_FILE = path.join(rootDir, '.radar.pids');

function isPortAvailable(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function findAvailablePort(startPort = 3000, host = '127.0.0.1') {
  let port = startPort;
  while (port < startPort + 50) {
    const available = await isPortAvailable(port, host);
    if (available) return port;
    console.log(`Port ${port} sedang digunakan, mencoba port ${port + 1}...`);
    port++;
  }
  throw new Error(`Tidak ditemukan port kosong antara ${startPort} dan ${startPort + 50}`);
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 200 || res.status === 404) {
        return true;
      }
    } catch {
      // Tunggu 500ms lalu coba lagi
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function openBrowser(url) {
  const platform = process.platform;
  let command = '';
  let args = [];

  if (platform === 'win32') {
    command = 'cmd.exe';
    args = ['/c', 'start', '', url];
  } else if (platform === 'darwin') {
    command = 'open';
    args = [url];
  } else {
    command = 'xdg-open';
    args = [url];
  }

  try {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.unref();
  } catch (err) {
    console.log(`Buka peramban manual di: ${url}`);
  }
}

async function main() {
  const defaultPort = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || '127.0.0.1';

  console.log('\n[Quota Radar] Mencari port yang tersedia...');
  const port = await findAvailablePort(defaultPort, host);
  const targetUrl = `http://${host === '127.0.0.1' ? 'localhost' : host}:${port}`;

  console.log(`[Quota Radar] Port aktif: ${port}`);
  console.log(`[Quota Radar] Alamat web: ${targetUrl}`);

  // Catat PID
  const pids = [];

  const cleanup = () => {
    console.log('\n[Quota Radar] Menghentikan server dan worker...');
    if (fs.existsSync(PID_FILE)) {
      try { fs.unlinkSync(PID_FILE); } catch {}
    }
    for (const p of pids) {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', p.pid.toString(), '/f', '/t']);
        } else {
          process.kill(-p.pid, 'SIGTERM');
        }
      } catch {}
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // 1. Jalankan Next.js Server
  console.log('[Quota Radar] Memulai Next.js web server...');
  const isWindows = process.platform === 'win32';
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';

  const nextProcess = spawn(npmCmd, ['run', 'next:start', '--', '-p', port.toString(), '-H', host], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: isWindows,
    env: { ...process.env, PORT: port.toString(), HOST: host },
  });
  pids.push(nextProcess);

  // 2. Jalankan Background Worker
  console.log('[Quota Radar] Memulai Background Polling Worker...');
  const workerProcess = spawn(npmCmd, ['run', 'worker:run'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: isWindows,
    env: { ...process.env, PORT: port.toString(), HOST: host },
  });
  pids.push(workerProcess);

  // Simpan PID
  fs.writeFileSync(PID_FILE, JSON.stringify(pids.map((p) => p.pid)), 'utf-8');

  // 3. Tunggu server online lalu buka peramban
  console.log(`[Quota Radar] Menunggu server siap di ${targetUrl}...`);
  const ready = await waitForServer(targetUrl);
  if (ready) {
    console.log(`[Quota Radar] Server siap! Membuka peramban...`);
    openBrowser(targetUrl);
  } else {
    console.log(`[Quota Radar] Silakan buka peramban di: ${targetUrl}`);
  }

  // Jaga proses tetap berjalan
  await Promise.race([
    new Promise((resolve) => nextProcess.on('exit', resolve)),
    new Promise((resolve) => workerProcess.on('exit', resolve)),
  ]);

  cleanup();
}

main().catch((err) => {
  console.error('[Quota Radar] Kesalahan saat memulai:', err);
  process.exit(1);
});

