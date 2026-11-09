import { NextResponse } from 'next/server';
import { getNotificationSettings } from '@/lib/supabase';
import { decrypt } from '@/lib/crypto';
import { sendDiscordWebhook } from '@/lib/discord';

export async function POST(req: Request) {
  try {
    let webhookUrl = '';
    const body = await req.json().catch(() => ({}));

    if (body.webhook_url && body.webhook_url.startsWith('https://discord.com/api/webhooks/')) {
      webhookUrl = body.webhook_url.trim();
    } else {
      const settings = await getNotificationSettings();
      if (!settings.webhook_enc) {
        return NextResponse.json(
          { ok: false, error: 'Belum ada Webhook Discord yang tersimpan. Masukkan URL Webhook terlebih dahulu.' },
          { status: 400 }
        );
      }
      webhookUrl = decrypt(settings.webhook_enc);
    }

    const res = await sendDiscordWebhook({
      webhookUrl,
      title: 'Tes Notifikasi Quota Radar',
      description: 'Koneksi ke Discord berhasil terhubung! Quota Radar siap mengirim pembaruan status kuota.',
      status: 'aktif',
      claudePct: 100,
      geminiPct: 100,
      recommendedAccount: 'akun-05 (Ultra)',
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.message }, { status: res.status });
    }

    return NextResponse.json({ ok: true, message: 'Tes notifikasi berhasil terkirim ke Discord!' });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

