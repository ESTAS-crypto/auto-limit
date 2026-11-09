/**
 * src/lib/providers/types.ts
 * Interface untuk adapter sumber data kuota Antigravity.
 */

import { ProviderQuotaResult, QuotaSemantics } from '../types';

export interface QuotaProvider {
  readonly id: string;
  readonly name: string;
  readonly isMock: boolean;
  isAvailable(): Promise<boolean>;
  fetchAccounts(quotaSemantics?: QuotaSemantics): Promise<ProviderQuotaResult[]>;
}

/**
 * Normalisasi nama model (karena nama model dapat berubah, mis. Claude Opus 4.6 atau Gemini 3 Pro)
 */
export function normalizeModelName(raw: string): 'claude' | 'gemini' | null {
  const lower = raw.toLowerCase().trim();
  if (lower.startsWith('claude') || lower.includes('claude')) return 'claude';
  if (lower.startsWith('gemini') || lower.includes('gemini')) return 'gemini';
  return null;
}

/**
 * Normalisasi arti persen (remaining vs used)
 */
export function normalizePercent(rawPct: number, semantics: QuotaSemantics = 'remaining'): number {
  const clamped = Math.max(0, Math.min(100, Math.round(rawPct)));
  if (semantics === 'used') {
    return 100 - clamped;
  }
  return clamped;
}

