/**
 * scripts/stop.mjs
 * Menghentikan proses Quota Radar (Next.js server & worker) dengan rapi.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const PID_FILE = path.join(rootDir, '.radar.pids');

async function killPid(pid) {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      const child = spawn('taskkill', ['/pid', pid.toString(), '/f', '/t'], { stdio: 'ignore' });
      child.on('close', () => resolve());
      child.on('error', () => resolve());
    } else {
      try {
        process.kill(-pid, 'SIGTERM');
      } catch {}
      resolve();
    }
  });
}

async function main() {
  console.log('[Quota Radar] Menghentikan server dan background worker...');

  let stoppedCount = 0;

  if (fs.existsSync(PID_FILE)) {
    try {
      const raw = fs.readFileSync(PID_FILE, 'utf-8');
      const pids = JSON.parse(raw);
      for (const pid of pids) {
        console.log(`Menghentikan proses (PID: ${pid})...`);
        await killPid(pid);
        stoppedCount++;
      }
      fs.unlinkSync(PID_FILE);
    } catch {}
  }

  // Windows port listener cleanup jika port 3000 masih menggantung
  if (process.platform === 'win32') {
    const netstat = spawn('netstat', ['-aon']);
    let output = '';
    netstat.stdout?.on('data', (d) => { output += d.toString(); });
    await new Promise((r) => netstat.on('close', r));

    // Bersihkan proses orphan worker atau start-all
    try {
      const wmic = spawn('powershell', [
        '-NoProfile',
        '-Command',
        'Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*worker/index.ts*" -or $_.CommandLine -like "*start-all.mjs*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }',
      ]);
      await new Promise((r) => wmic.on('close', r));
    } catch {}
  }

  console.log('✔ Quota Radar telah dihentikan dengan rapi.');
}

main().catch((err) => {
  console.error('Gagal menghentikan Quota Radar:', err.message);
  process.exit(1);
});

