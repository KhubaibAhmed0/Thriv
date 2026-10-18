/**
 * lib/log.ts
 *
 * Redacting server-side logger (Phase 6f of the 2026-10-18 brief).
 *
 * Order PII must never reach the platform logs. `log.*` mirrors the
 * console.* call shapes used across the server modules but scrubs:
 *  - object keys named after PII fields (phone/email/address/notes/name...),
 *  - email-shaped and phone-shaped (>10 digits) substrings anywhere,
 *  - thrown values (message only).
 *
 * Logging must never throw and never block a request.
 *
 * Server-side only.
 */

import 'server-only';

const REDACTED = '[redacted]';

const PII_KEYS = new Set([
  'phone',
  'email',
  'customer_phone',
  'customer_email',
  'whatsapp',
  'address',
  'address_line',
  'notes',
  'customer_name',
]);

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** 10+ consecutive digits (optionally separated) — phone-like. */
const PHONE_RE = /\+?\d(?:[\s-]?\d){9,}/g;

function redactString(value: string): string {
  return value
    .replace(EMAIL_RE, REDACTED)
    .replace(PHONE_RE, REDACTED);
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 3) return REDACTED;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return value;
  }
  if (value instanceof Error) return redactString(value.message);
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = PII_KEYS.has(k) ? REDACTED : sanitize(v, depth + 1);
    }
    return out;
  }
  return REDACTED;
}

function emit(level: 'log' | 'warn' | 'error', message: string, details?: unknown): void {
  try {
    const line = `[thriv] ${redactString(message)}`;
    if (details === undefined) {
      console[level](line);
    } else {
      console[level](line, sanitize(details));
    }
  } catch {
    // Never let logging break a request.
  }
}

export const log = {
  info(message: string, details?: unknown): void {
    emit('log', message, details);
  },
  warn(message: string, details?: unknown): void {
    emit('warn', message, details);
  },
  error(message: string, details?: unknown): void {
    emit('error', message, details);
  },
};
