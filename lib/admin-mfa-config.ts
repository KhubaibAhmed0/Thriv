/**
 * lib/admin-mfa-config.ts
 *
 * Admin MFA master switch.
 *
 * 2026-10-18 (owner request, after the first-login fixes): TOTP two-factor
 * is temporarily DISABLED — a correct password signs an admin in directly
 * (`app/api/admin/auth/login` issues the cookie from the fresh password-grant
 * session), and `verifyAdminToken` accepts that aal1 session. Turnstile, the
 * login throttle, DB rate limits, and every other gate remain active.
 *
 * Set to `true` to re-activate the full flow (signed login ticket → TOTP
 * verification → aal2-only sessions). Nothing else needs to change: both the
 * login route and the admin guard read this flag. The MFA routes, ticket,
 * and enrollment UI are kept intact for that reason.
 */
export const ADMIN_MFA_ENABLED = false;
