import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_COOKIE_NAME } from '@/lib/admin-cookie';
import {
  ADMIN_MFA_TICKET_COOKIE,
  readAdminTicket,
} from '@/lib/admin-ticket';
import {
  clientIp,
  dbRateLimit,
  dbRateLimitFor,
  NO_STORE_HEADERS,
  originAllowed,
  peekRateLimit,
  requestId,
} from '@/lib/api-guard';
import { verifyTotp } from '@/lib/admin-mfa';
import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';
import { clearLoginFailures } from '@/lib/admin-login-throttle';
import { securityLog } from '@/lib/security-log';
import { log } from '@/lib/log';

// Phase 3 (2026-10-18 brief): POST /api/admin/auth/mfa/verify
//
// Completes admin sign-in. Reads the signed ticket cookie (issued by the
// login route), verifies the TOTP code through GoTrue, asserts the returned
// session is aal2, and only then sets the admin cookie.
//
// Attempts are bounded by: per-IP DB limit (10/600 s) + per-account DB limit
// (5/600 s, uid-scoped, survives IP rotation) + the 5-minute ticket lifetime.

const MAX_BODY_BYTES = 2 * 1024;

const VerifySchema = z
  .object({
    code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  })
  .strict();

function fail(
  status: number,
  error: string,
  code?: string,
  extraHeaders?: Record<string, string>
) {
  return NextResponse.json(
    { error, ...(code ? { code } : {}) },
    { status, headers: { ...NO_STORE_HEADERS, ...(extraHeaders ?? {}) } }
  );
}

/** Decode a JWT payload without verifying (the token came straight from GoTrue). */
function decodeClaims(token: string): { aal?: string; session_id?: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const parsed = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as { aal?: string; session_id?: string };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const rid = requestId();
  try {
    if (!originAllowed(req)) {
      securityLog('auth.mfa.origin_blocked', {});
      return fail(403, 'Request blocked.');
    }

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

    const parsed = VerifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const ip = clientIp(req);

    const ipGate = await dbRateLimit(req, 'admin-mfa', 10, 600);
    if (!ipGate.ok) {
      securityLog('auth.mfa.rate_limited', { ip, scope: 'ip' });
      return fail(429, 'Too many attempts. Please wait a few minutes and try again.', 'TOO_MANY_ATTEMPTS', {
        'Retry-After': String(ipGate.retryAfterSec),
      });
    }

    const ticket = readAdminTicket(req.cookies.get(ADMIN_MFA_TICKET_COOKIE)?.value);
    if (!ticket) {
      securityLog('auth.mfa.failure', { ip, reason: 'ticket' });
      return fail(
        401,
        'Your sign-in session expired. Please enter your password again.',
        'MFA_EXPIRED'
      );
    }

    // Uid-scoped limit: the binding protection against distributed guessing
    // (the ticket cannot be refreshed without the password). READ-ONLY peek —
    // only FAILED codes consume this bucket (see the failure branch below),
    // so a successful verify never moves an admin towards MFA_LOCKED.
    const uidPeek = await peekRateLimit('admin-mfa-uid', ticket.uid, 5, 600);
    if (uidPeek.blocked) {
      securityLog('auth.mfa.locked', { userId: ticket.uid, ip });
      return fail(
        429,
        'Too many incorrect codes. Please wait a few minutes and sign in again.',
        'MFA_LOCKED',
        { 'Retry-After': String(uidPeek.retryAfterSec) }
      );
    }

    const result = await verifyTotp(ticket.atk, ticket.fid, ticket.cid, parsed.data.code);

    if (!result.ok) {
      securityLog('auth.mfa.failure', { userId: ticket.uid, ip, reason: result.reason });

      if (result.reason === 'expired') {
        return fail(
          401,
          'Your sign-in session expired. Please enter your password again.',
          'MFA_EXPIRED'
        );
      }
      if (result.reason === 'fetch-failed' || result.reason === 'not-configured' || result.reason === 'bad-response') {
        return fail(503, 'Verification is temporarily unavailable. Please try again.');
      }
      // Wrong code: consume the uid budget (failures only — review fix).
      const uidFail = await dbRateLimitFor('admin-mfa-uid', ticket.uid, 5, 600);
      if (!uidFail.ok) {
        securityLog('auth.mfa.locked', { userId: ticket.uid, ip });
        return fail(
          429,
          'Too many incorrect codes. Please wait a few minutes and sign in again.',
          'MFA_LOCKED',
          { 'Retry-After': String(uidFail.retryAfterSec) }
        );
      }
      return fail(401, 'That code was not correct. Please try again.', 'MFA_INVALID');
    }

    // ── Success ────────────────────────────────────────────────────────
    const session = result.session;

    // Defence in depth: the fresh session must be aal2 and belong to the
    // same user the ticket was issued for.
    const claims = decodeClaims(session.accessToken);
    if (claims?.aal !== 'aal2' || session.userId !== ticket.uid) {
      log.error('[/api/admin/auth/mfa/verify] session sanity check failed');
      return fail(500, 'Sign-in could not be completed. Please try again.', 'MFA_FAILED');
    }

    // Revoke the aal1 session if MFA upgraded into a different session id
    // (scope 'local' — never 'global', which would kill the new aal2 session).
    const aal1Session = decodeClaims(ticket.atk)?.session_id;
    const aal2Session = claims.session_id;
    if (isServiceConfigured() && aal1Session && aal2Session && aal1Session !== aal2Session) {
      try {
        await getServiceClient().auth.admin.signOut(ticket.atk, 'local');
      } catch (err) {
        log.warn('[/api/admin/auth/mfa/verify] aal1 session revoke failed:', err);
      }
    }

    await clearLoginFailures(ticket.email, ip);
    securityLog('auth.mfa.success', { userId: ticket.uid, email: ticket.email, ip });

    const response = NextResponse.json(
      { success: true, user: { id: ticket.uid, email: ticket.email } },
      { headers: NO_STORE_HEADERS }
    );

    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: session.accessToken,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: session.expiresIn || 3600,
    });

    // One-shot ticket.
    response.cookies.set({
      name: ADMIN_MFA_TICKET_COOKIE,
      value: '',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (err) {
    log.error('[/api/admin/auth/mfa/verify] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Sign-in could not be completed. Please try again.', request_id: rid },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
