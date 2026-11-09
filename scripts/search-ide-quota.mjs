import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';

function searchDir(dir, pattern, depth = 0) {
  if (depth > 4 || !fs.existsSync(dir)) return [];
  let results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const fullPath = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        results = results.concat(searchDir(fullPath, pattern, depth + 1));
      } else if (ent.isFile()) {
        if (ent.name.endsWith('.json') || ent.name.endsWith('.vscdb') || ent.name.endsWith('.log')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            if (pattern.test(content)) {
              results.push(fullPath);
            }
          } catch {}
        }
      }
    }
  } catch {}
  return results;
}

console.log('Searching for Weekly Limit or 6:29:44 or 11/15/2026...');
const appData = path.join(os.homedir(), 'AppData', 'Roaming', 'Antigravity IDE');
const antigravityDot = path.join(os.homedir(), '.antigravity');

const r1 = searchDir(appData, /Weekly Limit|ARGON|baseline quota|6:29:44|6:04:10/i);
console.log('Found in AppData:', r1);

const r2 = searchDir(antigravityDot, /Weekly Limit|ARGON|baseline quota|6:29:44|6:04:10/i);
console.log('Found in .antigravity:', r2);

