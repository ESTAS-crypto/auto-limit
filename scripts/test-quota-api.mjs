import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';

async function refreshAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed HTTP ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function testQuotaApi() {
  const targetEmail = process.argv[2] || 'evanatharasya461@gmail.com';
  const authDir = path.join(os.homedir(), '.ccs', 'cliproxy', 'auth');
  const authFiles = fs.readdirSync(authDir).filter(f => f.endsWith('.json'));
  
  let authFile = authFiles.find(f => f.includes(targetEmail)) || authFiles[0];
  if (!authFile) {
    console.error('Tidak ada file auth CCS di:', authDir);
    process.exit(1);
  }

  const fullPath = path.join(authDir, authFile);
  console.log('Menguji akun:', authFile);
  const auth = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));

  let token = auth.access_token;
  if (!token || auth.expired) {
    console.log('[Auth] Token lokal kedaluwarsa, me-refresh via OAuth endpoint...');
    token = await refreshAccessToken(auth.refresh_token);
  }

  const projectId = auth.project_id || 'aicode-consumers';
  const url = 'https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary';
  let summary = null;

  try {
    let res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'antigravity/1.107.0',
      },
      body: JSON.stringify({ project: projectId }),
    });

    if (res.status === 401 && auth.refresh_token) {
      token = await refreshAccessToken(auth.refresh_token);
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'antigravity/1.107.0',
        },
        body: JSON.stringify({ project: projectId }),
      });
    }

    const text = await res.text();
    try {
      summary = JSON.parse(text);
    } catch {
      summary = text;
    }
  } catch (err) {
    console.error('Error saat memanggil retrieveUserQuotaSummary:', err.message);
  }

  // Parse according to Quota Radar core logic
  const toPct = (frac) => Math.round(frac * 100);

  let gemini_pct = null;
  let gemini_resets_at = null;
  let gemini_source_path = null;
  let gemini_reason = null;

  let claude_pct = null;
  let claude_resets_at = null;
  let claude_source_path = null;
  let claude_reason = null;

  if (summary && Array.isArray(summary.groups)) {
    summary.groups.forEach((g, gIdx) => {
      const dName = String(g.displayName || g.display_name || '').toLowerCase();
      const isGemini = dName.includes('gemini');
      const isClaude = dName.includes('claude') || dName.includes('gpt');

      const buckets = Array.isArray(g.buckets) ? g.buckets : [];
      buckets.forEach((b, bIdx) => {
        const frac = b.remainingFraction ?? b.remaining_fraction;
        if (typeof frac === 'number' && Number.isFinite(frac)) {
          const pct = toPct(frac);
          const resetTime = b.resetTime || b.reset_time || null;
          const pathStr = `groups[${gIdx}].buckets[${bIdx}].${b.remainingFraction !== undefined ? 'remainingFraction' : 'remaining_fraction'}`;

          if (isGemini) {
            if (gemini_pct === null || pct < gemini_pct) {
              gemini_pct = pct;
              gemini_resets_at = resetTime;
              gemini_source_path = pathStr;
            }
          } else if (isClaude) {
            if (claude_pct === null || pct < claude_pct) {
              claude_pct = pct;
              claude_resets_at = resetTime;
              claude_source_path = pathStr;
            }
          }
        }
      });
    });
  }

  if (gemini_pct === null) {
    gemini_reason = "Grup 'Gemini Models' tidak ditemukan di retrieveUserQuotaSummary";
  }
  if (claude_pct === null) {
    claude_reason = "Grup 'Claude and GPT models' tidak ditemukan di retrieveUserQuotaSummary";
  }

  console.log('\n=================== RAW RESPONSE ===================');
  console.log(JSON.stringify(summary, null, 2));

  console.log('\n=================== HASIL NORMALISASI KUOTA ===================');
  console.log('Akun:', targetEmail);
  console.log('Gemini (mingguan)        :', gemini_pct !== null ? `${gemini_pct}% (reset: ${gemini_resets_at}, path: ${gemini_source_path})` : `Tidak diketahui (${gemini_reason})`);
  console.log('Claude dan GPT (mingguan):', claude_pct !== null ? `${claude_pct}% (reset: ${claude_resets_at}, path: ${claude_source_path})` : `Tidak diketahui (${claude_reason})`);

  const finiteVals = [gemini_pct, claude_pct].filter(v => typeof v === 'number' && Number.isFinite(v));
  const lowest = finiteVals.length > 0 ? Math.min(...finiteVals) : null;
  let status = 'tidak_diketahui';
  if (lowest !== null) {
    if (lowest <= 15) status = 'limit';
    else if (lowest <= 25) status = 'hampir_limit';
    else status = 'aktif';
  }

  console.log('\n=================== STATUS AKHIR ===================');
  console.log('Status Akun :', status.toUpperCase());
  console.log('Nilai Terendah:', lowest !== null ? `${lowest}%` : 'N/A');
}

testQuotaApi().catch(console.error);
