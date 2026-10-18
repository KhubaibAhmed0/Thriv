/**
 * lib/admin-mfa.ts
 *
 * Server-side TOTP factor management for the admin login flow, via GoTrue's
 * user-level MFA endpoints. This build of GoTrue rejects admin-side enroll
 * (`POST /auth/v1/admin/users/{id}/factors` → 405 — probed live), so all
 * enroll/challenge/verify calls use the short-lived aal1 access token from
 * the password grant, executed here on the server. The browser never talks
 * to Supabase (brief 3c).
 *
 * Successful verify returns a fresh session whose access token carries
 * `aal: "aal2"` — that token becomes the admin cookie.
 *
 * All functions return discriminated results and never throw.
 *
 * Server-side only.
 */

import 'server-only';
import { getSupabasePublicEnv, getSupabaseServiceEnv } from '@/lib/supabase-env';

export interface TotpFactor {
  id: string;
  status: string;
}

export type FactorsResult =
  | { ok: true; factors: TotpFactor[] }
  | { ok: false; reason: 'not-configured' | 'fetch-failed' };

export type EnrollResult =
  | { ok: true; factor: { id: string; qrSvg: string; secret: string } }
  | { ok: false; reason: 'not-configured' | 'fetch-failed' | 'bad-response' };

export type ChallengeResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'not-configured' | 'fetch-failed' | 'bad-response' };

export type VerifyResult =
  | {
      ok: true;
      session: { accessToken: string; refreshToken: string; expiresIn: number; userId: string };
    }
  | { ok: false; reason: 'invalid' | 'expired' | 'fetch-failed' | 'bad-response' | 'not-configured' };

const GOTRUE_TIMEOUT_MS = 8000;

interface GoTrueResponse {
  status: number;
  body: unknown;
}

