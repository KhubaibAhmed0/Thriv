/**
 * lib/api-guard.ts
 *
 * Phase 3/4 hardening (2026-10-18 brief): shared request guards used by the
 * public checkout routes and the admin auth routes.
 *
 * - clientIp / sha256Hex / dbRateLimit: DB-backed fixed-window rate limiting
 *   through the service-role-only `check_rate_limit` RPC. If the RPC is
 *   unreachable the in-memory limiter (moved here from lib/rate-limit.ts)
 *   takes over so a limiter can never fail fully open; the degradation is
 *   logged (scope only — never the key or IP).
 * - originAllowed: CSRF mitigation for browser requests. Non-browser clients
 *   without an Origin header still face Turnstile + honeypot + rate limits —
 *   this is not an authorization control.
 * - honeypotTripped: the invisible `website` field that real users never fill.
 * - verifyTurnstile: Cloudflare siteverify, fail closed (missing secret or
 *   unreachable siteverify both reject).
 *
 * Server-side only.
 */

import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';
import { securityLog } from '@/lib/security-log';
import { errorMessage } from '@/lib/errors';
import { log } from '@/lib/log';

// ── client IP ─────────────────────────────────────────────────────────

/**
 * Best-effort client IP. Vercel controls these headers (they cannot be
 * spoofed through the platform); `x-vercel-forwarded-for` is preferred when
 * present, then the classic XFF chain, then x-real-ip.
 */
export function clientIp(req: NextRequest): string {
  const vercelFwd = req.headers.get('x-vercel-forwarded-for');
  if (vercelFwd) {
    const first = vercelFwd.split(',')[0]?.trim();
    if (first) return first;
  }
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** Stable hash — raw IPs/emails never reach the rate-limit table. */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

// ── rate limiting ─────────────────────────────────────────────────────

export interface RateLimitOutcome {
  ok: boolean;
  retryAfterSec: number;
}

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 5000;

/**
 * In-memory fixed-window limiter (moved from lib/rate-limit.ts). Used only
 * as the automatic fallback when the DB limiter is unavailable.
 */
function rateLimit(key: string, limit: number, windowMs: number): RateLimitOutcome {
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }

  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0] ?? now;
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }

  bucket.hits.push(now);

  if (buckets.size > MAX_TRACKED_KEYS) {
    for (const [k, b] of buckets) {
      if (b.hits.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }

  return { ok: true, retryAfterSec: 0 };
}

/**
 * DB-backed limiter: sha256(scope + ':' + ip) → check_rate_limit(key, max,
 * window). The RPC counts the current hit, so `max` requests per window are
 * allowed (same semantics as the previous in-memory limiter).
 */
export async function dbRateLimit(
  req: NextRequest,
  scope: string,
  max: number,
  windowSec: number
): Promise<RateLimitOutcome> {
  return dbRateLimitFor(scope, clientIp(req), max, windowSec);
}

/**
 * Same limiter for non-IP subjects (e.g. a normalized email or a user id).
 * The identifier is hashed before it ever reaches the database.
 */
export async function dbRateLimitFor(
  scope: string,
  identifier: string,
  max: number,
  windowSec: number
): Promise<RateLimitOutcome> {
  const keyHash = sha256Hex(`${scope}:${identifier}`);

  try {
    if (!isServiceConfigured()) throw new Error('service client not configured');
    const supabase = getServiceClient();
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_key_hash: keyHash,
      p_max: max,
      p_window_seconds: windowSec,
    });

    if (error) throw new Error(error.message);
    if (data === false) return { ok: false, retryAfterSec: windowSec };
    if (data === true) return { ok: true, retryAfterSec: 0 };
    throw new Error('unexpected check_rate_limit result');
  } catch (err) {
    // Degraded mode: keep limiting, in this instance only. Scope only in logs.
    securityLog('ratelimit.degraded', { scope });
    log.error(
      `[api-guard] rate limit RPC unavailable for ${scope}:`,
      errorMessage(err, 'unknown')
    );
    return rateLimit(`fallback:${keyHash}`, max, windowSec * 1000);
  }
}

/**
 * Read-only peek at a fixed-window counter: reports whether the budget for
 * (scope, identifier) is exhausted inside the CURRENT window, without
 * consuming any of it. Used where a pre-check must not lock out a
 * legitimate success (e.g. the admin account gate): those buckets count
 * failures only, incremented via dbRateLimitFor at failure time.
 *
 * Fails open on store errors: the increment path plus the in-memory
 * fallback still bound the attempt rate.
 */
