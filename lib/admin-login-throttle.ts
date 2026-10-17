/**
 * lib/admin-login-throttle.ts
 *
 * Persistent login throttle (audit F-44). Failed admin logins are counted
 * per (email, IP) pair in `admin_login_attempts`; five failures inside
 * the window lock further attempts for that pair. Rows are failures only —
 * a successful login clears the pair's rows.
 *
 * Failure mode: if the throttle store is unavailable the login proceeds
 * (availability over lockout) but the error is logged loudly; the
 * Supabase platform throttle and the auth check itself still apply.
 */
import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';
import { errorForLog, securityLog } from '@/lib/security-log';

export const LOGIN_THROTTLE_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_THROTTLE_MAX_FAILURES = 5;
/** Housekeeping horizon: failure rows older than this are pruned. */
const LOGIN_ATTEMPT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const TABLE = 'admin_login_attempts';

/**
 * Number of failures for this (email, IP) pair inside the throttle window,
 * or null when the store could not be consulted.
 */
export async function countRecentLoginFailures(
  email: string,
  ip: string
): Promise<number | null> {
  if (!isServiceConfigured()) return null;
  try {
    const since = new Date(Date.now() - LOGIN_THROTTLE_WINDOW_MS).toISOString();
    const { count, error } = await getServiceClient()
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .eq('ip', ip)
      .gte('attempted_at', since);

    if (error) {
      console.error('[login-throttle] count failed:', error.message);
      return null;
    }
    return count ?? 0;
  } catch (err) {
    securityLog('auth.throttle.error', { op: 'count', error: errorForLog(err) });
    return null;
  }
}

/** Persist one failed attempt (best-effort) and prune old rows. */
export async function recordLoginFailure(email: string, ip: string): Promise<void> {
  if (!isServiceConfigured()) return;
  try {
    const service = getServiceClient();
    const { error } = await service.from(TABLE).insert({ email, ip });
    if (error) {
      console.error('[login-throttle] record failed:', error.message);
      return;
    }
    const cutoff = new Date(Date.now() - LOGIN_ATTEMPT_RETENTION_MS).toISOString();
    await service.from(TABLE).delete().lt('attempted_at', cutoff);
  } catch (err) {
    securityLog('auth.throttle.error', { op: 'record', error: errorForLog(err) });
  }
}

/** A successful login resets the pair's failure counter. */
export async function clearLoginFailures(email: string, ip: string): Promise<void> {
  if (!isServiceConfigured()) return;
  try {
    await getServiceClient().from(TABLE).delete().eq('email', email).eq('ip', ip);
  } catch (err) {
    securityLog('auth.throttle.error', { op: 'clear', error: errorForLog(err) });
  }
}
