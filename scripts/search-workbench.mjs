import fs from 'node:fs';

const filePath = 'C:\\\\Users\\\\MyBook Hype AMD\\\\AppData\\\\Local\\\\Programs\\\\Antigravity IDE\\\\resources\\\\app\\\\out\\\\vs\\\\workbench\\\\workbench.desktop.main.js';
const content = fs.readFileSync(filePath, 'utf-8');

console.log('File size:', content.length);

const terms = ['argon', 'starter quota', 'weekly limit', 'quota-reached', 'refresh on', 'baseline quota'];
for (const t of terms) {
  let pos = 0;
  let matches = 0;
  while ((pos = content.toLowerCase().indexOf(t, pos)) !== -1) {
    matches++;
    if (matches <= 2) {
      console.log(`Match for "${t}" at ${pos}:`);
      console.log(content.slice(Math.max(0, pos - 150), pos + 250));
      console.log('---');
    }
    pos += t.length;
  }
  console.log(`Total matches for "${t}": ${matches}`);
}

