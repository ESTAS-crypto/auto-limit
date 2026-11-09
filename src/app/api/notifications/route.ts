import { NextResponse } from 'next/server';
import { getNotificationSettings, updateNotificationSettings } from '@/lib/supabase';
import { encrypt, decrypt } from '@/lib/crypto';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateNotificationSchema = z.object({
  webhook_url: z.string().optional(),
  rules: z.object({
    low_quota: z.boolean(),
    limit_hit: z.boolean(),
    recovered: z.boolean(),
    daily_summary: z.boolean(),
  }).optional(),
  low_quota_pct: z.number().min(5).max(50).optional(),
  cooldown_minutes: z.number().min(5).max(180).optional(),
});

export async function GET() {
  try {
    const settings = await getNotificationSettings();
    let maskedWebhook = '';
    if (settings.webhook_enc) {
      try {
        const plain = decrypt(settings.webhook_enc);
        if (plain.length > 30) {
          maskedWebhook = plain.slice(0, 33) + '••••••••' + plain.slice(-4);
        } else {
          maskedWebhook = '••••••••••••••••';
        }
      } catch {}
    }

    return NextResponse.json({
      ok: true,
      data: {
        is_connected: Boolean(settings.webhook_enc),
        masked_webhook: maskedWebhook,
        rules: settings.rules,
        low_quota_pct: settings.low_quota_pct,
        daily_summary_time: settings.daily_summary_time,
        cooldown_minutes: settings.cooldown_minutes,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = updateNotificationSchema.parse(body);

    const patch: any = {};
    if (parsed.webhook_url !== undefined) {
      if (parsed.webhook_url.trim() === '') {
        patch.webhook_enc = null;
      } else {
        if (!parsed.webhook_url.startsWith('https://discord.com/api/webhooks/')) {
          return NextResponse.json(
            { ok: false, error: 'URL Webhook Discord harus diawali dengan https://discord.com/api/webhooks/' },
            { status: 400 }
          );
        }
        patch.webhook_enc = encrypt(parsed.webhook_url.trim());
      }
    }

    if (parsed.rules) patch.rules = parsed.rules;
    if (parsed.low_quota_pct !== undefined) patch.low_quota_pct = parsed.low_quota_pct;
    if (parsed.cooldown_minutes !== undefined) patch.cooldown_minutes = parsed.cooldown_minutes;

    const updated = await updateNotificationSettings(patch);

    return NextResponse.json({
      ok: true,
      message: 'Pengaturan notifikasi berhasil disimpan.',
      data: {
        is_connected: Boolean(updated.webhook_enc),
        rules: updated.rules,
        low_quota_pct: updated.low_quota_pct,
        cooldown_minutes: updated.cooldown_minutes,
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: err.errors[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

