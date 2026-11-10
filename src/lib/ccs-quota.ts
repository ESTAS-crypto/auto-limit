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

export interface ParsedDimensionResult {
  pct: number | null;
  resets_at: string | null;
  source_path: string | null;
  reason: string | null;
}

export interface ParsedQuotaResult {
  claude: ParsedDimensionResult;
  gemini: ParsedDimensionResult;
  claude_pct: number | null;
  claude_resets_at: string | null;
  claude_source_path: string | null;
  claude_reason: string | null;
  gemini_pct: number | null;
  gemini_resets_at: string | null;
  gemini_source_path: string | null;
  gemini_reason: string | null;
  mingguan_pct: number | null;
  mingguan_resets_at: string | null;
}

export function parseQuotaResponses(summaryJson: any, _legacyQuotaJson?: any): ParsedQuotaResult {
  // Catatan verifikasi IDE Antigravity:
  // Pada Antigravity IDE (fungsi Bmd di workbench.desktop.main.js), nilai persentase dihitung
  // langsung dengan Math.round(e * 100) tanpa ambang batas < 0.02.
  // Rule lama yang memotong < 0.02 telah dihapus karena itu berasal dari kuota pool Gemini CLI,
  // sedangkan IDE memakai nilai murni dari retrieveUserQuotaSummary.
  const toPct = (frac: number): number => {
    return Math.round(frac * 100);
  };

  let gemini_pct: number | null = null;
  let gemini_resets_at: string | null = null;
  let gemini_source_path: string | null = null;
  let gemini_reason: string | null = null;

  let claude_pct: number | null = null;
  let claude_resets_at: string | null = null;
  let claude_source_path: string | null = null;
  let claude_reason: string | null = null;

  if (summaryJson) {
    // 1. Ekstrak dari groups berdasarkan displayName
    if (Array.isArray(summaryJson.groups)) {
      summaryJson.groups.forEach((g: any, gIdx: number) => {
        const dName = String(g.displayName || g.display_name || '').toLowerCase();
        const isGemini = dName.includes('gemini');
        const isClaude = dName.includes('claude') || dName.includes('gpt');

        const buckets = Array.isArray(g.buckets) ? g.buckets : [];
        buckets.forEach((b: any, bIdx: number) => {
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

    // 2. Fallback jika root memiliki array buckets (skema alternatif)
    if (Array.isArray(summaryJson.buckets)) {
      summaryJson.buckets.forEach((b: any, bIdx: number) => {
        const frac = b.remainingFraction ?? b.remaining_fraction;
        if (typeof frac === 'number' && Number.isFinite(frac)) {
          const pct = toPct(frac);
          const resetTime = b.resetTime || b.reset_time || null;
          const pathStr = `buckets[${bIdx}].${b.remainingFraction !== undefined ? 'remainingFraction' : 'remaining_fraction'}`;
          const bName = String(b.displayName || b.bucketId || b.bucket_id || '').toLowerCase();

          if (bName.includes('gemini') && gemini_pct === null) {
            gemini_pct = pct;
            gemini_resets_at = resetTime;
            gemini_source_path = pathStr;
          } else if ((bName.includes('claude') || bName.includes('gpt') || bName.includes('3p')) && claude_pct === null) {
            claude_pct = pct;
            claude_resets_at = resetTime;
            claude_source_path = pathStr;
          }
        }
      });
    }
  }

  // Jika grup tidak ditemukan, larang nilai bawaan 100 atau 0
  if (gemini_pct === null) {
    gemini_reason = "Grup 'Gemini Models' tidak ditemukan di balasan retrieveUserQuotaSummary";
  }
  if (claude_pct === null) {
    claude_reason = "Grup 'Claude and GPT models' tidak ditemukan di balasan retrieveUserQuotaSummary";
  }

  // Limit mingguan gabungan = nilai terendah dari grup mingguan yang ditemukan
  const allVals: Array<number | null> = [gemini_pct, claude_pct];
  const finiteVals = allVals.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const mingguan_pct = finiteVals.length > 0 ? Math.min(...finiteVals) : null;
  const mingguan_resets_at = (gemini_pct !== null && gemini_pct <= (claude_pct ?? Infinity))
    ? gemini_resets_at
    : claude_resets_at;

  return {
    gemini: {
      pct: gemini_pct,
      resets_at: gemini_resets_at,
      source_path: gemini_source_path,
      reason: gemini_reason,
    },
    claude: {
      pct: claude_pct,
      resets_at: claude_resets_at,
      source_path: claude_source_path,
      reason: claude_reason,
    },
    claude_pct,
    claude_resets_at,
    claude_source_path,
    claude_reason,
    gemini_pct,
    gemini_resets_at,
    gemini_source_path,
    gemini_reason,
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
        'User-Agent': 'antigravity/1.107.0',
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
          'User-Agent': 'antigravity/1.107.0',
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

  try {
    // Sumber tunggal kebenaran: retrieveUserQuotaSummary (sesuai halaman Models & Usage IDE Antigravity)
    const summaryRes = await postEndpoint(
      'https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary',
      { project: projectId }
    );
    raw_summary = summaryRes.json || summaryRes.text;

    // Parse dan normalisasi kuota per grup (Gemini & Claude/GPT)
    const parsed = parseQuotaResponses(summaryRes.json);
    const {
      claude_pct,
      claude_resets_at,
      claude_source_path,
      claude_reason,
      gemini_pct,
      gemini_resets_at,
      gemini_source_path,
      gemini_reason,
      mingguan_pct,
      mingguan_resets_at,
    } = parsed;

    // Jika ada setidaknya satu dimensi kuota yang terbaca
    const hasData = Number.isFinite(claude_pct) || Number.isFinite(gemini_pct) || Number.isFinite(mingguan_pct);

    if (!hasData) {
      return {
        email,
        tier: 'free',
        claude_pct: null,
        claude_resets_at: null,
        claude_source_path: null,
        claude_reason,
        gemini_pct: null,
        gemini_resets_at: null,
        gemini_source_path: null,
        gemini_reason,
        mingguan_pct: null,
        mingguan_resets_at: null,
        raw_summary,
        success: false,
        error: `Data kuota tidak ada atau tak terbaca dari retrieveUserQuotaSummary: ${gemini_reason || ''}; ${claude_reason || ''}`.trim(),
      };
    }

    return {
      email,
      tier: 'free',
      claude_pct,
      claude_resets_at,
      claude_source_path,
      claude_reason,
      gemini_pct,
      gemini_resets_at,
      gemini_source_path,
      gemini_reason,
      mingguan_pct,
      mingguan_resets_at,
      raw_summary,
      success: true,
    };
  } catch (err: any) {
    return {
      email,
      tier: 'free',
      claude_pct: null,
      claude_resets_at: null,
      claude_source_path: null,
      gemini_pct: null,
      gemini_resets_at: null,
      gemini_source_path: null,
      mingguan_pct: null,
      mingguan_resets_at: null,
      raw_summary,
      success: false,
      error: `Gagal memanggil API kuota: ${err.message}`,
    };
  }
}
