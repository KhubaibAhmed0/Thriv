/**
 * lib/admin-cookie.ts
 *
 * The admin session cookie name lives in one place. Audit F-82: the
 * `__Host-` prefix makes browsers enforce the cookie's integrity —
 * Secure, Path=/, no Domain — so no subdomain or non-HTTPS origin can
 * ever set or shadow it.
 *
 * NOTE: the `__Host-` prefix requires `Secure`, so the cookie is only
 * issued over HTTPS (production) or HTTPS-equivalent origins (browsers
 * treat http://localhost as trustworthy, which keeps local dev working).
 */
export const ADMIN_COOKIE_NAME = '__Host-thriv_admin_token';
