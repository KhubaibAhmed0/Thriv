import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';
import { getSupabasePublicEnv } from '@/lib/supabase-env';
import { securityLog } from '@/lib/security-log';
import {
  clientIp,
  dbRateLimit,
  dbRateLimitFor,
  honeypotTripped,
  NO_STORE_HEADERS,
  originAllowed,
  peekRateLimit,
  requestId,
  verifyTurnstile,
} from '@/lib/api-guard';
import { log } from '@/lib/log';
import {
  ADMIN_MFA_TICKET_COOKIE,
  ADMIN_MFA_TICKET_TTL_MS,
  createAdminTicket,
} from '@/lib/admin-ticket';
import {
  challengeTotp,
  deleteUnverifiedFactorAsAdmin,
  enrollTotp,
  getTotpFactors,
} from '@/lib/admin-mfa';
import {
  LOGIN_THROTTLE_MAX_FAILURES,
  LOGIN_THROTTLE_WINDOW_MS,
  countRecentLoginFailures,
  recordLoginFailure,
} from '@/lib/admin-login-throttle';

// Version 2.0 — Phase 3 (2026-10-18 brief): MFA-mandatory admin login.
//
// Stage order: Origin → body (size-capped) → honeypot → distributed IP +
// account rate limits → zod → Turnstile (fail closed) → persistent email+IP
// failure throttle → password grant → admins check → MFA branch.
//
// This route NEVER sets the admin cookie. After a correct password it returns
// 401 with either `{mfa_required:true}` or
// `{mfa_setup:true, qr_data_uri, manual_key}` and issues a signed, httpOnly
// ticket cookie holding the aal1 token. The admin cookie is only ever set by
// /api/admin/auth/mfa/verify, and only with an aal2 token.

const MAX_BODY_BYTES = 10 * 1024;

const LoginSchema = z
  .object({
    email: z.string().trim().email('Enter a valid email address').max(254),
    password: z.string().min(6, 'Password must be at least 6 characters').max(200),
    turnstile_token: z.string().max(4096).nullish(),
    website: z.string().max(200).optional().default(''),
  })
  .strict();

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: NO_STORE_HEADERS });
}

