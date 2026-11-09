import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const requireModule = createRequire(import.meta.url);

export interface RealQuotaResult {
  email: string;
  tier: 'ultra' | 'pro' | 'free';
  claude_pct: number;
  claude_resets_at: string | null;
  gemini_pct: number;
  gemini_resets_at: string | null;
  success: boolean;
  error?: string;
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

export async function fetchLiveQuota(email: string): Promise<RealQuotaResult> {
  const ccsModulePath = path.join(
    process.env.APPDATA || '',
    'npm/node_modules/@kaitranntt/ccs/dist/cliproxy/quota/quota-fetcher/account-quota-fetcher.js'
  );

  // Status khusus limit mingguan yang terkonfirmasi dari Antigravity IDE
  const normalizedEmail = email.toLowerCase().trim();
  const knownWeeklyLimits: Record<string, { gemini_pct: number; gemini_resets_at: string; claude_pct: number; claude_resets_at?: string }> = {
    'etiksilawati21@gmail.com': {
      gemini_pct: 0,
      gemini_resets_at: '2026-11-15T11:29:44.000Z',
      claude_pct: 100,
      claude_resets_at: '2026-11-16T04:09:07.000Z',
    },
    'bangcuy74@gmail.com': {
      gemini_pct: 0,
      gemini_resets_at: '2026-11-15T11:04:10.000Z',
      claude_pct: 100,
      claude_resets_at: '2026-11-16T04:09:07.000Z',
    },
  };

  try {
    let fetchAccountQuota: any;
    if (fs.existsSync(ccsModulePath)) {
      const mod = requireModule(ccsModulePath);
      fetchAccountQuota = mod.fetchAccountQuota;
    }

    if (fetchAccountQuota) {
      const res = await fetchAccountQuota('agy', email, false);
      if (res && res.success && Array.isArray(res.models)) {
        let claude_pct = 100;
        let claude_resets_at: string | null = null;
        let gemini_pct = 100;
        let gemini_resets_at: string | null = null;

        for (const m of res.models) {
          const name = (m.name || m.displayName || '').toLowerCase();
          if (name.includes('claude') || name.includes('sonnet') || name.includes('opus')) {
            claude_pct = m.percentage;
            if (m.resetTime) claude_resets_at = m.resetTime;
          } else if (name.includes('gemini') || name.includes('pro') || name.includes('flash')) {
            gemini_pct = m.percentage;
            if (m.resetTime) gemini_resets_at = m.resetTime;
          }
        }

        // Cek jika akun ini memiliki limit mingguan aktif dari IDE yang belum lewat waktu resetnya
        const known = knownWeeklyLimits[normalizedEmail];
        if (known) {
          const resetTime = new Date(known.gemini_resets_at).getTime();
          if (resetTime > Date.now()) {
            gemini_pct = known.gemini_pct;
            gemini_resets_at = known.gemini_resets_at;
            claude_pct = known.claude_pct;
            if (known.claude_resets_at) claude_resets_at = known.claude_resets_at;
          }
        }

        const tierRaw = (res.tier || '').toLowerCase();
        const tier: 'ultra' | 'pro' | 'free' = ['ultra', 'pro', 'free'].includes(tierRaw)
          ? tierRaw
          : 'pro';

        return {
          email,
          tier,
          claude_pct,
          claude_resets_at,
          gemini_pct,
          gemini_resets_at,
          success: true,
        };
      }
    }
  } catch (err: any) {
    console.warn(`[CCS Live Quota] Gagal mengambil kuota live untuk ${email}:`, err.message);
  }

  // Fallback jika ada limit mingguan yang tercatat
  const known = knownWeeklyLimits[normalizedEmail];
  if (known) {
    return {
      email,
      tier: 'pro',
      claude_pct: known.claude_pct,
      claude_resets_at: known.claude_resets_at || null,
      gemini_pct: known.gemini_pct,
      gemini_resets_at: known.gemini_resets_at,
      success: true,
    };
  }

  return {
    email,
    tier: 'pro',
    claude_pct: 100,
    claude_resets_at: null,
    gemini_pct: 100,
    gemini_resets_at: null,
    success: false,
    error: 'Data kuota belum tersedia dari CCS',
  };
}
