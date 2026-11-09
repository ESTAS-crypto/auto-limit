import { NextResponse } from 'next/server';
import { updateRotationSettings } from '@/lib/supabase';
import { z } from 'zod';

const calibrationSchema = z.object({
  user_stated_pct: z.number().min(0).max(100),
  provider_raw_pct: z.number().min(0).max(100),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { user_stated_pct, provider_raw_pct } = calibrationSchema.parse(body);

    // Hitung apakah nilai provider lebih mendekati 'remaining' atau 'used'
    // Jika user mengatakan 80% (sisa 80%), dan provider memberikan 80%, maka semantics = 'remaining'
    // Jika user mengatakan 80% (sisa 80%), dan provider memberikan 20% (terpakai), maka semantics = 'used'
    const diffRemaining = Math.abs(user_stated_pct - provider_raw_pct);
    const diffUsed = Math.abs(100 - user_stated_pct - provider_raw_pct);

    const chosenSemantics = diffRemaining <= diffUsed ? 'remaining' : 'used';

    const updated = await updateRotationSettings({
      quota_semantics: chosenSemantics,
    });

    return NextResponse.json({
      ok: true,
      quota_semantics: chosenSemantics,
      message: `Kalibrasi berhasil. Kuota ditafsirkan sebagai '${chosenSemantics === 'remaining' ? 'Sisa Kuota' : 'Kuotanya Terpakai'}'.`,
      settings: updated,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: err.errors[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

