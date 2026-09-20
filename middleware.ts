import { NextRequest, NextResponse } from 'next/server';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect /admin and /admin/*
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  const token = req.cookies.get('thriv_admin_token')?.value;
  const isLoginPage = pathname === '/admin/login';

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY;

  // If Supabase is not configured yet (local stub mode)
  if (!supabaseUrl || !anonKey || !supabaseUrl.startsWith('https://')) {
    // In unconfigured mode, allow access but don't loop
    return NextResponse.next();
  }

  // If no token exists
  if (!token) {
    if (isLoginPage) {
      return NextResponse.next();
    }
    const loginUrl = new URL('/admin/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  // Verify token server-side with Supabase Auth
  try {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
    });

    if (!userRes.ok) {
      // Invalid or expired token
      if (isLoginPage) {
        return NextResponse.next();
      }
      const response = NextResponse.redirect(new URL('/admin/login', req.url));
      response.cookies.delete('thriv_admin_token');
      return response;
    }

    const userData = await userRes.json();
    const userId = userData.id;

    // Verify user is present in the admins table using their own token (governed by RLS)
    const adminRes = await fetch(
      `${supabaseUrl}/rest/v1/admins?user_id=eq.${userId}&select=user_id`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
        },
      }
    );

    const adminRows = adminRes.ok ? await adminRes.json() : [];
    const isAdmin = Array.isArray(adminRows) && adminRows.length > 0;

    if (!isAdmin) {
      if (isLoginPage) {
        return NextResponse.next();
      }
      const response = NextResponse.redirect(new URL('/admin/login', req.url));
      response.cookies.delete('thriv_admin_token');
      return response;
    }

    // User is authenticated and is an admin
    if (isLoginPage) {
      // Already logged in, redirect to /admin
      return NextResponse.redirect(new URL('/admin', req.url));
    }

    return NextResponse.next();
  } catch (error) {
    // Network or server error verifying auth
    console.error('[middleware] Error verifying admin auth:', error);
    if (isLoginPage) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }
}

export const config = {
  matcher: ['/admin/:path*'],
};
