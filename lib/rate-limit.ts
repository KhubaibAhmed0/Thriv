/**
 * lib/rate-limit.ts
 *
 * Minimal in-memory fixed-window rate limiter for public API routes.
 *
 * Limitation: state lives in each serverless instance (not shared across
 * instances or regions). It meaningfully blunts scripted abuse of the public
 * order endpoint for a single-owner shop; a distributed limiter (Upstash,
 * Vercel WAF) can replace it later without changing call sites.
 *
 * Server-side only (imported by API route handlers).
 */

import type { NextRequest } from 'next/server';

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 5000;

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
}

/**
 * Fixed-window limiter. Call once per request:
 *   const r = rateLimit(`orders:${clientIp(req)}`, 6, 10 * 60_000);
 *   if (!r.ok) return 429 with Retry-After.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
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

  // Opportunistic cleanup so the map cannot grow unbounded.
  if (buckets.size > MAX_TRACKED_KEYS) {
    for (const [k, b] of buckets) {
      if (b.hits.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }

  return { ok: true, retryAfterSec: 0 };
}

/** Best-effort client IP on Vercel (x-forwarded-for is platform-controlled). */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}
