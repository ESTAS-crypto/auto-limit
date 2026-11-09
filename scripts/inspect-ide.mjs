import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Antigravity IDE', 'User', 'globalStorage', 'state.vscdb');

if (fs.existsSync(dbPath)) {
  const db = new DatabaseSync(dbPath, { open: true, readOnly: true });
  const rows = db.prepare("SELECT key, value FROM ItemTable").all();
  
  const matches = rows.filter(r => {
    const k = r.key.toLowerCase();
    const v = (r.value || '').toString().toLowerCase();
    return k.includes('quota') || k.includes('model') || v.includes('weekly limit') || v.includes('bangcuy');
  });

  console.log(`Total rows: ${rows.length}, Matches: ${matches.length}`);
  for (const m of matches.slice(0, 10)) {
    console.log(`KEY: ${m.key}`);
    console.log(`VAL: ${m.value.toString().slice(0, 300)}\n`);
  }
} else {
  console.log('Database not found at', dbPath);
}

