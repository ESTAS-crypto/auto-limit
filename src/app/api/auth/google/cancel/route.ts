import { NextResponse } from 'next/server';
import { cancelGoogleOAuthSession } from '@/lib/google-auth-session';

export async function POST() {
  try {
    cancelGoogleOAuthSession();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

