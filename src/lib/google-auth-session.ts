import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { getCcsAuthDir, fetchLiveQuota, RealQuotaResult } from './ccs-quota';
import { getAccountsWithStatus, saveAccount, saveQuotaSnapshot, getServerSupabase } from './supabase';

interface ActiveSession {
  child: ChildProcess;
  authUrl: string | null;
  startedAt: number;
  initialFiles: Set<string>;
  completed: boolean;
  result?: RealQuotaResult;
  error?: string;
}

// Global in-memory singleton for the active login session
declare global {
  // eslint-disable-next-line no-var
  var __googleOAuthSession: ActiveSession | undefined;
}

function getBinPath(): string {
  return path.join(os.homedir(), '.ccs', 'cliproxy', 'bin', 'original', 'cli-proxy-api.exe');
}

function getConfigPath(): string {
  return path.join(os.homedir(), '.ccs', 'cliproxy', 'config.yaml');
}

export async function startGoogleOAuthSession(): Promise<{ authUrl: string }> {
  // Jika ada sesi lama yang masih jalan, hentikan dulu
  if (global.__googleOAuthSession && !global.__googleOAuthSession.completed) {
    try {
      global.__googleOAuthSession.child.kill();
    } catch {
      // Abaikan
    }
    global.__googleOAuthSession = undefined;
  }

  const binPath = getBinPath();
  const configPath = getConfigPath();
  const authDir = getCcsAuthDir();

  if (!fs.existsSync(binPath)) {
    throw new Error(`CLIProxy API binary tidak ditemukan di: ${binPath}`);
  }
  if (!fs.existsSync(configPath)) {
    throw new Error(`Konfigurasi CCS tidak ditemukan di: ${configPath}`);
  }

  // Pastikan direktori auth ada
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Rekam file auth yang sudah ada sebelum proses baru dimulai
  const initialFiles = new Set(fs.readdirSync(authDir));
  const startedAt = Date.now();

  return new Promise<{ authUrl: string }>((resolve, reject) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error('Batas waktu menunggu URL login Google habis (8 detik). Coba lagi.'));
      }
    }, 10000);

    const child = spawn(binPath, [
      '-config', configPath,
      '-antigravity-login',
      '-no-browser'
    ]);

    const session: ActiveSession = {
      child,
      authUrl: null,
      startedAt,
      initialFiles,
      completed: false,
    };
    global.__googleOAuthSession = session;

    child.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      const match = text.match(/(https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth[^\s]+)/);
      if (match && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        session.authUrl = match[1];
        resolve({ authUrl: match[1] });
      }
    });

    child.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      if (!resolved && text.includes('error')) {
        console.warn('[Google OAuth Error]', text);
      }
    });

    child.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(new Error(`Gagal menjalankan CLIProxy: ${err.message}`));
      }
    });

    child.on('close', (code) => {
      if (!session.completed && code !== 0 && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(new Error(`Proses login Google keluar lebih awal dengan kode: ${code}`));
      }
    });
  });
}

export async function checkGoogleOAuthStatus(): Promise<{
  completed: boolean;
  authUrl?: string | null;
  account?: RealQuotaResult;
  error?: string;
}> {
  const session = global.__googleOAuthSession;
  if (!session) {
    return { completed: false, error: 'Tidak ada sesi login Google yang aktif.' };
  }

  if (session.completed && session.result) {
    return { completed: true, account: session.result };
  }

  // Periksa apakah ada file auth baru atau yang diperbarui di authDir
  const authDir = getCcsAuthDir();
  if (fs.existsSync(authDir)) {
    const currentFiles = fs.readdirSync(authDir);
    let newlyCreatedOrModified: string | null = null;

    for (const f of currentFiles) {
      if (!f.endsWith('.json')) continue;
      if (!f.startsWith('agy-') && !f.startsWith('antigravity-')) continue;

      const fp = path.join(authDir, f);
      try {
        const stats = fs.statSync(fp);
        // Jika file belum ada sebelumnya ATAU diubah setelah sesi dimulai
        if (!session.initialFiles.has(f) || stats.mtimeMs >= session.startedAt - 2000) {
          newlyCreatedOrModified = fp;
          break;
        }
      } catch {
        // Abaikan
      }
    }

    if (newlyCreatedOrModified) {
      try {
        const content = fs.readFileSync(newlyCreatedOrModified, 'utf-8');
        const data = JSON.parse(content);
        const email = data.email;

        if (email && email.includes('@')) {
          // Ambil kuota live langsung dari Google Cloud Code API!
          const liveData = await fetchLiveQuota(email);

          // Simpan atau perbarui akun di Supabase / PostgreSQL
          const allAccounts = await getAccountsWithStatus();
          const existing = allAccounts.find((a) => a.email.toLowerCase() === email.toLowerCase());

          let accountId: string;
          if (existing) {
            accountId = existing.id;
            const sb = getServerSupabase();
            if (sb) {
              await sb
                .from('accounts')
                .update({
                  tier: liveData.tier,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);
            }
          } else {
            const saved = await saveAccount({
              email,
              nickname: email.split('@')[0],
              tier: liveData.tier,
              tracked_models: ['claude', 'gemini'],
              in_rotation: true,
              paused: false,
            });
            accountId = saved.id;
          }

          // Simpan snapshot kuota awal jika data ada
          if (typeof liveData.claude_pct === 'number' && Number.isFinite(liveData.claude_pct)) {
            await saveQuotaSnapshot({
              account_id: accountId,
              model: 'claude',
              remaining_pct: liveData.claude_pct,
              resets_at: liveData.claude_resets_at,
            });
          }
          if (typeof liveData.gemini_pct === 'number' && Number.isFinite(liveData.gemini_pct)) {
            await saveQuotaSnapshot({
              account_id: accountId,
              model: 'gemini',
              remaining_pct: liveData.gemini_pct,
              resets_at: liveData.gemini_resets_at,
            });
          }
          if (typeof liveData.mingguan_pct === 'number' && Number.isFinite(liveData.mingguan_pct)) {
            await saveQuotaSnapshot({
              account_id: accountId,
              model: 'mingguan',
              remaining_pct: liveData.mingguan_pct,
              resets_at: liveData.mingguan_resets_at,
            });
          }

          session.completed = true;
          session.result = liveData;

          // Hentikan proses child dengan rapi
          try {
            session.child.kill();
          } catch {
            // Abaikan
          }

          return { completed: true, account: liveData };
        }
      } catch (err: any) {
        console.error('[OAuth Parse Error]', err);
      }
    }
  }

  return { completed: false, authUrl: session.authUrl };
}

export function cancelGoogleOAuthSession(): void {
  if (global.__googleOAuthSession) {
    try {
      global.__googleOAuthSession.child.kill();
    } catch {
      // Abaikan
    }
    global.__googleOAuthSession = undefined;
  }
}
