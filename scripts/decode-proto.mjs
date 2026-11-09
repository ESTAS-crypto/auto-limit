import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import os from 'node:os';

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Antigravity IDE', 'User', 'globalStorage', 'state.vscdb');
const db = new DatabaseSync(dbPath, { open: true, readOnly: true });
const row = db.prepare('SELECT value FROM ItemTable WHERE key = ?').get('antigravityAuthStatus');

if (row) {
  const data = JSON.parse(row.value);
  console.log('Keys in antigravityAuthStatus:', Object.keys(data));
  console.log('Email:', data.email);
  if (data.userStatusProtoBinaryBase64) {
    const buf = Buffer.from(data.userStatusProtoBinaryBase64, 'base64');
    console.log('Buffer length:', buf.length);
    // Print printable ASCII strings from buffer
    const str = buf.toString('latin1');
    const strings = str.match(/[\x20-\x7E]{4,}/g) || [];
    console.log('Printable strings in proto:');
    console.log(strings);
  }
}

