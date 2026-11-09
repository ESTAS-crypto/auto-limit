import { NextResponse } from 'next/server';
import {
  getRotationSettings,
  updateRotationSettings,
  getRotationEvents,
  getAccountsWithStatus,
  addRotationEvent,
} from '@/lib/supabase';
import { executeWhitelistedAction, updateCcsConfig } from '@/lib/rotation';
import { getActiveIdeAccount, switchIdeAccount } from '@/lib/ide-switch';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateSettingsSchema = z.object({
  mode: z.enum(['auto', 'manual', 'hybrid']).optional(),
  threshold_pct: z.number().min(0).max(50).optional(),
  tier_priority: z.array(z.enum(['ultra', 'pro', 'free'])).optional(),
  rotation_target: z.enum(['proxy', 'ide']).optional(),
  quota_semantics: z.enum(['remaining', 'used']).optional(),
  active_account_id: z.string().optional(),
});

export async function GET() {
  try {
    const settings = await getRotationSettings();
    const ideActive = getActiveIdeAccount();
    if (ideActive?.email) {
      const accounts = await getAccountsWithStatus();
      const match = accounts.find((a) => a.email.toLowerCase() === ideActive.email.toLowerCase());
      if (match && match.id !== settings.active_account_id) {
        await updateRotationSettings({ active_account_id: match.id });
        settings.active_account_id = match.id;
      }
    }
    const events = await getRotationEvents();
    return NextResponse.json({ ok: true, data: { settings, events, ideActive } });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Jika aksi adalah pergantian akun manual (switch to specific account)
    if (body.action === 'switch' && body.account_id) {
      const accounts = await getAccountsWithStatus();
      const target = accounts.find((a) => a.id === body.account_id);
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Akun target tidak ditemukan' }, { status: 404 });
      }

      const settings = await getRotationSettings();
      const currentActive = accounts.find((a) => a.id === settings.active_account_id);

      // Jalankan aksi switch CCS dan sinkronisasi ke Antigravity IDE
      let proxyNotice = '';
      try {
        const ideRes = switchIdeAccount(target.email);
        const res = await executeWhitelistedAction('use', { nickname: target.nickname, email: target.email });
        if (!res.ok) {
          proxyNotice = ` (Catatan CCS: ${res.message})`;
        }
      } catch (e: any) {
        console.warn('[Rotasi] Gagal eksekusi switch:', e.message);
      }

      // Update active_account_id
      await updateRotationSettings({ active_account_id: target.id });

      // Catat rotasi event
      await addRotationEvent({
        from_account_id: currentActive ? currentActive.id : null,
        to_account_id: target.id,
        reason: 'manual',
      });

      const message = `Akun aktif dialihkan ke ${target.email}! CCS Proxy & Antigravity IDE telah disinkronkan.${proxyNotice}`;

      return NextResponse.json({
        ok: true,
        message,
        active_account: target,
      });
    }

    // 2. Pembaruan pengaturan rotasi
    const parsed = updateSettingsSchema.parse(body);
    const updated = await updateRotationSettings(parsed);

    // Jika skenario proxy, coba sinkronisasi ke config.yaml CCS
    if (updated.rotation_target === 'proxy') {
      try {
        await updateCcsConfig({
          mode: updated.mode,
          threshold_pct: updated.threshold_pct,
          tier_priority: updated.tier_priority,
        });
      } catch {}
    }

    return NextResponse.json({ ok: true, data: updated });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: err.errors[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

