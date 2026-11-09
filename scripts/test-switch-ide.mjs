import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

export function switchIdeAccount(targetEmail) {
  const authDir = path.join(os.homedir(), '.ccs', 'cliproxy', 'auth');
  let authFile = null;
  if (fs.existsSync(authDir)) {
    for (const f of fs.readdirSync(authDir)) {
      if (f.toLowerCase().includes(targetEmail.toLowerCase()) && f.endsWith('.json')) {
        authFile = path.join(authDir, f);
        break;
      }
    }
  }

  if (!authFile) {
    return { ok: false, message: `Auth file for ${targetEmail} not found in ${authDir}` };
  }

  const authData = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
  const accessToken = authData.access_token;
  if (!accessToken) {
    return { ok: false, message: 'Access token missing' };
  }

  const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Antigravity IDE', 'User', 'globalStorage', 'state.vscdb');
  if (!fs.existsSync(dbPath)) {
    return { ok: false, message: `state.vscdb not found at ${dbPath}` };
  }

  try {
    const db = new DatabaseSync(dbPath, { open: true });
    const row = db.prepare('SELECT value FROM ItemTable WHERE key = ?').get('antigravityAuthStatus');
    let statusData = {};
    if (row && row.value) {
      try {
        statusData = JSON.parse(row.value.toString());
      } catch {}
    }

    statusData.email = targetEmail;
    statusData.apiKey = accessToken;
    statusData.name = targetEmail.split('@')[0];
    // Remove stale proto so IDE refreshes user status for the new account
    delete statusData.userStatusProtoBinaryBase64;

    db.prepare('INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)').run(
      'antigravityAuthStatus',
      JSON.stringify(statusData)
    );
    db.close();
    return { ok: true, message: `Antigravity IDE account successfully switched to ${targetEmail}` };
  } catch (err) {
    return { ok: false, message: `SQLite error: ${err.message}` };
  }
}

const res = switchIdeAccount('etiksilawati21@gmail.com');
console.log('Result:', res);

