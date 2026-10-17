import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';
import { getSupabasePublicEnv } from '@/lib/supabase-env';
import { ADMIN_COOKIE_NAME } from '@/lib/admin-cookie';
import { securityLog } from '@/lib/security-log';
import { clientIp } from '@/lib/rate-limit';
import {
  LOGIN_THROTTLE_MAX_FAILURES,
  LOGIN_THROTTLE_WINDOW_MS,
  clearLoginFailures,
  countRecentLoginFailures,
  recordLoginFailure,
} from '@/lib/admin-login-throttle';

// Version 1.0.3 - audit B6 hardening
// 2026-10-17 - F-44: persistent login throttle (5 failures per email+IP per
//              15 min → 429), failures recorded in admin_login_attempts;
//              a successful login clears the pair's counter.
//              F-46: structured security logs for login success/failure/
//              blocked/denied.
//              F-82: cookie renamed to __Host-thriv_admin_token (Secure,
//              Path=/, no Domain), maxAge aligned to the token's real
//              expires_in (no 7-day fallback).

const LoginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const ip = clientIp(req);
    // Throttle key normalises case so "Admin@x" and "admin@x" share a bucket.
    const emailKey = email.trim().toLowerCase();

    const { url: supabaseUrl, anonKey } = getSupabasePublicEnv();

    if (!supabaseUrl || !anonKey) {
      const missing: string[] = [];
      if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
      if (!anonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
      return NextResponse.json(
        {
          error: `Supabase credentials are not configured on the server. Missing: ${missing.join(', ')}`,
        },
        { status: 503 }
      );
    }

    // Admin verification needs the service client (fail closed, F-01/F-08).
    if (!isServiceConfigured()) {
      return NextResponse.json(
        { error: 'Server admin verification is not configured. Contact the site owner.' },
        { status: 503 }
      );
    }

    // 0. Login throttle (audit F-44): lock the (email, IP) pair after too
    //    many failures inside the window. Unavailable throttle store →
    //    proceed (logged), Supabase's own limits still apply.
    const recentFailures = await countRecentLoginFailures(emailKey, ip);
    if (recentFailures !== null && recentFailures >= LOGIN_THROTTLE_MAX_FAILURES) {
      securityLog('auth.login.blocked', { email: emailKey, ip });
      return NextResponse.json(
        {
          error:
            'Too many failed attempts. Please wait about 15 minutes and try again.',
          code: 'TOO_MANY_ATTEMPTS',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(LOGIN_THROTTLE_WINDOW_MS / 1000)),
          },
        }
      );
    }

    // 1. Authenticate with Supabase Auth using the anon client
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user || !authData.session) {
      await recordLoginFailure(emailKey, ip);
      securityLog('auth.login.failure', { email: emailKey, ip });
      // Supabase's own message is a fixed, non-sensitive string
      // ("Invalid login credentials" etc.); still capped for safety.
      const safeMessage = (authError?.message ?? 'Invalid email or password').slice(0, 120);
      return NextResponse.json({ error: safeMessage }, { status: 401 });
    }

    const userId = authData.user.id;

    // 2. Verify admin role in admins table using the server service client.
    const serviceClient = getServiceClient();
    const { data: adminRow, error: adminError } = await serviceClient
      .from('admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (adminError) {
      // F-41: never echo raw database errors to the client.
      console.error('[/api/admin/auth/login] admin lookup failed:', adminError.message);
      securityLog('auth.login.error', { email: emailKey, ip, op: 'admins-lookup' });
      return NextResponse.json(
        { error: 'Server error during authentication. Please try again.' },
        { status: 500 }
      );
    }

    if (!adminRow) {
      securityLog('auth.login.denied', { email: emailKey, ip, userId });
      return NextResponse.json(
        { error: 'This account is not authorized for admin access.' },
        { status: 403 }
      );
    }

    // 3. Success: reset the pair's failure counter + audit log.
    await clearLoginFailures(emailKey, ip);
    securityLog('auth.login.success', { email: emailKey, ip, userId });

    const response = NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
    });

    // F-82: __Host- prefix (browsers enforce Secure + Path=/ + no Domain);
    // maxAge is the token's real lifetime — no multi-day fallback.
    const expiresIn = authData.session.expires_in || 3600;
    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: authData.session.access_token,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: expiresIn,
    });

    return response;
  } catch {
    console.error('[/api/admin/auth/login] Unexpected error');
    return NextResponse.json(
      { error: 'Internal server error during authentication.' },
      { status: 500 }
    );
  }
}
