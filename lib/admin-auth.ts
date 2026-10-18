import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';
import { getSupabasePublicEnv } from '@/lib/supabase-env';
import { ADMIN_COOKIE_NAME } from '@/lib/admin-cookie';
import { ADMIN_MFA_ENABLED } from '@/lib/admin-mfa-config';
import { securityLog } from '@/lib/security-log';

export interface AdminUser {
  id: string;
  email?: string;
}

/** Decode a JWT payload without verifying (the token is verified via getUser). */
function decodeJwtClaims(token: string): { sub?: string; aal?: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const parsed = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as { sub?: string; aal?: string };
  } catch {
    return null;
  }
}

/**
 * Verifies that a Supabase access token belongs to a registered admin.
 *
 * FAILS CLOSED (audit F-01 / F-08): if required config is missing, or the
 * `public.admins` membership check cannot be performed, access is denied.
 * There is no "allow when unconfigured" branch — the previous dev-admin
 * fallback let anyone with any token read and mutate every order whenever
 * the NEXT_PUBLIC_* env vars were unset.
 */
export async function verifyAdminToken(
  token: string | null | undefined
): Promise<{ authorized: boolean; user?: AdminUser }> {
  if (!token || !token.trim()) {
    return { authorized: false };
  }

  const { url: supabaseUrl, anonKey } = getSupabasePublicEnv();
  if (!supabaseUrl || !anonKey) {
    console.warn(
      '[admin-auth] Supabase public env vars missing — denying request (fail closed).'
    );
    return { authorized: false };
  }

  if (!isServiceConfigured()) {
    console.warn(
      '[admin-auth] Service-role key missing — cannot verify admin membership — denying request (fail closed).'
    );
    return { authorized: false };
  }

  try {
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error,
    } = await authClient.auth.getUser(token);

    if (error || !user) {
      console.warn(
        '[admin-auth] token rejected by Supabase Auth:',
        error?.message ?? 'no user returned'
      );
      // F-46: audit invalid tokens — once per failed request is bounded
      // (the browser lands on the login page after one redirect).
      securityLog('auth.denied', { reason: 'invalid-token' });
      return { authorized: false };
    }

    const serviceClient = getServiceClient();
    const { data: adminRow, error: adminError } = await serviceClient
      .from('admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (adminError) {
      console.error('[admin-auth] admins lookup failed:', adminError.message);
      return { authorized: false };
    }

    if (!adminRow) {
      securityLog('auth.denied', { reason: 'not-admin', userId: user.id });
      return { authorized: false };
    }

    // MFA gate (Phase 3 brief). While ADMIN_MFA_ENABLED is true, only aal2
    // tokens (issued by the MFA verify route after a TOTP code check) may
    // access /admin or /api/admin. Currently disabled on owner request — see
    // lib/admin-mfa-config.ts; the flag enforces this check, nothing else.
    // The token itself was just validated by Supabase (getUser) above, so
    // reading the `aal` claim from its payload is sound.
    const claims = decodeJwtClaims(token);
    if (
      !claims ||
      claims.sub !== user.id ||
      (ADMIN_MFA_ENABLED && claims.aal !== 'aal2')
    ) {
      securityLog('auth.denied', { reason: 'mfa-required', userId: user.id });
      return { authorized: false };
    }

    return {
      authorized: true,
      user: { id: user.id, email: user.email },
    };
  } catch (err) {
    console.error('[admin-auth] verifyAdminToken error:', err);
    return { authorized: false };
  }
}

/** Extracts the admin token from a request (cookie or Bearer header) and verifies it. */
export async function verifyAdminRequest(req: NextRequest): Promise<{
  authorized: boolean;
  user?: AdminUser;
}> {
  const token =
    req.cookies.get(ADMIN_COOKIE_NAME)?.value ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  return verifyAdminToken(token);
}