export async function peekRateLimit(
  scope: string,
  identifier: string,
  max: number,
  windowSec: number
): Promise<{ blocked: boolean; retryAfterSec: number }> {
  const keyHash = sha256Hex(`${scope}:${identifier}`);

  try {
    if (!isServiceConfigured()) throw new Error('service client not configured');
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('rate_limits')
      .select('window_start, hit_count')
      .eq('key_hash', keyHash)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return { blocked: false, retryAfterSec: 0 };

    const windowStart = Date.parse(data.window_start as string);
    const expiresAt = windowStart + windowSec * 1000;
    if (!Number.isFinite(windowStart) || Date.now() >= expiresAt) {
      return { blocked: false, retryAfterSec: 0 };
    }
    if (Number(data.hit_count) < max) return { blocked: false, retryAfterSec: 0 };
    return {
      blocked: true,
      retryAfterSec: Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000)),
    };
  } catch (err) {
    securityLog('ratelimit.peek_degraded', { scope });
    log.error(
      `[api-guard] rate limit peek unavailable for ${scope}:`,
      errorMessage(err, 'unknown')
    );
    return { blocked: false, retryAfterSec: 0 };
  }
}

// ── origin check ──────────────────────────────────────────────────────

/**
 * CSRF mitigation for state-changing routes: when the browser sends an
 * Origin header its host must equal the request host. A missing Origin is
 * allowed (non-browser clients); a malformed or mismatched Origin is not.
 */
export function originAllowed(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (origin === null) return true;
  if (!origin || origin === 'null' || origin.includes(',')) return false;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  if (!originHost) return false;

  const targetHost = (
    req.headers.get('host') ||
    req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    ''
  ).trim();

  if (!targetHost) return false;
  return originHost === targetHost;
}

// ── honeypot ──────────────────────────────────────────────────────────

/** The `website` field is invisible to users; any value means a bot. */
export function honeypotTripped(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false;
  const value = (body as Record<string, unknown>).website;
  return typeof value === 'string' && value.trim() !== '';
}

// ── Turnstile ─────────────────────────────────────────────────────────

const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Cloudflare's documented test site keys. Test keys always validate (or
 * always challenge), so siteverify returns `hostname:"example.com"` for any
 * token — the hostname binding below would reject every token when the app
 * runs locally (or anywhere the test keys are still configured). The binding
 * therefore applies only to real site keys; that is not a weakening: with a
 * test secret, ANY token string already passes siteverify, so the hostname
 * check protects nothing until real keys are installed, upon which it
 * activates automatically.
 */
const TEST_SITE_KEYS = new Set([
  '1x00000000000000000000AA', // always passes (visible)
  '2x00000000000000000000AB', // always passes (invisible)
  '3x00000000000000000000FF', // forces interactive challenge
]);

export interface TurnstileResult {
  ok: boolean;
  /** true when the check could not run at all (missing secret / CF down). */
  infra: boolean;
}

/**
 * Verifies a Turnstile token. Fails CLOSED: no secret configured, network
 * failure, or non-200 from siteverify all reject. `infra: true` lets callers
 * map infrastructure failures to a 503 (availability copy) instead of a
 * generic 400.
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  ip: string,
  expectedHost: string | null
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || secret.startsWith('<')) {
    log.error('[turnstile] TURNSTILE_SECRET_KEY is not configured — rejecting (fail closed).');
    return { ok: false, infra: true };
  }

  if (!token || typeof token !== 'string' || token.length > 4096) {
    return { ok: false, infra: false };
  }

  try {
    const form = new URLSearchParams();
    form.set('secret', secret);
    form.set('response', token);
    if (ip && ip !== 'unknown') form.set('remoteip', ip);

    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: form,
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      log.error('[turnstile] siteverify returned HTTP', res.status);
      return { ok: false, infra: true };
    }

    const data = (await res.json().catch(() => null)) as {
      success?: boolean;
      hostname?: string;
      'error-codes'?: string[];
    } | null;

    if (!data || data.success !== true) {
      log.warn('[turnstile] rejected:', JSON.stringify(data?.['error-codes'] ?? []));
      return { ok: false, infra: false };
    }

    // A token is only valid for the site that rendered the widget. Skipped
    // while a test site key is configured (see TEST_SITE_KEYS above). For
    // real keys a MISSING hostname is also rejected (fail closed).
    const usingTestKeys = TEST_SITE_KEYS.has(
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''
    );
    if (!usingTestKeys && expectedHost && data.hostname !== expectedHost) {
      log.warn('[turnstile] hostname mismatch:', data.hostname ?? '(missing)');
      return { ok: false, infra: false };
    }

    return { ok: true, infra: false };
  } catch (err) {
    log.error('[turnstile] siteverify unreachable:', errorMessage(err, 'unknown'));
    return { ok: false, infra: true };
  }
}

// ── misc helpers ──────────────────────────────────────────────────────

/** Short request id for 5xx bodies (brief 4g) and log correlation. */
export function requestId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 8);
}

export const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' } as const;
