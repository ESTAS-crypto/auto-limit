import fs from 'node:fs';

const filePath = 'C:\\\\Users\\\\MyBook Hype AMD\\\\AppData\\\\Local\\\\Programs\\\\Antigravity IDE\\\\resources\\\\app\\\\out\\\\vs\\\\workbench\\\\workbench.desktop.main.js';
const content = fs.readFileSync(filePath, 'utf-8');

// Look for HMc definition from line earlier: D=>D.retrieveUserQuotaSummary(lt(HMc,N))
const hmcIdx = content.indexOf('retrieveUserQuotaSummary(lt(');
console.log('retrieveUserQuotaSummary call:', content.slice(hmcIdx, hmcIdx + 80));

// Find definition of that message
const varNameMatch = content.slice(hmcIdx, hmcIdx + 80).match(/lt\(([^,]+),/);
if (varNameMatch) {
  const varName = varNameMatch[1];
  console.log('Message var name:', varName);
  const defIdx = content.indexOf(`${varName}=`);
  if (defIdx !== -1) {
    console.log('Definition of', varName, ':', content.slice(defIdx - 200, defIdx + 400));
  }
}

