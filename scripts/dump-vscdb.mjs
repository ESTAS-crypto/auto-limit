import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import os from 'node:os';

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Antigravity IDE', 'User', 'globalStorage', 'state.vscdb');
const db = new DatabaseSync(dbPath, { open: true, readOnly: true });
const rows = db.prepare("SELECT key, value FROM ItemTable").all();

console.log('Total keys in state.vscdb:', rows.length);
for (const r of rows) {
  const k = r.key;
  const v = r.value ? r.value.toString() : '';
  if (
    k.toLowerCase().includes('quota') ||
    k.toLowerCase().includes('model') ||
    k.toLowerCase().includes('limit') ||
    k.toLowerCase().includes('antigravity') ||
    v.toLowerCase().includes('quota') ||
    v.toLowerCase().includes('limit')
  ) {
    // Sanitize any potential token
    const safeV = v.replace(/ya29\.[a-zA-Z0-9_-]+/g, '[MASKED_TOKEN]');
    console.log(`KEY: ${k}`);
    console.log(`VAL: ${safeV.slice(0, 300)}\n`);
  }
}

