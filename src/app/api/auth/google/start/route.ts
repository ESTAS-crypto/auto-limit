import { NextResponse } from 'next/server';
import { startGoogleOAuthSession } from '@/lib/google-auth-session';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const { authUrl } = await startGoogleOAuthSession();
    return NextResponse.json({ ok: true, authUrl });
  } catch (err: any) {
    console.error('[POST /api/auth/google/start] Error:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal memulai sesi login Google' },
      { status: 500 }
    );
  }
}

