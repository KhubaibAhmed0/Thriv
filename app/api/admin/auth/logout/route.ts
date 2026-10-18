import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';
import { ADMIN_COOKIE_NAME } from '@/lib/admin-cookie';
import { originAllowed } from '@/lib/api-guard';
import { securityLog } from '@/lib/security-log';
import { log } from '@/lib/log';

/**
 * POST /api/admin/auth/logout
 *
 * Audit F-47: clearing the cookie is no longer the whole story — the
 * Supabase session is revoked server-side (admin signOut, scope global)
 * so a copied token cannot ride out its full lifetime for a *new* session.
 * (A Supabase access JWT cannot be un-issued; it stays valid until its
 * exp — which is why the cookie maxAge now matches the real expires_in,
 * capping any residual window at ≤1 h.)
 * Audit F-82: same __Host- cookie name as the login route.
 */
export async function POST(req: NextRequest) {
  // Phase 4: state-changing route — reject cross-origin browser calls.
  if (!originAllowed(req)) {
    securityLog('auth.logout.origin_blocked', {});
    return NextResponse.json({ error: 'Request blocked.' }, { status: 403 });
  }

  let revoked = false;

  const token =
    req.cookies.get(ADMIN_COOKIE_NAME)?.value ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (token && isServiceConfigured()) {
    try {
      const { error } = await getServiceClient().auth.admin.signOut(token, 'global');
      if (error) {
        log.warn('[logout] session revoke failed:', error.message);
      } else {
        revoked = true;
      }
    } catch (err) {
      log.warn('[logout] session revoke error:', err instanceof Error ? err.message : err);
    }
  }

  securityLog('auth.logout', { revoked });

  const response = NextResponse.json({ success: true, revoked });
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
