import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

export function getActiveIdeAccount(): { email: string; name: string } | null {
  const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Antigravity IDE', 'User', 'globalStorage', 'state.vscdb');
  if (!fs.existsSync(dbPath)) return null;

  try {
    const db = new DatabaseSync(dbPath, { open: true, readOnly: true });
    const row = db.prepare('SELECT value FROM ItemTable WHERE key = ?').get('antigravityAuthStatus') as { value?: string } | undefined;
    db.close();
    if (row && row.value) {
      const parsed = JSON.parse(row.value.toString());
      if (parsed.email) {
        return { email: parsed.email, name: parsed.name || parsed.email.split('@')[0] };
      }
    }
  } catch {}
  return null;
}

export function switchIdeAccount(targetEmail: string): { ok: boolean; message: string } {
  const authDir = path.join(os.homedir(), '.ccs', 'cliproxy', 'auth');
  let authFile: string | null = null;
  if (fs.existsSync(authDir)) {
    for (const f of fs.readdirSync(authDir)) {
      if (f.toLowerCase().includes(targetEmail.toLowerCase()) && f.endsWith('.json')) {
        authFile = path.join(authDir, f);
        break;
      }
    }
  }

  if (!authFile) {
    return { ok: false, message: `File autentikasi untuk ${targetEmail} belum ada di CCS.` };
  }

  try {
    const authData = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
    const accessToken = authData.access_token;
    if (!accessToken) {
      return { ok: false, message: 'Access token tidak ditemukan dalam file autentikasi.' };
    }

    const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Antigravity IDE', 'User', 'globalStorage', 'state.vscdb');
    if (!fs.existsSync(dbPath)) {
      return { ok: false, message: `state.vscdb Antigravity tidak ditemukan di ${dbPath}` };
    }

    const db = new DatabaseSync(dbPath, { open: true });
    const row = db.prepare('SELECT value FROM ItemTable WHERE key = ?').get('antigravityAuthStatus') as { value?: string } | undefined;
    let statusData: Record<string, any> = {};
    if (row && row.value) {
      try {
        statusData = JSON.parse(row.value.toString());
      } catch {}
    }

    statusData.email = targetEmail;
    statusData.apiKey = accessToken;
    statusData.name = targetEmail.split('@')[0];
    // Hapus proto binary lama agar Antigravity IDE merefresh profil pengguna yang baru
    delete statusData.userStatusProtoBinaryBase64;

    db.prepare('INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)').run(
      'antigravityAuthStatus',
      JSON.stringify(statusData)
    );
    db.close();

    return { ok: true, message: `Antigravity IDE berhasil beralih ke akun ${targetEmail}` };
  } catch (err: any) {
    return { ok: false, message: `Gagal memperbarui database Antigravity IDE: ${err.message}` };
  }
}

