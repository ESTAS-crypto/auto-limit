import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { ProviderQuotaResult } from './types';

const requireModule = createRequire(import.meta.url);

const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
const GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';

export interface RealQuotaResult extends ProviderQuotaResult {
  // Alias for backward compatibility
}

export function getCcsAuthDir(): string {
  return path.join(os.homedir(), '.ccs', 'cliproxy', 'auth');
}

export function listCcsAuthFiles(): Array<{ email: string; filePath: string; mtimeMs: number }> {
  const authDir = getCcsAuthDir();
  if (!fs.existsSync(authDir)) return [];

  const results: Array<{ email: string; filePath: string; mtimeMs: number }> = [];
  const files = fs.readdirSync(authDir);

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    if (!file.startsWith('agy-') && !file.startsWith('antigravity-')) continue;

    const fp = path.join(authDir, file);
    try {
      const stats = fs.statSync(fp);
      const content = fs.readFileSync(fp, 'utf-8');
      const data = JSON.parse(content);
      const email = data.email || file.replace(/^(agy-|antigravity-)/, '').replace(/\.json$/, '').replace('_', '@');
      if (email && email.includes('@')) {
        results.push({ email, filePath: fp, mtimeMs: stats.mtimeMs });
      }
    } catch {
      // Abaikan file rusak
    }
  }

  return results;
}

export function getCcsAuthForEmail(email: string): { filePath: string; data: any } | null {
  const authDir = getCcsAuthDir();
  if (!fs.existsSync(authDir)) return null;

  const normalized = email.toLowerCase().trim();
  const files = fs.readdirSync(authDir);

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    if (!file.startsWith('agy-') && !file.startsWith('antigravity-')) continue;

    const fp = path.join(authDir, file);
    try {
      const content = fs.readFileSync(fp, 'utf-8');
      const data = JSON.parse(content);
      const fileEmail = (data.email || file.replace(/^(agy-|antigravity-)/, '').replace(/\.json$/, '').replace('_', '@')).toLowerCase().trim();
      if (fileEmail === normalized) {
        return { filePath: fp, data };
      }
    } catch {
      continue;
    }
  }

  return null;
}

