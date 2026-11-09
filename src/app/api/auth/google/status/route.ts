import { NextResponse } from 'next/server';
import { checkGoogleOAuthStatus } from '@/lib/google-auth-session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const status = await checkGoogleOAuthStatus();
    return NextResponse.json({ ok: true, ...status });
  } catch (err: any) {
    console.error('[GET /api/auth/google/status] Error:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal memeriksa status login Google' },
      { status: 500 }
    );
  }
}

