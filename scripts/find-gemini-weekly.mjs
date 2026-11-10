// Mencari DI MANA angka Gemini mingguan (misal 33%) berada di balasan Google.
// Pakai (dari folder project):
//   node --env-file=.env.local scripts/find-gemini-weekly.mjs claudeai259@gmail.com 33
// Angka kedua = persen Gemini yang tampil di IDE (Models & Usage) untuk akun itu.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [email, targetArg] = process.argv.slice(2);
const target = Number(targetArg);
if (!email || !Number.isFinite(target)) {
  console.log('Pakai: node --env-file=.env.local scripts/find-gemini-weekly.mjs email@gmail.com 33');
  process.exit(1);
}

const authDir = path.join(os.homedir(), '.ccs', 'cliproxy', 'auth');
let authFile = null;
for (const f of fs.existsSync(authDir) ? fs.readdirSync(authDir) : []) {
  if (!f.endsWith('.json') || !/^(agy|antigravity)-/.test(f)) continue;
  try {
    const d = JSON.parse(fs.readFileSync(path.join(authDir, f), 'utf-8'));
    if ((d.email || '').toLowerCase() === email.toLowerCase()) { authFile = d; break; }
  } catch {}
}
if (!authFile) { console.log('File auth CCS untuk akun ini tidak ditemukan di', authDir); process.exit(1); }

const { GOOGLE_OAUTH_CLIENT_ID: cid, GOOGLE_OAUTH_CLIENT_SECRET: sec } = process.env;
if (!cid || !sec) { console.log('GOOGLE_OAUTH_CLIENT_ID/SECRET belum terbaca. Jalankan dengan --env-file=.env.local'); process.exit(1); }

const tr = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ client_id: cid, client_secret: sec, refresh_token: authFile.refresh_token, grant_type: 'refresh_token' }),
});
if (!tr.ok) { console.log('Gagal refresh token, status', tr.status); process.exit(1); }
const token = (await tr.json()).access_token;
const project = authFile.project_id || 'aicode-consumers';

const H_MODELS = { 'Content-Type': 'application/json', 'User-Agent': 'antigravity/1.104.0 darwin/arm64' };
const H_LCA = { 'Content-Type': 'application/json', 'User-Agent': 'antigravity/1.21.9 darwin/arm64 google-api-nodejs-client/10.3.0', 'X-Goog-Api-Client': 'gl-node/22.21.1' };
const LCA_BODY = { metadata: { ide_name: 'antigravity', ide_type: 'ANTIGRAVITY', ide_version: '1.21.9' } };
const calls = [
  ['retrieveUserQuotaSummary', { project }, H_MODELS],
  ['retrieveUserQuotaSummary', {}, H_MODELS],
  ['fetchAvailableModels', {}, H_MODELS],
  ['fetchAvailableModels', { project }, H_MODELS],
  ['retrieveUserQuota', { project }, H_MODELS],
  ['loadCodeAssist', LCA_BODY, H_LCA],
];

const mask = (s) => String(s).replace(/[\w.+-]+@[\w.-]+/g, '[email]').replace(/ya29\.[\w-]+/g, '[token]');
const hits = [];
function walk(v, p) {
  if (typeof v === 'number') {
    const asFrac = Math.abs(v * 100 - target) <= 1.5 && v >= 0 && v <= 1;
    const asPct = Math.abs(v - target) < 0.5 && v > 1 && v <= 100;
    if (asFrac || asPct) hits.push([p, v]);
  } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, p ? `${p}.${k}` : k);
}

for (const [name, body, headers] of calls) {
  const url = `https://cloudcode-pa.googleapis.com/v1internal:${name}`;
  const label = `${name} ${mask(JSON.stringify(body)).slice(0, 40)}`;
  try {
    const res = await fetch(url, { method: 'POST', headers: { ...headers, Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    console.log(`\n=== ${label} -> HTTP ${res.status}`);
    if (!json) { console.log(mask(text).slice(0, 300)); continue; }
    console.log('kunci teratas:', Object.keys(json).join(', ') || '(kosong)');
    hits.length = 0; walk(json, '');
    if (hits.length) hits.slice(0, 12).forEach(([p, v]) => console.log(`  COCOK ${v}  di  ${p}`));
    else console.log(`  tidak ada angka yang cocok dengan ${target}%`);
    if (name === 'fetchAvailableModels' && json.models) {
      for (const [id, m] of Object.entries(json.models)) {
        const q = m.quotaInfo || m.quota_info;
        if (q) console.log(`  model ${id}: sisa=${q.remainingFraction ?? q.remaining_fraction ?? '(tidak ada)'} reset=${q.resetTime ?? q.reset_time ?? '-'}`);
      }
    }
  } catch (e) { console.log(`\n=== ${label} -> galat: ${e.message}`); }
}
console.log('\nSelesai. Tempel semua keluaran di atas (email dan token sudah disamarkan).');
