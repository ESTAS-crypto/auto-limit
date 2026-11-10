import { NextResponse } from 'next/server';
import { getAccountsWithStatus } from '@/lib/supabase';
import { fetchLiveQuota } from '@/lib/ccs-quota';
import { calculateAccountStatus } from '@/lib/status';

export const dynamic = 'force-dynamic';

function maskSensitive(obj: any): any {
  if (typeof obj === 'string') {
    return obj.replace(/ya29\.[a-zA-Z0-9_\-]+/g, '[TOKEN_MASKED]');
  }
  if (Array.isArray(obj)) {
    return obj.map(maskSensitive);
  }
  if (obj && typeof obj === 'object') {
    const copy: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (/token|secret|key|authorization/i.test(k) && typeof v === 'string') {
        copy[k] = '[MASKED]';
      } else {
        copy[k] = maskSensitive(v);
      }
    }
    return copy;
  }
  return obj;
}

export async function GET() {
  try {
    const accounts = await getAccountsWithStatus();
    const results = [];

    for (const acc of accounts) {
      const live = await fetchLiveQuota(acc.email);
      const statusCalc = calculateAccountStatus({
        paused: acc.paused,
        tracked_models: ['claude', 'gemini', 'mingguan'],
        claude_pct: live.claude_pct,
        gemini_pct: live.gemini_pct,
        mingguan_pct: live.mingguan_pct,
        has_error: !live.success,
      });

      results.push({
        id: acc.id,
        nickname: acc.nickname,
        email: acc.email,
        tier: acc.tier,
        is_active: acc.is_active,
        raw_outputs: {
          retrieveUserQuotaSummary: maskSensitive(live.raw_summary ?? null),
          retrieveUserQuota: maskSensitive(live.raw_quota ?? null),
        },
        normalized_values: {
          claude_pct: live.claude_pct,
          claude_resets_at: live.claude_resets_at,
          gemini_pct: live.gemini_pct,
          gemini_resets_at: live.gemini_resets_at,
          mingguan_pct: live.mingguan_pct,
          mingguan_resets_at: live.mingguan_resets_at,
        },
        final: {
          lowest_pct: statusCalc.lowest_pct,
          status: statusCalc.status,
          statusLabel: statusCalc.statusLabel,
          reason: live.error ?? null,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      count: results.length,
      accounts: results,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal mengambil debug kuota' },
      { status: 500 }
    );
  }
}

