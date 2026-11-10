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
  const endpoints = [
    {
      name: 'retrieveUserQuotaSummary',
      url: 'https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary',
      body: { project: projectId },
    },
    {
      name: 'retrieveUserQuota',
      url: 'https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota',
      body: { project: projectId },
    },
    {
      name: 'fetchAvailableModels',
      url: 'https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels',
      body: {},
    },
  ];

  const results = {};

  for (const ep of endpoints) {
    try {
      let res = await fetch(ep.url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'antigravity/1.0.0',
        },
        body: JSON.stringify(ep.body),
      });

      if (res.status === 401 && auth.refresh_token) {
        token = await refreshAccessToken(auth.refresh_token);
        res = await fetch(ep.url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'antigravity/1.0.0',
          },
          body: JSON.stringify(ep.body),
        });
      }

      const text = await res.text();
      try {
        results[ep.name] = JSON.parse(text);
      } catch {
        results[ep.name] = null;
      }
    } catch (err) {
      console.error(`Error pada ${ep.name}:`, err.message);
      results[ep.name] = null;
    }
  }

  // Parse according to Quota Radar core logic
  const toPct = (frac) => {
    if (frac > 0 && frac < 0.02) return 0;
    return Math.round(frac * 100);
  };

  let mingguan_pct = null;
  let mingguan_resets_at = null;
  let claude_pct = null;
  let claude_resets_at = null;
  let gemini_pct = null;
  let gemini_resets_at = null;

  // 1. Weekly summary
  const summary = results['retrieveUserQuotaSummary'];
  if (summary) {
    const bucketsList = [];
    if (Array.isArray(summary.buckets)) bucketsList.push(...summary.buckets);
    if (Array.isArray(summary.groups)) {
      for (const g of summary.groups) {
        if (Array.isArray(g.buckets)) bucketsList.push(...g.buckets);
      }
    }
    for (const b of bucketsList) {
      if (typeof b.remainingFraction === 'number' && Number.isFinite(b.remainingFraction)) {
        const pct = toPct(b.remainingFraction);
        if (mingguan_pct === null || pct < mingguan_pct) {
          mingguan_pct = pct;
          mingguan_resets_at = b.resetTime || null;
        }
      }
    }
  }

  // 2. Per-model quota
  const quota = results['retrieveUserQuota'];
  if (quota && Array.isArray(quota.buckets)) {
    for (const b of quota.buckets) {
      if (typeof b.remainingFraction !== 'number' || !Number.isFinite(b.remainingFraction)) continue;
      const modelId = String(b.modelId || '').toLowerCase();
      const pct = toPct(b.remainingFraction);

      if (modelId.includes('claude') || modelId.includes('opus') || modelId.includes('sonnet') || modelId.includes('gpt')) {
        if (claude_pct === null || pct < claude_pct) {
          claude_pct = pct;
          claude_resets_at = b.resetTime || null;
        }
      } else if (modelId.includes('gemini') || modelId.includes('flash') || modelId.includes('pro')) {
        if (gemini_pct === null || pct < gemini_pct) {
          gemini_pct = pct;
          gemini_resets_at = b.resetTime || null;
        }
      }
    }
  }

  console.log('\n=================== HASIL NORMALISASI KUOTA ===================');
  console.log('Akun:', targetEmail);
  console.log('Claude Opus :', claude_pct !== null ? `${claude_pct}% (reset: ${claude_resets_at})` : 'Tidak diketahui');
  console.log('Gemini Pro  :', gemini_pct !== null ? `${gemini_pct}% (reset: ${gemini_resets_at})` : 'Tidak diketahui');
  console.log('Mingguan    :', mingguan_pct !== null ? `${mingguan_pct}% (reset: ${mingguan_resets_at})` : 'Tidak diketahui');

  const finiteVals = [claude_pct, gemini_pct, mingguan_pct].filter(v => typeof v === 'number' && Number.isFinite(v));
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
