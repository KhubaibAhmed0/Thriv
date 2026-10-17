import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin-auth';
import { isSupabasePublicConfigured } from '@/lib/supabase-env';

export async function GET(req: NextRequest) {
  try {
    const hasToken = Boolean(req.cookies.get('thriv_admin_token')?.value);
    if (!hasToken) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    if (!isSupabasePublicConfigured()) {
      return NextResponse.json(
        { authenticated: false, error: 'Server auth is not configured' },
        { status: 503 }
      );
    }

    // Shared fail-closed guard (audit F-01): verifies the token AND that the
    // user is registered in the admins table (audit F-08).
    const { authorized, user } = await verifyAdminRequest(req);

    if (!authorized || !user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // NOTE (audit F-42): the raw access token is deliberately NOT returned.
    // The HttpOnly cookie stays the only place the browser holds it; the
    // admin UI no longer needs a token for Supabase Realtime (it polls).
    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