export async function refreshGoogleAccessToken(refreshToken: string, filePath?: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gagal me-refresh token Google (HTTP ${res.status}): ${errText}`);
  }

  const data = await res.json();
  const newAccessToken = data.access_token;

  // Simpan token baru ke file auth CCS bila filePath tersedia
  if (filePath && fs.existsSync(filePath)) {
    try {
      const curContent = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      curContent.access_token = newAccessToken;
      curContent.expired = false;
      curContent.timestamp = Date.now();
      fs.writeFileSync(filePath, JSON.stringify(curContent, null, 2), 'utf-8');
    } catch {
      // Non-fatal jika gagal menulis
    }
  }

  return newAccessToken;
}

export interface ParsedQuotaResult {
  claude_pct: number | null;
  claude_resets_at: string | null;
  gemini_pct: number | null;
  gemini_resets_at: string | null;
  mingguan_pct: number | null;
  mingguan_resets_at: string | null;
}

export function parseQuotaResponses(summaryJson: any, quotaJson: any): ParsedQuotaResult {
  let mingguan_pct: number | null = null;
  let mingguan_resets_at: string | null = null;
  let claude_pct: number | null = null;
  let claude_resets_at: string | null = null;
  let gemini_pct: number | null = null;
  let gemini_resets_at: string | null = null;

  const toPct = (frac: number): number => {
    // Di IDE Antigravity, fraksi < 0.02 (seperti 0.0138672) dianggap habis / 0%
    if (frac > 0 && frac < 0.02) return 0;
    return Math.round(frac * 100);
  };

  // 1. Ambil limit mingguan dari retrieveUserQuotaSummary
  if (summaryJson) {
    const bucketsList: any[] = [];
    if (Array.isArray(summaryJson.buckets)) {
      bucketsList.push(...summaryJson.buckets);
    }
    if (Array.isArray(summaryJson.groups)) {
      for (const g of summaryJson.groups) {
        if (Array.isArray(g.buckets)) {
          bucketsList.push(...g.buckets);
        }
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

  // 2. Ambil per-model dari retrieveUserQuota
  if (quotaJson && Array.isArray(quotaJson.buckets)) {
    for (const b of quotaJson.buckets) {
      if (typeof b.remainingFraction !== 'number' || !Number.isFinite(b.remainingFraction)) {
        continue;
      }

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

  // 3. Fallback jika salah satu grup tidak ada di retrieveUserQuota, coba cari di groups retrieveUserQuotaSummary
  if (summaryJson?.groups && Array.isArray(summaryJson.groups)) {
    for (const g of summaryJson.groups) {
      const dName = String(g.displayName || '').toLowerCase();
      const isClaudeGroup = dName.includes('claude') || dName.includes('gpt');
      const isGeminiGroup = dName.includes('gemini');

      if ((isClaudeGroup && claude_pct === null) || (isGeminiGroup && gemini_pct === null)) {
        for (const b of (g.buckets || [])) {
          if (typeof b.remainingFraction === 'number' && Number.isFinite(b.remainingFraction)) {
            const pct = toPct(b.remainingFraction);
            if (isClaudeGroup && (claude_pct === null || pct < claude_pct)) {
              claude_pct = pct;
              claude_resets_at = b.resetTime || null;
            }
            if (isGeminiGroup && (gemini_pct === null || pct < gemini_pct)) {
              gemini_pct = pct;
              gemini_resets_at = b.resetTime || null;
            }
          }
        }
      }
    }
  }

  return {
    claude_pct,
    claude_resets_at,
    gemini_pct,
    gemini_resets_at,
    mingguan_pct,
    mingguan_resets_at,
  };
}

export async function fetchLiveQuota(email: string): Promise<RealQuotaResult> {
  const authRecord = getCcsAuthForEmail(email);
  if (!authRecord || !authRecord.data) {
    return {
      email,
      tier: 'free',
      claude_pct: null,
      claude_resets_at: null,
      gemini_pct: null,
      gemini_resets_at: null,
      mingguan_pct: null,
      mingguan_resets_at: null,
      success: false,
      error: `File auth CCS untuk ${email} tidak ditemukan. Hubungkan akun melalui halaman Tambah Akun.`,
    };
  }

  const { filePath, data: authData } = authRecord;
  let token = authData.access_token;
  const refreshToken = authData.refresh_token;
  const projectId = authData.project_id || 'aicode-consumers';

  // Cek apakah token kedaluwarsa menurut file
  if (!token || authData.expired) {
    if (refreshToken) {
      try {
        token = await refreshGoogleAccessToken(refreshToken, filePath);
      } catch (err: any) {
        return {
          email,
          tier: 'free',
          claude_pct: null,
          claude_resets_at: null,
          gemini_pct: null,
          gemini_resets_at: null,
          mingguan_pct: null,
          mingguan_resets_at: null,
          success: false,
          error: `Gagal memperbarui token autentikasi: ${err.message}`,
        };
      }
    } else {
      return {
        email,
        tier: 'free',
        claude_pct: null,
        claude_resets_at: null,
        gemini_pct: null,
        gemini_resets_at: null,
        mingguan_pct: null,
        mingguan_resets_at: null,
        success: false,
        error: 'Token kedaluwarsa dan tidak ada refresh_token yang tersimpan.',
      };
    }
  }

  const postEndpoint = async (url: string, bodyObj: any) => {
    let res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'antigravity/1.0.0',
      },
      body: JSON.stringify(bodyObj),
    });

    if (res.status === 401 && refreshToken) {
      token = await refreshGoogleAccessToken(refreshToken, filePath);
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'antigravity/1.0.0',
        },
        body: JSON.stringify(bodyObj),
      });
    }

    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {}

    return { status: res.status, ok: res.ok, text, json };
  };

  let raw_summary: any = null;
  let raw_quota: any = null;

  try {
    // 1. Ambil retrieveUserQuotaSummary untuk limit mingguan
    const summaryRes = await postEndpoint(
      'https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary',
      { project: projectId }
    );
    raw_summary = summaryRes.json || summaryRes.text;

    // 2. Ambil retrieveUserQuota untuk per-model buckets
    const quotaRes = await postEndpoint(
      'https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota',
      { project: projectId }
    );
    raw_quota = quotaRes.json || quotaRes.text;

    // 3. Parse dan normalisasi kuota
    const parsed = parseQuotaResponses(summaryRes.json, quotaRes.json);
    const {
      claude_pct,
      claude_resets_at,
      gemini_pct,
      gemini_resets_at,
      mingguan_pct,
      mingguan_resets_at,
    } = parsed;

    // 4. Jika ada setidaknya satu dimensi kuota yang terbaca
    const hasData = Number.isFinite(claude_pct) || Number.isFinite(gemini_pct) || Number.isFinite(mingguan_pct);

    if (!hasData) {
      return {
        email,
        tier: 'free',
        claude_pct: null,
        claude_resets_at: null,
        gemini_pct: null,
        gemini_resets_at: null,
        mingguan_pct: null,
        mingguan_resets_at: null,
        raw_summary,
        raw_quota,
        success: false,
        error: 'Data kuota tidak ada atau tak terbaca dari server Google (retrieveUserQuotaSummary & retrieveUserQuota kosong/gagal).',
      };
    }

    return {
      email,
      tier: 'free',
      claude_pct,
      claude_resets_at,
      gemini_pct,
      gemini_resets_at,
      mingguan_pct,
      mingguan_resets_at,
      raw_summary,
      raw_quota,
      success: true,
    };
  } catch (err: any) {
    return {
      email,
      tier: 'free',
      claude_pct: null,
      claude_resets_at: null,
      gemini_pct: null,
      gemini_resets_at: null,
      mingguan_pct: null,
      mingguan_resets_at: null,
      raw_summary,
      raw_quota,
      success: false,
      error: `Gagal memanggil API kuota: ${err.message}`,
    };
  }
}