async function userRequest(
  path: string,
  accessToken: string,
  init: { method: string; body?: unknown } = { method: 'GET' }
): Promise<GoTrueResponse> {
  const { url, anonKey } = getSupabasePublicEnv();
  if (!url || !anonKey) return { status: 0, body: null };

  try {
    const res = await fetch(`${url}/auth/v1${path}`, {
      method: init.method,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
      signal: AbortSignal.timeout(GOTRUE_TIMEOUT_MS),
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  } catch {
    return { status: 0, body: null };
  }
}

async function serviceRequest(
  path: string,
  method: 'DELETE'
): Promise<GoTrueResponse> {
  const { url, serviceKey } = getSupabaseServiceEnv();
  if (!url || !serviceKey) return { status: 0, body: null };

  try {
    const res = await fetch(`${url}/auth/v1${path}`, {
      method,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(GOTRUE_TIMEOUT_MS),
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  } catch {
    return { status: 0, body: null };
  }
}

function readFactors(value: unknown): TotpFactor[] | null {
  if (typeof value !== 'object' || value === null) return null;
  const factors = (value as { factors?: unknown }).factors;
  if (!Array.isArray(factors)) return null;
  return factors
    .filter(
      (f): f is { id: string; factor_type?: unknown; status?: unknown } =>
        typeof f === 'object' &&
        f !== null &&
        typeof (f as { id?: unknown }).id === 'string'
    )
    .filter((f) => (f as { factor_type?: unknown }).factor_type === 'totp')
    .map((f) => ({
      id: f.id,
      status: typeof (f as { status?: unknown }).status === 'string'
        ? (f as { status: string }).status
        : 'unverified',
    }));
}

/**
 * Canonical factor source is `GET /auth/v1/user`; the sign-in response's
 * `user.factors` is only a fallback (shapes vary across GoTrue versions).
 */
export async function getTotpFactors(
  accessToken: string,
  signInFactors?: unknown
): Promise<FactorsResult> {
  const { url, anonKey } = getSupabasePublicEnv();
  if (!url || !anonKey) return { ok: false, reason: 'not-configured' };

  const fromUser = await userRequest('/user', accessToken);
  if (fromUser.status === 200) {
    const factors = readFactors(fromUser.body);
    if (factors) return { ok: true, factors };
  }

  const fallback = readFactors({ factors: signInFactors });
  if (fallback) return { ok: true, factors: fallback };

  return { ok: false, reason: 'fetch-failed' };
}

export async function enrollTotp(accessToken: string): Promise<EnrollResult> {
  const { url, anonKey } = getSupabasePublicEnv();
  if (!url || !anonKey) return { ok: false, reason: 'not-configured' };

  const res = await userRequest('/factors', accessToken, {
    method: 'POST',
    body: { factor_type: 'totp', friendly_name: 'Thriv admin' },
  });
  if (res.status >= 300) return { ok: false, reason: 'fetch-failed' };

  const body = res.body as {
    id?: unknown;
    totp?: { qr_code?: unknown; secret?: unknown };
  } | null;

  if (
    !body ||
    typeof body.id !== 'string' ||
    typeof body.totp?.qr_code !== 'string' ||
    typeof body.totp?.secret !== 'string'
  ) {
    return { ok: false, reason: 'bad-response' };
  }

  return {
    ok: true,
    factor: { id: body.id, qrSvg: body.totp.qr_code, secret: body.totp.secret },
  };
}

export async function challengeTotp(
  accessToken: string,
  factorId: string
): Promise<ChallengeResult> {
  const { url, anonKey } = getSupabasePublicEnv();
  if (!url || !anonKey) return { ok: false, reason: 'not-configured' };

  const res = await userRequest(
    `/factors/${encodeURIComponent(factorId)}/challenge`,
    accessToken,
    { method: 'POST', body: {} }
  );
  if (res.status >= 300) return { ok: false, reason: 'fetch-failed' };

  const body = res.body as { id?: unknown } | null;
  if (!body || typeof body.id !== 'string') return { ok: false, reason: 'bad-response' };
  return { ok: true, id: body.id };
}

export async function verifyTotp(
  accessToken: string,
  factorId: string,
  challengeId: string,
  code: string
): Promise<VerifyResult> {
  const { url, anonKey } = getSupabasePublicEnv();
  if (!url || !anonKey) return { ok: false, reason: 'not-configured' };

  const res = await userRequest(
    `/factors/${encodeURIComponent(factorId)}/verify`,
    accessToken,
    { method: 'POST', body: { challenge_id: challengeId, code } }
  );

  if (res.status >= 300) {
    const errorCode =
      typeof res.body === 'object' && res.body !== null
        ? String(
            (res.body as { error_code?: unknown; code?: unknown }).error_code ??
              (res.body as { code?: unknown }).code ??
              ''
          )
        : '';
    if (errorCode.includes('expired')) return { ok: false, reason: 'expired' };
    if (res.status === 0) return { ok: false, reason: 'fetch-failed' };
    if (res.status === 401 || res.status === 403 || res.status === 422) {
      return { ok: false, reason: 'invalid' };
    }
    return { ok: false, reason: 'fetch-failed' };
  }

  const body = res.body as {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_in?: unknown;
    user?: { id?: unknown };
  } | null;

  if (
    !body ||
    typeof body.access_token !== 'string' ||
    typeof body.user?.id !== 'string'
  ) {
    return { ok: false, reason: 'bad-response' };
  }

  return {
    ok: true,
    session: {
      accessToken: body.access_token,
      refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : '',
      expiresIn: typeof body.expires_in === 'number' ? body.expires_in : 3600,
      userId: body.user.id,
    },
  };
}

/**
 * Deletes a factor via the service role. Callers may ONLY pass ids that came
 * straight from the unverified list — never a verified factor (a password-only
 * attacker must not be able to strip the owner's TOTP).
 */
export async function deleteUnverifiedFactorAsAdmin(
  userId: string,
  factorId: string
): Promise<boolean> {
  const res = await serviceRequest(
    `/admin/users/${encodeURIComponent(userId)}/factors/${encodeURIComponent(factorId)}`,
    'DELETE'
  );
  return res.status < 300;
}