export async function POST(req: NextRequest) {
  const rid = requestId();
  try {
    // 1. CSRF mitigation (browser Origin must match the request host).
    if (!originAllowed(req)) {
      securityLog('auth.login.origin_blocked', {});
      return fail(403, 'Request blocked.');
    }

    // 2. Body, size-capped (nothing here is anywhere near 10 KB).
    let raw: string;
    try {
      raw = await req.text();
    } catch {
      return fail(400, 'Invalid JSON payload');
    }
    if (raw.length > MAX_BODY_BYTES) return fail(400, 'Invalid JSON payload');

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return fail(400, 'Invalid JSON payload');
    }

    // 3. Honeypot — invisible `website` field, free to check.
    if (honeypotTripped(body)) {
      securityLog('auth.login.honeypot', { ip: clientIp(req) });
      return fail(400, 'Could not process this request. Please try again.');
    }

    const ip = clientIp(req);

    // 4. Distributed rate limits: per IP and per account (survives IP
    //    rotation; the account key is hashed before storage).
    const ipGate = await dbRateLimit(req, 'admin-login', 10, 900);
    if (!ipGate.ok) {
      securityLog('auth.login.blocked', { ip, scope: 'ip' });
      return NextResponse.json(
        { error: 'Too many attempts. Please wait a few minutes and try again.' },
        {
          status: 429,
          headers: { ...NO_STORE_HEADERS, 'Retry-After': String(ipGate.retryAfterSec) },
        }
      );
    }

    // 5. Shape validation.
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const { email, password, turnstile_token } = parsed.data;
    // Throttle key normalises case so "Admin@x" and "admin@x" share a bucket.
    const emailKey = email.trim().toLowerCase();

    // Account-wide gate (cross-IP brute force). READ-ONLY peek: only failed
    // credentials increment this bucket (see the authError branch), so a
    // successful login — or a probe with a junk Turnstile token — can never
    // move a legitimate admin towards a lockout.
    const acctPeek = await peekRateLimit('admin-login-acct', emailKey, 10, 900);
    if (acctPeek.blocked) {
      securityLog('auth.login.blocked', { ip, scope: 'account' });
      return NextResponse.json(
        { error: 'Too many attempts. Please wait a few minutes and try again.' },
        {
          status: 429,
          headers: { ...NO_STORE_HEADERS, 'Retry-After': String(acctPeek.retryAfterSec) },
        }
      );
    }

    const { url: supabaseUrl, anonKey } = getSupabasePublicEnv();

    if (!supabaseUrl || !anonKey) {
      const missing: string[] = [];
      if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
      if (!anonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
      return fail(
        503,
        `Supabase credentials are not configured on the server. Missing: ${missing.join(', ')}`
      );
    }

    // Admin verification needs the service client (fail closed, F-01/F-08).
    if (!isServiceConfigured()) {
      return fail(503, 'Server admin verification is not configured. Contact the site owner.');
    }

    // 6. Turnstile — fail closed (missing secret / CF unreachable = 503).
    const turnstile = await verifyTurnstile(turnstile_token, ip, req.headers.get('host'));
    if (!turnstile.ok) {
      securityLog('auth.login.turnstile_fail', { ip, infra: turnstile.infra });
      return turnstile.infra
        ? fail(503, 'Sign-in is temporarily unavailable. Please try again in a minute.')
        : fail(400, 'Could not process this request. Please try again.');
    }

    // 7. Persistent (email, IP) failure throttle — unchanged from B6.
    const recentFailures = await countRecentLoginFailures(emailKey, ip);
    if (recentFailures !== null && recentFailures >= LOGIN_THROTTLE_MAX_FAILURES) {
      securityLog('auth.login.blocked', { email: emailKey, ip });
      return NextResponse.json(
        {
          error: 'Too many failed attempts. Please wait about 15 minutes and try again.',
          code: 'TOO_MANY_ATTEMPTS',
        },
        {
          status: 429,
          headers: {
            ...NO_STORE_HEADERS,
            'Retry-After': String(Math.ceil(LOGIN_THROTTLE_WINDOW_MS / 1000)),
          },
        }
      );
    }

    // 8. Password grant (anon client, server-side — never the browser).
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
      // Cross-IP brute-force counter — consumed by failures ONLY (review
      // fix; a success must never be part of a lockout budget).
      const acctGate = await dbRateLimitFor('admin-login-acct', emailKey, 10, 900);
      if (!acctGate.ok) {
        securityLog('auth.login.blocked', { email: emailKey, ip, scope: 'account' });
        return NextResponse.json(
          {
            error: 'Too many failed attempts. Please wait about 15 minutes and try again.',
            code: 'TOO_MANY_ATTEMPTS',
          },
          {
            status: 429,
            headers: { ...NO_STORE_HEADERS, 'Retry-After': String(acctGate.retryAfterSec) },
          }
        );
      }
      const safeMessage = (authError?.message ?? 'Invalid email or password').slice(0, 120);
      return fail(401, safeMessage);
    }

    const userId = authData.user.id;
    const accessToken = authData.session.access_token;

    // 9. Admin membership (service client, fail closed).
    const serviceClient = getServiceClient();
    const { data: adminRow, error: adminError } = await serviceClient
      .from('admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (adminError) {
      log.error('[/api/admin/auth/login] admin lookup failed:', adminError.message);
      securityLog('auth.login.error', { email: emailKey, ip, op: 'admins-lookup' });
      return fail(500, 'Server error during authentication. Please try again.');
    }

    if (!adminRow) {
      securityLog('auth.login.denied', { email: emailKey, ip, userId });
      return fail(403, 'This account is not authorized for admin access.');
    }

    // 10. MFA branch — never set the cookie here (Phase 3 brief).
    const factors = await getTotpFactors(accessToken, authData.user.factors);
    if (!factors.ok) {
      log.error('[/api/admin/auth/login] factor lookup failed:', factors.reason);
      securityLog('auth.login.error', { email: emailKey, ip, op: 'factors' });
      return fail(500, 'Server error during authentication. Please try again.');
    }

    const verifiedFactorId =
      factors.factors.find((f) => f.status === 'verified')?.id ?? null;
    const unverifiedFactors = factors.factors.filter((f) => f.status !== 'verified');

    let purpose: 'setup' | 'verify';
    let factorId: string;
    let qrSvg: string | null = null;
    let manualKey: string | null = null;

    if (verifiedFactorId) {
      purpose = 'verify';
      factorId = verifiedFactorId;
    } else {
      // First login: enroll. Only UNVERIFIED leftovers may be removed; a
      // verified factor can never reach this branch (checked above), and we
      // re-check after cleanup so a racing enrollment can't be overrun.
      for (const f of unverifiedFactors) {
        await deleteUnverifiedFactorAsAdmin(userId, f.id);
      }

      const recheck = await getTotpFactors(accessToken);
      if (recheck.ok && recheck.factors.some((f) => f.status === 'verified')) {
        securityLog('auth.mfa.race_detected', { userId });
        return fail(409, 'Please try signing in again.');
      }

      const enrolled = await enrollTotp(accessToken);
      if (!enrolled.ok) {
        log.error('[/api/admin/auth/login] factor enroll failed:', enrolled.reason);
        securityLog('auth.login.error', { email: emailKey, ip, op: 'enroll' });
        return fail(500, 'Server error during authentication. Please try again.');
      }

      purpose = 'setup';
      factorId = enrolled.factor.id;
      qrSvg = enrolled.factor.qrSvg;
      manualKey = enrolled.factor.secret;
      securityLog('auth.mfa.setup_started', { email: emailKey, ip, userId });
    }

    const challenge = await challengeTotp(accessToken, factorId);
    if (!challenge.ok) {
      log.error('[/api/admin/auth/login] factor challenge failed:', challenge.reason);
      securityLog('auth.login.error', { email: emailKey, ip, op: 'challenge' });
      return fail(500, 'Server error during authentication. Please try again.');
    }

    const ticket = createAdminTicket({
      uid: userId,
      email: emailKey,
      atk: accessToken,
      fid: factorId,
      cid: challenge.id,
      pur: purpose,
    });

    if (!ticket) {
      log.error('[/api/admin/auth/login] ticket creation failed');
      return fail(500, 'Server error during authentication. Please try again.');
    }

    securityLog('auth.login.mfa_required', {
      email: emailKey,
      ip,
      userId,
      setup: purpose === 'setup',
    });

    const payload =
      purpose === 'setup'
        ? {
            mfa_setup: true,
            // SVG wrapped as a data: URI — rendered via <img>, never injected
            // as markup.
            qr_data_uri: `data:image/svg+xml;base64,${Buffer.from(qrSvg ?? '', 'utf8').toString('base64')}`,
            manual_key: manualKey,
          }
        : { mfa_required: true };

    const response = NextResponse.json(payload, { status: 401, headers: NO_STORE_HEADERS });
    response.cookies.set({
      name: ADMIN_MFA_TICKET_COOKIE,
      value: ticket,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(ADMIN_MFA_TICKET_TTL_MS / 1000),
    });

    return response;
  } catch (err) {
    log.error('[/api/admin/auth/login] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error during authentication.', request_id: rid },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
