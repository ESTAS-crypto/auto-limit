import { NextResponse } from 'next/server';
import { getActiveProvider } from '@/lib/providers';
import { getRotationSettings, getAccountsWithStatus, saveQuotaSnapshot, updateRotationSettings } from '@/lib/supabase';
import { selectBestAccount } from '@/lib/rotation';

export async function POST() {
  try {
    const settings = await getRotationSettings();
    const provider = await getActiveProvider();

    console.log(`[Manual Poll] Mengambil kuota dari provider: ${provider.name}`);
    const results = await provider.fetchAccounts(settings.quota_semantics);

    const accounts = await getAccountsWithStatus();

    // Simpan snapshot untuk tiap akun yang cocok
    for (const res of results) {
      const match = accounts.find((a) => a.email.toLowerCase() === res.email.toLowerCase());
      if (match) {
        if (typeof res.gemini_pct === 'number' && Number.isFinite(res.gemini_pct)) {
          await saveQuotaSnapshot({
            account_id: match.id,
            model: 'gemini',
            remaining_pct: res.gemini_pct,
            resets_at: res.gemini_resets_at || null,
          });
        }
        if (typeof res.claude_pct === 'number' && Number.isFinite(res.claude_pct)) {
          await saveQuotaSnapshot({
            account_id: match.id,
            model: 'claude',
            remaining_pct: res.claude_pct,
            resets_at: res.claude_resets_at || null,
          });
        }
      }
    }

    // Refresh status akun
    const refreshedAccounts = await getAccountsWithStatus();

    // Evaluasi rotasi jika mode otomatis
    if (settings.mode === 'auto') {
      const best = selectBestAccount(refreshedAccounts, {
        threshold_pct: settings.threshold_pct,
        tier_priority: settings.tier_priority,
      });
      if (best.bestAccount && best.bestAccount.id !== settings.active_account_id) {
        await updateRotationSettings({ active_account_id: best.bestAccount.id });
      }
    }

    return NextResponse.json({
      ok: true,
      provider: provider.name,
      isMock: provider.isMock,
      accounts: refreshedAccounts,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

