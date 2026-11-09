import { NextResponse } from 'next/server';
import { togglePauseAccount, saveQuotaSnapshot, getServerSupabase } from '@/lib/supabase';
import { executeWhitelistedAction } from '@/lib/rotation';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    // 1. Jika memperbarui kuota secara manual (Kalibrasi / Sync Kuota)
    if (body.claude_pct !== undefined || body.gemini_pct !== undefined) {
      if (body.claude_pct !== undefined) {
        await saveQuotaSnapshot({
          account_id: id,
          model: 'claude',
          remaining_pct: Number(body.claude_pct),
          resets_at: body.claude_resets_at || null,
        });
      }
      if (body.gemini_pct !== undefined) {
        await saveQuotaSnapshot({
          account_id: id,
          model: 'gemini',
          remaining_pct: Number(body.gemini_pct),
          resets_at: body.gemini_resets_at || null,
        });
      }

      return NextResponse.json({
        ok: true,
        message: 'Kuota berhasil diperbarui',
      });
    }

    // 2. Default: Toggle pause akun
    const updated = await togglePauseAccount(id);
    if (!updated) {
      return NextResponse.json({ ok: false, error: 'Akun tidak ditemukan' }, { status: 404 });
    }

    // Jika skenario proxy CCS aktif, panggil pause/resume sesuai status baru
    try {
      if (updated.paused) {
        await executeWhitelistedAction('pause', { email: updated.email });
      } else {
        await executeWhitelistedAction('resume', { email: updated.email });
      }
    } catch {
      // Abaikan jika CCS belum terpasang
    }

    return NextResponse.json({ ok: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const sb = getServerSupabase();
    if (sb) {
      await sb.from('accounts').delete().eq('id', id);
    }
    return NextResponse.json({ ok: true, message: 'Akun berhasil dihapus' });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

