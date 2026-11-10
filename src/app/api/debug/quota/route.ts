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
        },
        normalized_values: {
          gemini: {
            pct: live.gemini_pct,
            resets_at: live.gemini_resets_at,
            source_path: live.gemini_source_path ?? null,
            status: live.gemini_pct !== null ? 'diketahui' : 'tidak_diketahui',
            reason: live.gemini_reason ?? null,
          },
          claude: {
            pct: live.claude_pct,
            resets_at: live.claude_resets_at,
            source_path: live.claude_source_path ?? null,
            status: live.claude_pct !== null ? 'diketahui' : 'tidak_diketahui',
            reason: live.claude_reason ?? null,
          },
        },
        manual_gemini: {
          pct: acc.gemini_manual_pct ?? null,
          resets_at: acc.gemini_manual_resets_at ?? null,
          updated_at: acc.gemini_manual_updated_at ?? null,
          is_expired: acc.gemini_is_expired ?? false,
          effective_source: acc.gemini_source ?? 'tidak_tersedia',
        },
        final: {
          gemini_effective_pct: acc.gemini_pct,
          claude_pct: acc.claude_pct,
          lowest_pct: acc.lowest_tracked_pct,
          status: acc.status,
          statusLabel: acc.status_reason ?? acc.status,
          reason: live.error ?? (acc.gemini_pct === null ? 'Gemini mingguan tidak tersedia dari server (status akun dihitung dari Claude)' : null),
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

