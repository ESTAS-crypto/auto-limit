/**
 * src/lib/rotation-eval.ts
 * Algoritma murni pemilihan akun terbaik (Aman diimpor di Client & Server).
 */

import { AccountWithStatus, RotationSettings, AccountTier } from './types';

export interface BestAccountResult {
  bestAccount: AccountWithStatus | null;
  allExhausted: boolean;
  fastestResetAccount: AccountWithStatus | null;
  fastestResetTime: string | null;
  reason?: string;
}

/**
 * Memilih akun terbaik:
 * 1. Tidak dijeda (paused = false)
 * 2. in_rotation = true
 * 3. Kuota terendah di atas threshold_pct
 * 4. Urutan: tier_priority -> kuota terendah tertinggi (terbanyak) -> reset paling cepat
 */
export function selectBestAccount(
  accounts: AccountWithStatus[],
  settings: Pick<RotationSettings, 'threshold_pct' | 'tier_priority'>
): BestAccountResult {
  const threshold = settings.threshold_pct ?? 5;
  const tierPriority: AccountTier[] = settings.tier_priority || ['ultra', 'pro', 'free'];

  // Filter akun yang memenuhi syarat rotasi
  const eligible = accounts.filter((a) => {
    if (a.paused || !a.in_rotation) return false;
    const lowest = a.lowest_tracked_pct ?? 0;
    return lowest > threshold && a.status !== 'limit' && a.status !== 'tidak_diketahui';
  });

  // Cari reset tercepat di antara akun yang habis jika semua habis
  const exhausted = accounts.filter(
    (a) => !a.paused && a.in_rotation && (a.lowest_tracked_pct ?? 0) <= threshold
  );
  let fastestResetAccount: AccountWithStatus | null = null;
  let fastestResetTime: string | null = null;
  let minResetTimestamp = Infinity;

  for (const acc of exhausted) {
    const resets = [acc.claude_resets_at, acc.gemini_resets_at].filter(Boolean) as string[];
    for (const r of resets) {
      const ts = new Date(r).getTime();
      if (!isNaN(ts) && ts < minResetTimestamp) {
        minResetTimestamp = ts;
        fastestResetAccount = acc;
        fastestResetTime = r;
      }
    }
  }

  if (eligible.length === 0) {
    return {
      bestAccount: null,
      allExhausted: true,
      fastestResetAccount,
      fastestResetTime,
      reason: 'Semua akun telah menyentuh atau berada di bawah ambang batas kuota.',
    };
  }

  // Pengurutan sesuai aturan
  eligible.sort((a, b) => {
    // 1. Tier priority
    const aTierIndex = tierPriority.indexOf(a.tier);
    const bTierIndex = tierPriority.indexOf(b.tier);
    const aPriority = aTierIndex === -1 ? 99 : aTierIndex;
    const bPriority = bTierIndex === -1 ? 99 : bTierIndex;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    // 2. Kuota terbanyak (descending)
    const aQuota = a.lowest_tracked_pct ?? 0;
    const bQuota = b.lowest_tracked_pct ?? 0;
    if (aQuota !== bQuota) {
      return bQuota - aQuota;
    }

    // 3. Reset paling cepat
    const aReset = Math.min(
      new Date(a.claude_resets_at || '9999').getTime(),
      new Date(a.gemini_resets_at || '9999').getTime()
    );
    const bReset = Math.min(
      new Date(b.claude_resets_at || '9999').getTime(),
      new Date(b.gemini_resets_at || '9999').getTime()
    );
    return aReset - bReset;
  });

  return {
    bestAccount: eligible[0],
    allExhausted: false,
    fastestResetAccount: null,
    fastestResetTime: null,
  };
}

