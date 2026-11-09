import { NextResponse } from 'next/server';
import { getAccountsWithStatus, saveAccount, saveQuotaSnapshot } from '@/lib/supabase';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createAccountSchema = z.object({
  nickname: z.string().min(1, 'Nama panggilan wajib diisi'),
  email: z.string().email('Format email tidak valid'),
  tier: z.enum(['ultra', 'pro', 'free']),
  tracked_models: z.array(z.enum(['claude', 'gemini'])).min(1, 'Pilih minimal satu model'),
  in_rotation: z.boolean().default(true),
  claude_pct: z.number().min(0).max(100).optional(),
  gemini_pct: z.number().min(0).max(100).optional(),
});

export async function GET() {
  try {
    const accounts = await getAccountsWithStatus();
    return NextResponse.json({ ok: true, data: accounts });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = createAccountSchema.parse(body);

    const saved = await saveAccount({
      nickname: parsed.nickname,
      email: parsed.email,
      tier: parsed.tier,
      paused: false,
      tracked_models: parsed.tracked_models,
      in_rotation: parsed.in_rotation,
    });

    if (parsed.claude_pct !== undefined && parsed.tracked_models.includes('claude')) {
      await saveQuotaSnapshot({
        account_id: saved.id,
        model: 'claude',
        remaining_pct: parsed.claude_pct,
        resets_at: null,
      });
    }

    if (parsed.gemini_pct !== undefined && parsed.tracked_models.includes('gemini')) {
      await saveQuotaSnapshot({
        account_id: saved.id,
        model: 'gemini',
        remaining_pct: parsed.gemini_pct,
        resets_at: null,
      });
    }

    return NextResponse.json({ ok: true, data: saved });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: err.errors[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

