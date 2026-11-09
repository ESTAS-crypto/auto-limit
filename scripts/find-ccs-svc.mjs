import fs from 'node:fs';

const filePath = 'C:\\\\Users\\\\MyBook Hype AMD\\\\AppData\\\\Local\\\\Programs\\\\Antigravity IDE\\\\resources\\\\app\\\\out\\\\vs\\\\workbench\\\\workbench.desktop.main.js';
const content = fs.readFileSync(filePath, 'utf-8');

let pos = 0;
while ((pos = content.indexOf('cloudCodeService', pos)) !== -1) {
  const snippet = content.slice(Math.max(0, pos - 150), pos + 250);
  if (snippet.includes('new ') || snippet.includes('class ') || snippet.includes('service') || snippet.includes('createInstance')) {
    console.log('Match at', pos);
    console.log(snippet);
    console.log('---');
  }
  pos += 16;
}

