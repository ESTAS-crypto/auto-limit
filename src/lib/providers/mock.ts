/**
 * src/lib/providers/mock.ts
 * MockProvider: Penyedia data tiruan bawaan berlabel jelas "Data contoh".
 */

import { ProviderQuotaResult, QuotaSemantics } from '../types';
import { QuotaProvider, normalizePercent } from './types';

export class MockProvider implements QuotaProvider {
  readonly id = 'mock';
  readonly name = 'MockProvider (Data contoh)';
  readonly isMock = true;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async fetchAccounts(quotaSemantics: QuotaSemantics = 'remaining'): Promise<ProviderQuotaResult[]> {
    // Memberikan simulasi realistis sesuai dengan mockup
    const now = new Date();
    const addMinutes = (m: number) => new Date(now.getTime() + m * 60000).toISOString();

    const sampleData: ProviderQuotaResult[] = [
      {
        email: 'akun-05@gmail.com',
        nickname: 'akun-05',
        tier: 'ultra',
        claude_pct: normalizePercent(100, quotaSemantics),
        claude_resets_at: addMinutes(195), // 03:15
        gemini_pct: normalizePercent(100, quotaSemantics),
        gemini_resets_at: addMinutes(165), // 02:45
        mingguan_pct: normalizePercent(100, quotaSemantics),
        mingguan_resets_at: addMinutes(195),
        success: true,
      },
      {
        email: 'akun-01@gmail.com',
        nickname: 'akun-01',
        tier: 'pro',
        claude_pct: normalizePercent(82, quotaSemantics),
        claude_resets_at: addMinutes(80), // 01:20
        gemini_pct: normalizePercent(95, quotaSemantics),
        gemini_resets_at: addMinutes(180), // 03:00
        mingguan_pct: normalizePercent(90, quotaSemantics),
        mingguan_resets_at: addMinutes(180),
        success: true,
      },
      {
        email: 'akun-02@gmail.com',
        nickname: 'akun-02',
        tier: 'pro',
        claude_pct: normalizePercent(41, quotaSemantics),
        claude_resets_at: addMinutes(250), // 04:10
        gemini_pct: normalizePercent(70, quotaSemantics),
        gemini_resets_at: addMinutes(150), // 02:30
        mingguan_pct: normalizePercent(65, quotaSemantics),
        mingguan_resets_at: addMinutes(250),
        success: true,
      },
      {
        email: 'akun-03@gmail.com',
        nickname: 'akun-03',
        tier: 'pro',
        claude_pct: normalizePercent(12, quotaSemantics),
        claude_resets_at: addMinutes(65), // 01:05
        gemini_pct: normalizePercent(38, quotaSemantics),
        gemini_resets_at: addMinutes(50), // 00:50
        mingguan_pct: normalizePercent(20, quotaSemantics),
        mingguan_resets_at: addMinutes(65),
        success: true,
      },
      {
        email: 'akun-04@gmail.com',
        nickname: 'akun-04',
        tier: 'pro',
        claude_pct: normalizePercent(0, quotaSemantics),
        claude_resets_at: addMinutes(134), // 02:14
        gemini_pct: normalizePercent(55, quotaSemantics),
        gemini_resets_at: addMinutes(134), // 02:14
        mingguan_pct: normalizePercent(0, quotaSemantics),
        mingguan_resets_at: addMinutes(134),
        success: true,
      },
      {
        email: 'akun-06@gmail.com',
        nickname: 'akun-06',
        tier: 'free',
        claude_pct: normalizePercent(0, quotaSemantics),
        claude_resets_at: addMinutes(300), // 05:00
        gemini_pct: normalizePercent(0, quotaSemantics),
        gemini_resets_at: addMinutes(300), // 05:00
        mingguan_pct: normalizePercent(0, quotaSemantics),
        mingguan_resets_at: addMinutes(300),
        success: true,
      },
    ];

    return sampleData;
  }
}

