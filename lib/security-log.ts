/**
 * lib/security-log.ts
 *
 * Structured security-event logging (audit F-46). Every line is a single
 * JSON object on stdout, which Vercel captures in the deployment logs.
 * `tag:"security"` makes these greppable:
 *
 *   security auth.login.failure {...}
 *
 * Never include order PII (customer names/phones/addresses). Admin
 * identity (id/email) is fine — these are operator accounts, not
 * customers. Logging must never throw.
 */
export function securityLog(event: string, details?: Record<string, unknown>): void {
  try {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        tag: 'security',
        event,
        ...(details ?? {}),
      })
    );
  } catch {
    // Logging is best-effort; it must never break a request.
  }
}

/**
 * Renders a short, non-sensitive description of an unexpected error for
 * server-side logs (never sent to clients).
 */
export function errorForLog(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
