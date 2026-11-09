/**
 * src/lib/providers/ccs.ts
 * CcsProvider: Adapter untuk CCS (ccs agy).
 * Mengambil kuota asli langsung dari auth files CCS (~/.ccs/cliproxy/auth/)
 * dan Google Cloud Code internal API, dengan fallback ke `ccs agy --accounts`.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { ProviderQuotaResult, QuotaSemantics, AccountTier } from '../types';
import { QuotaProvider, normalizeModelName, normalizePercent } from './types';
import { listCcsAuthFiles, fetchLiveQuota } from '../ccs-quota';

export class CcsProvider implements QuotaProvider {
  readonly id = 'ccs';
  readonly name = 'CCS (ccs agy)';
  readonly isMock = false;

  private getCcsHome(): string {
    return process.env.CCS_HOME || path.join(os.homedir(), '.ccs');
  }

  async isAvailable(): Promise<boolean> {
    const ccsDir = this.getCcsHome();
    const accountsFile = path.join(ccsDir, 'cliproxy', 'accounts.json');
    const binDir = path.join(ccsDir, 'cliproxy', 'bin');
    const authDir = path.join(ccsDir, 'cliproxy', 'auth');
    return fs.existsSync(accountsFile) || fs.existsSync(binDir) || fs.existsSync(authDir) || fs.existsSync(ccsDir);
  }

  async fetchAccounts(quotaSemantics: QuotaSemantics = 'remaining'): Promise<ProviderQuotaResult[]> {
    const results: ProviderQuotaResult[] = [];

    // 1. Prioritas Utama: Periksa semua file autentikasi aktif di ~/.ccs/cliproxy/auth/ dan akun database
    const authFiles = listCcsAuthFiles();
    const emailsToFetch = new Set<string>();
    for (const item of authFiles) {
      emailsToFetch.add(item.email.toLowerCase().trim());
    }

    try {
      const { getAccountsWithStatus } = await import('../supabase');
      const dbAccounts = await getAccountsWithStatus();
      for (const a of dbAccounts) {
        if (a.email) emailsToFetch.add(a.email.toLowerCase().trim());
      }
    } catch {}

    if (emailsToFetch.size > 0) {
      console.log(`[CcsProvider] Memeriksa kuota live untuk ${emailsToFetch.size} akun...`);
      for (const email of emailsToFetch) {
        try {
          const live = await fetchLiveQuota(email);
          results.push({
            email: live.email,
            nickname: live.email.split('@')[0],
            tier: live.tier,
            claude_pct: live.claude_pct,
            claude_resets_at: live.claude_resets_at,
            gemini_pct: live.gemini_pct,
            gemini_resets_at: live.gemini_resets_at,
            error: live.success ? undefined : live.error,
          });
        } catch (err: any) {
          console.warn(`[CcsProvider] Gagal mengambil kuota live untuk ${email}:`, err.message);
        }
      }

      if (results.length > 0) {
        return results;
      }
    }

    // 2. Fallback: Jalankan `ccs agy --accounts`
    const ccsDir = this.getCcsHome();
    const accountsFile = path.join(ccsDir, 'cliproxy', 'accounts.json');

    let accountsList: any[] = [];
    if (fs.existsSync(accountsFile)) {
      try {
        const raw = fs.readFileSync(accountsFile, 'utf-8');
        const parsedJson = JSON.parse(raw);
        if (Array.isArray(parsedJson)) {
          accountsList = parsedJson;
        } else if (parsedJson && typeof parsedJson === 'object') {
          const agyAccounts = parsedJson.providers?.agy?.accounts || {};
          const entries = Object.entries(agyAccounts);
          if (entries.length > 0) {
            accountsList = entries.map(([id, val]: [string, any]) => ({
              email: val.email || id,
              nickname: val.nickname || id.split('@')[0],
              tier: val.tier || 'pro',
            }));
          }
        }
      } catch (err: any) {
        console.warn(`[CCS] Gagal membaca ${accountsFile}: ${err.message}`);
      }
    }

    const cliOutput = await this.runCcsAccounts();

    if (accountsList.length === 0 && cliOutput) {
      const parsedFromCli = this.extractAccountsFromCliText(cliOutput);
      if (parsedFromCli.length > 0) {
        accountsList = parsedFromCli;
      }
    }

    if (accountsList.length === 0) {
      return [];
    }

    for (const acc of accountsList) {
      const email = acc.email || acc.account || `${acc.nickname || 'account'}@gmail.com`;
      const nickname = acc.nickname || acc.name || email.split('@')[0];
      const tier: AccountTier = ['ultra', 'pro', 'free'].includes(acc.tier?.toLowerCase())
        ? (acc.tier.toLowerCase() as AccountTier)
        : 'pro';

      const parsed = this.parseCcsOutputForAccount(cliOutput, email, nickname, quotaSemantics);

      if (parsed) {
        results.push({
          email,
          nickname,
          tier,
          claude_pct: parsed.claude_pct,
          claude_resets_at: parsed.claude_resets_at,
          gemini_pct: parsed.gemini_pct,
          gemini_resets_at: parsed.gemini_resets_at,
          error: parsed.error,
        });
      } else {
        results.push({
          email,
          nickname,
          tier,
          claude_pct: 100,
          claude_resets_at: null,
          gemini_pct: 100,
          gemini_resets_at: null,
          error: 'Belum ada data kuota dari CCS (Hubungkan akun dengan Login Google)',
        });
      }
    }

    return results;
  }

  private extractAccountsFromCliText(output: string): Array<{ email: string; nickname: string; tier: string }> {
    const list: Array<{ email: string; nickname: string; tier: string }> = [];
    const lines = output.split('\n');
    for (const line of lines) {
      const match = line.match(/(?:\[([^\]]+)\])?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (match) {
        const nickname = match[1] || match[2].split('@')[0];
        const email = match[2];
        const tier = /ultra/i.test(line) ? 'ultra' : 'pro';
        list.push({ email, nickname, tier });
      }
    }
    return list;
  }

  private runCcsAccounts(): Promise<string> {
    return new Promise((resolve) => {
      const isWin = process.platform === 'win32';
      const cmd = isWin ? 'ccs.cmd' : 'ccs';
      const child = spawn(cmd, ['agy', '--accounts'], { shell: true });

      let out = '';
      child.stdout?.on('data', (d) => { out += d.toString(); });
      child.stderr?.on('data', (d) => { out += d.toString(); });

      child.on('error', () => resolve(''));
      child.on('close', () => resolve(out));
    });
  }

  private parseCcsOutputForAccount(
    output: string,
    email: string,
    nickname: string,
    semantics: QuotaSemantics
  ): {
    claude_pct: number;
    claude_resets_at: string | null;
    gemini_pct: number;
    gemini_resets_at: string | null;
    error?: string;
  } | null {
    if (!output) return null;

    if (output.includes('403') || output.includes('Forbidden')) {
      return {
        claude_pct: 0,
        claude_resets_at: null,
        gemini_pct: 0,
        gemini_resets_at: null,
        error: '403: Akun tidak punya akses kuota Antigravity',
      };
    }
    if (output.includes('Token expired') || output.includes('re-auth')) {
      return {
        claude_pct: 0,
        claude_resets_at: null,
        gemini_pct: 0,
        gemini_resets_at: null,
        error: 'Token kedaluwarsa (login ulang lewat Login Google)',
      };
    }

    const lines = output.split('\n');
    let inAccountBlock = false;
    let claudePct = 100;
    let geminiPct = 100;
    let claudeReset: string | null = null;
    let geminiReset: string | null = null;
    let found = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (line.includes(email) || (nickname && line.includes(nickname))) {
        inAccountBlock = true;
        found = true;
        continue;
      }

      if (inAccountBlock && line.startsWith('---')) {
        break;
      }

      if (inAccountBlock) {
        if (/claude|sonnet|opus/i.test(line)) {
          const pctMatch = line.match(/(\d+(?:\.\d+)?)%/);
          if (pctMatch) {
            claudePct = normalizePercent(parseFloat(pctMatch[1]), semantics);
          }
          const resetMatch = line.match(/reset(?:\s+in)?\s+([^\n\r]+)/i);
          if (resetMatch) claudeReset = resetMatch[1].trim();
        }

        if (/gemini|flash|pro/i.test(line)) {
          const pctMatch = line.match(/(\d+(?:\.\d+)?)%/);
          if (pctMatch) {
            geminiPct = normalizePercent(parseFloat(pctMatch[1]), semantics);
          }
          const resetMatch = line.match(/reset(?:\s+in)?\s+([^\n\r]+)/i);
          if (resetMatch) geminiReset = resetMatch[1].trim();
        }
      }
    }

    if (!found) return null;

    return {
      claude_pct: claudePct,
      claude_resets_at: claudeReset,
      gemini_pct: geminiPct,
      gemini_resets_at: geminiReset,
    };
  }
}
