/**
 * Shared error helpers.
 *
 * Route handlers must not `catch (err: any)` (audit F-65 / eslint
 * no-explicit-any). Use these instead.
 */

/** Extract a human-readable message from an unknown thrown value. */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
}
