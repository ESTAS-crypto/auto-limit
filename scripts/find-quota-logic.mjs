import fs from 'node:fs';
import path from 'node:path';

const base = 'C:/Users/MyBook Hype AMD/AppData/Local/Programs/Antigravity IDE/resources/app/out';

function searchIn(dir) {
  try {
    const list = fs.readdirSync(dir);
    for (const item of list) {
      const full = path.join(dir, item);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        searchIn(full);
      } else if (full.endsWith('.js')) {
        const content = fs.readFileSync(full, 'utf-8');
        const idx = content.indexOf('Weekly Limit Remaining');
        if (idx !== -1) {
          console.log('=== Found "Weekly Limit Remaining" in:', full);
          console.log(content.substring(Math.max(0, idx - 400), idx + 800));
        }
        const idx2 = content.indexOf('ARGON_LIMIT_REACHED');
        if (idx2 !== -1) {
          console.log('=== Found "ARGON_LIMIT_REACHED" in:', full);
          console.log(content.substring(Math.max(0, idx2 - 400), idx2 + 800));
        }
      }
    }
  } catch (e) {
    console.error(e);
  }
}

searchIn(base);
