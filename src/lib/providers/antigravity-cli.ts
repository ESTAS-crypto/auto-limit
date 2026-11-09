/**
 * src/lib/providers/antigravity-cli.ts
 * AntigravityCliProvider: Adapter untuk krmslmz/antigravity-cli.
 * Menjalankan `node index.js status` dan mem-parsing teks keluaran.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ProviderQuotaResult, QuotaSemantics, AccountTier } from '../types';
import { QuotaProvider, normalizePercent } from './types';

export class AntigravityCliProvider implements QuotaProvider {
  readonly id = 'antigravity-cli';
  readonly name = 'antigravity-cli (krmslmz)';
  readonly isMock = false;

  private getCliDir(): string {
    return process.env.ANTIGRAVITY_CLI_DIR || path.join(process.cwd(), 'antigravity-cli');
  }

  async isAvailable(): Promise<boolean> {
    const dir = this.getCliDir();
    const indexJs = path.join(dir, 'index.js');
    return fs.existsSync(indexJs);
  }

  async fetchAccounts(quotaSemantics: QuotaSemantics = 'remaining'): Promise<ProviderQuotaResult[]> {
    const dir = this.getCliDir();
    if (!fs.existsSync(path.join(dir, 'index.js'))) {
      throw new Error(`Direktori antigravity-cli tidak ditemukan di ${dir}`);
    }

    const output = await this.runStatus(dir);
    return parseAntigravityCliOutput(output, quotaSemantics);
  }

  private runStatus(cliDir: string): Promise<string> {
    return new Promise((resolve) => {
      const child = spawn('node', ['index.js', 'status'], { cwd: cliDir, shell: true });
      let out = '';
      child.stdout?.on('data', (d) => { out += d.toString(); });
      child.stderr?.on('data', (d) => { out += d.toString(); });
      child.on('error', () => resolve(''));
      child.on('close', () => resolve(out));
    });
  }
}

/**
 * Parser teks toleran untuk keluaran `node index.js status`
 * Contoh keluaran antigravity-cli:
 * 
 * Account: user@example.com (Pro)
 *   Claude 3.5 Sonnet / Opus: 85% remaining, resets at 03:15
 *   Gemini 1.5 Pro: 100% remaining, resets at 02:45
 */
export function parseAntigravityCliOutput(
  rawText: string,
  semantics: QuotaSemantics = 'remaining'
): ProviderQuotaResult[] {
  if (!rawText || !rawText.trim()) return [];

  const results: ProviderQuotaResult[] = [];
  const accountBlocks = rawText.split(/(?:^|\n)(?=Account[:\s]|User[:\s]|\[Account\])/i);

  for (const block of accountBlocks) {
    if (!block.trim()) continue;

    // Ambil Email & Tier
    const emailMatch = block.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (!emailMatch) continue;

    const email = emailMatch[1];
    const nickname = email.split('@')[0];

    let tier: AccountTier = 'pro';
    if (/ultra/i.test(block)) tier = 'ultra';
    else if (/free/i.test(block)) tier = 'free';

    // Parse Claude
    let claudePct = 100;
    let claudeReset: string | null = null;
    const claudeLineMatch = block.match(/claude[^\n]*/i);
    if (claudeLineMatch) {
      const line = claudeLineMatch[0];
      const pctMatch = line.match(/(\d+)%/);
      if (pctMatch) {
        claudePct = normalizePercent(parseInt(pctMatch[1], 10), semantics);
      }
      const resetMatch = line.match(/(?:reset[s]?\s*(?:at|in)?\s*|jam\s*)([0-9]{1,2}:[0-9]{2})/i);
      if (resetMatch) {
        claudeReset = resetMatch[1];
      }
    }

    // Parse Gemini
    let geminiPct = 100;
    let geminiReset: string | null = null;
    const geminiLineMatch = block.match(/gemini[^\n]*/i);
    if (geminiLineMatch) {
      const line = geminiLineMatch[0];
      const pctMatch = line.match(/(\d+)%/);
      if (pctMatch) {
        geminiPct = normalizePercent(parseInt(pctMatch[1], 10), semantics);
      }
      const resetMatch = line.match(/(?:reset[s]?\s*(?:at|in)?\s*|jam\s*)([0-9]{1,2}:[0-9]{2})/i);
      if (resetMatch) {
        geminiReset = resetMatch[1];
      }
    }

    results.push({
      email,
      nickname,
      tier,
      claude_pct: claudePct,
      claude_resets_at: claudeReset,
      gemini_pct: geminiPct,
      gemini_resets_at: geminiReset,
    });
  }

  return results;
}

