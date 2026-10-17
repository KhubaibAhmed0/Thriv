import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin-auth';

/**
 * proxy.ts — Next.js 16 successor of `middleware.ts` (audit F-43).
 *
 * Protects every `/admin/*` page. The actual check is shared with the
 * `/api/admin/*` route handlers via `verifyAdminRequest` (lib/admin-auth.ts),
 * which fails closed (audit F-01): when Supabase env config is missing or
 * invalid, no request is ever authorized.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLoginPage = pathname === '/admin/login';
  const token = req.cookies.get('thriv_admin_token')?.value;

  if (!token) {
    if (isLoginPage) return NextResponse.next();
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }

  const { authorized } = await verifyAdminRequest(req);

  if (!authorized) {
    // Drop a dead/forged cookie so the login page starts clean.
    const response = isLoginPage
      ? NextResponse.next()
      : NextResponse.redirect(new URL('/admin/login', req.url));
    response.cookies.delete('thriv_admin_token');
    return response;
  }

  if (isLoginPage) {
    // Already logged in → go to the dashboard.
    return NextResponse.redirect(new URL('/admin', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
