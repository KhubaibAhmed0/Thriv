/**
 * lib/admin-ticket.ts
 *
 * The stateless, server-signed ticket that bridges the admin password step
 * and the MFA step (Phase 3, 2026-10-18 brief).
 *
 * The ticket carries the aal1 access token obtained from the password grant,
 * so it is delivered ONLY as an httpOnly `__Host-` cookie — never in a JSON
 * body (a readable aal1 token is a usable Supabase bearer and would bypass
 * MFA against PostgREST). See security/plan-phase3-4.md, correction #1.
 *
 * Structure: base64url(JSON payload) + '.' + base64url(HMAC-SHA256(body)).
 * The signature is verified BEFORE the payload is parsed; `exp` lives inside
 * the signed body. Key = sha256('thriv-admin-ticket-v1:' + service-role key),
 * so no new secret is introduced; if the service key is absent the module
 * refuses to create or read tickets (callers fail closed with 503).
 *
 * Server-side only.
 */

import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { getSupabaseServiceEnv } from '@/lib/supabase-env';

export const ADMIN_MFA_TICKET_COOKIE = '__Host-thriv_mfa_ticket';
export const ADMIN_MFA_TICKET_TTL_MS = 5 * 60 * 1000;
/** Well under the 4096-byte cookie cap (access token + metadata ≈ 2 KB). */
const MAX_TICKET_CHARS = 3800;

export interface AdminTicketPayload {
  /** Supabase user id. */
  uid: string;
  /** Normalized (trimmed, lowercased) email — matches the throttle key. */
  email: string;
  /** aal1 access token from the password grant. */
  atk: string;
  /** TOTP factor id. */
  fid: string;
  /** GoTrue challenge id. */
  cid: string;
  /** 'setup' = factor being enrolled; 'verify' = existing verified factor. */
  pur: 'setup' | 'verify';
  /** Expiry, epoch ms (inside the signed body). */
  exp: number;
}

function ticketKey(): Buffer | null {
  const { serviceKey } = getSupabaseServiceEnv();
  if (!serviceKey) return null;
  return createHash('sha256').update(`thriv-admin-ticket-v1:${serviceKey}`).digest();
}

/** Returns the signed ticket, or null when the service env is missing / oversized. */
export function createAdminTicket(
  payload: Omit<AdminTicketPayload, 'exp'>,
  ttlMs: number = ADMIN_MFA_TICKET_TTL_MS
): string | null {
  const key = ticketKey();
  if (!key) return null;

  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + ttlMs }),
    'utf8'
  ).toString('base64url');
  const sig = createHmac('sha256', key).update(body).digest('base64url');

  const ticket = `${body}.${sig}`;
  return ticket.length <= MAX_TICKET_CHARS ? ticket : null;
}

/** Verifies and parses a ticket. Returns null for anything malformed, tampered, or expired. */
export function readAdminTicket(ticket: string | null | undefined): AdminTicketPayload | null {
  if (!ticket || typeof ticket !== 'string' || ticket.length > MAX_TICKET_CHARS) return null;

  const key = ticketKey();
  if (!key) return null;

  const parts = ticket.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  // Verify the MAC before parsing anything.
  const expected = createHmac('sha256', key).update(parts[0]).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(parts[1], 'base64url');
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  // Authenticated — safe to parse and validate structurally.
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const p = parsed as Record<string, unknown>;
  const structurallyValid =
    typeof p.uid === 'string' &&
    p.uid.length > 0 &&
    typeof p.email === 'string' &&
    typeof p.atk === 'string' &&
    p.atk.length > 0 &&
    typeof p.fid === 'string' &&
    p.fid.length > 0 &&
    typeof p.cid === 'string' &&
    p.cid.length > 0 &&
    (p.pur === 'setup' || p.pur === 'verify') &&
    typeof p.exp === 'number' &&
    Number.isFinite(p.exp);

  if (!structurallyValid) return null;
  if ((p.exp as number) <= Date.now()) return null;

  return parsed as AdminTicketPayload;
}
