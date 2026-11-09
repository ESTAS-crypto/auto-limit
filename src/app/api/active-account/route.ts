import { NextResponse } from 'next/server';
import { getAccountsWithStatus, getRotationSettings } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getRotationSettings();
    const accounts = await getAccountsWithStatus();

    const active = accounts.find((a) => a.id === settings.active_account_id) || accounts[0] || null;

    return NextResponse.json({
      ok: true,
      active_account: active
        ? {
            id: active.id,
            nickname: active.nickname,
            email: active.email,
            tier: active.tier,
            status: active.status,
            lowest_tracked_pct: active.lowest_tracked_pct,
            claude_pct: active.claude_pct,
            gemini_pct: active.gemini_pct,
          }
        : null,
      rotation_target: settings.rotation_target,
      mode: settings.mode,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

