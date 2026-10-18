/**
 * lib/audit.ts
 *
 * Actor-attributed audit rows (brief 4h). The DB triggers in
 * 20261018_security_hardening.sql record price/stock/settings changes with a
 * NULL actor (database-level truth); the admin API routes additionally write
 * rows here naming the admin who made the change.
 *
 * Writes are awaited but never fatal: an audit row must not turn a
 * successful admin action into a 500. Failures are logged server-side.
 *
 * Table: public.audit_log (actor_id, action, entity, entity_id, before,
 * after, created_at).
 *
 * Server-side only.
 */

import 'server-only';
import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';
import { errorMessage } from '@/lib/errors';
import { log } from '@/lib/log';

export interface AuditEntry {
  actorId?: string | null;
  /** e.g. 'order.status', 'product.create'. */
  action: string;
  /** e.g. 'orders', 'products'. */
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

/** Cap payload size so a huge product JSON-array cannot bloat the table. */
const MAX_JSON_CHARS = 4000;

function cap(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length <= MAX_JSON_CHARS) return value;
    return { truncated: serialized.slice(0, MAX_JSON_CHARS) };
  } catch {
    return null;
  }
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  if (!isServiceConfigured()) return;

  try {
    const { error } = await getServiceClient()
      .from('audit_log')
      .insert({
        actor_id: entry.actorId ?? null,
        action: entry.action,
        entity: entry.entity,
        entity_id: entry.entityId ?? null,
        before: cap(entry.before),
        after: cap(entry.after),
      });

    if (error) {
      log.error('[audit] insert failed:', error.message);
    }
  } catch (err) {
    log.error('[audit] insert error:', errorMessage(err, 'unknown'));
  }
}
