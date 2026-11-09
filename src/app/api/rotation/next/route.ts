import { NextResponse } from 'next/server';
import {
  getAccountsWithStatus,
  getRotationSettings,
  updateRotationSettings,
  addRotationEvent,
} from '@/lib/supabase';
import { selectBestAccount, executeWhitelistedAction } from '@/lib/rotation';

export async function POST() {
  try {
    const settings = await getRotationSettings();
    const accounts = await getAccountsWithStatus();

    const evaluation = selectBestAccount(accounts, {
      threshold_pct: settings.threshold_pct,
      tier_priority: settings.tier_priority,
    });

    if (evaluation.allExhausted || !evaluation.bestAccount) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Semua akun telah menyentuh batas ambang kuota.',
          fastest_reset: evaluation.fastestResetAccount
            ? {
                nickname: evaluation.fastestResetAccount.nickname,
                reset_time: evaluation.fastestResetTime,
              }
            : null,
        },
        { status: 429 }
      );
    }

    const currentActive = accounts.find((a) => a.id === settings.active_account_id);
    const target = evaluation.bestAccount;

    // Jika skenario proxy, jalankan switch command
    if (settings.rotation_target === 'proxy') {
      try {
        await executeWhitelistedAction('use', { nickname: target.nickname });
      } catch (err: any) {
        console.warn('[Rotasi Next] Gagal eksekusi CLI:', err.message);
      }
    }

    // Update active_account_id
    await updateRotationSettings({ active_account_id: target.id });

    // Catat rotasi event
    await addRotationEvent({
      from_account_id: currentActive ? currentActive.id : null,
      to_account_id: target.id,
      reason: 'manual',
    });

    return NextResponse.json({
      ok: true,
      message: `Berhasil beralih ke akun ${target.nickname}`,
      active_account: {
        id: target.id,
        nickname: target.nickname,
        email: target.email,
        tier: target.tier,
        lowest_tracked_pct: target.lowest_tracked_pct,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

