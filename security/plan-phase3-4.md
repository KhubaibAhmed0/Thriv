# Thriv security hardening — Phase 3 + Phase 4 implementation spec (v2, post-review)

v1 (`security/plan-phase3-4.md` history) was reviewed by two subagents
(security + integration); all `critical`/`major` findings are folded in here.
Phase 2 is applied and verified on the live DB.

Constraints: approved deps only (`server-only`, `zod`, `sharp`); minimal
diffs; no design/copy changes (customer-visible additions: Turnstile widget,
invisible honeypot, generic error messages, admin MFA steps); secrets never
logged/committed; never weaken a protection for a feature.

Live-probed facts: this GoTrue build rejects admin-side TOTP enroll (405) but
user-level `POST /auth/v1/factors` → challenge → verify works and verify
returns a real **aal2 session** (probed on a disposable test account). Cloudflare
Turnstile runs on the official always-pass test keys until the owner creates a
real widget; missing secret fails closed.

## Corrections applied after review (v1 → v2)

1. **Ticket is an httpOnly `__Host-` cookie, not JSON.** v1 put the aal1
   access token in a client-readable response; that token is a valid Supabase
   bearer usable against PostgREST directly (admin RLS is `is_admin()` based
   and ignores `aal`) — a strict regression. Now: `__Host-thriv_mfa_ticket`
   (Secure, HttpOnly, Path=/, SameSite=Lax, Max-Age 300). JSON responses carry
   no token. Verify route reads the cookie server-side.
2. **CSP ships with the widget** (`script-src`/`frame-src` +
   `https://challenges.cloudflare.com`) + env vars set before deploy.
3. **Ticket module hardening:** two-part base64url structure, length cap
   (< 3800 chars), HMAC verify before JSON.parse, timing-safe compare with
   length guard, key derivation only when `isServiceConfigured()` (else 503).
4. **Real attempt limiting:** uid-scoped DB limit on MFA verify
   (`admin-mfa-uid:{sha256(uid)}`, max 5/600 s) + IP limit; `att` counter
   dropped (was non-binding); lockout → 429 `MFA_LOCKED` → back to password.
5. **`dbRateLimit` never fails open:** moved in-memory limiter (from deleted
   `lib/rate-limit.ts`) becomes the automatic fallback when the RPC errors,
   plus `securityLog('ratelimit.degraded', {scope})`.
6. **Admin order-detail route:** raw `error.message` no longer returned;
   generic 500 + `request_id`; explicit column list = all `orders` columns
   except `public_token`.
7. **Stage order** (checkout + login): Origin → JSON parse (content-length
   cap) → honeypot → Turnstile → DB rate limit → zod → business logic.
   (Token only exists after parsing; honeypot is free so it precedes the CF
   call; rate limit bounds the DB/RPC path. Documented deviation from the
   brief's literal "Turnstile first".)
8. **Turnstile infra failures** (missing secret, network, siteverify failure)
   → 503 `CHECKOUT_UNAVAILABLE` for checkout (WhatsApp fallback UX intact);
   bad token → generic 400. Also validate CF `hostname` vs request host;
   log `error-codes` server-side only.
9. **Factor cleanup can only touch unverified factors**; re-assert zero
   verified factors immediately before enroll; verify asserts
   `session.user.id === ticket.uid`.
10. **Cart caps:** items 1–20 (brief); **quantity stays 1–40** (the client
    clamps to `product.stock` which can be 40 — a 10 cap would 400 legitimate
    merch orders; documented deviation, reported).
11. **`/order/[publicToken]`:** `robots:{index:false,follow:false}`; server
    page calls `notFound()` for non-UUID segments; confirmation client sweeps
    stale `thriv_order_*` localStorage keys (>24 h TTL) on mount.
12. **Display order number plumbing** (exact): API returns `public_token` +
    `order_number`; `ViewOrder` gains `orderNumber`; `snapshotToView` /
    `serverToView` map it; header/footer/WhatsApp use it (never the token).
13. **`lib/audit.ts` matches the real table** (`actor_id, action, entity,
    entity_id, before, after, created_at` — no `note` column).
14. **`server-only` import only in the new modules** (`lib/api-guard.ts`,
    `lib/admin-mfa.ts`, `lib/admin-ticket.ts`, `lib/audit.ts`) — adding it to
    `lib/supabase-server.ts` breaks `scripts/check-admin-guard.ts` (plain tsx;
    `server-only` throws outside a server bundle).
15. **`getTotpFactors` via `GET /auth/v1/user`** (canonical; sign-in response
    `user.factors` as fallback; fail closed if both fail). Ticket carries the
    normalized (lowercased, trimmed) email key.
16. **Challenge-expired mapping:** GoTrue `mfa_challenge_expired` ⇒
    `MFA_EXPIRED` (client returns to password step), not a dead retry loop.
17. **TurnstileWidget readiness:** submit disabled only while
    `ready && !token`; expired/error callbacks reset the token and widget.
    zod: `turnstile_token: z.string().max(4096).nullish()`,
    `website: z.string().max(200).optional().default('')`.
18. **Account-scoped login limit** added:
    `admin-login-acct:{sha256(lower(email))}`, 10/900 s (distributed attackers).
19. **On MFA success:** clear ticket cookie; `clearLoginFailures(emailKey, ip)`;
    revoke the aal1 session only when its `session_id` differs from the aal2
    session's (same session = upgraded, not revoked).
20. **proxy.ts stale-cookie delete** becomes an explicit `cookies.set` clear
    (`__Host-` deletes without Secure are rejected by browsers).
21. **Test/Attacker boundaries:** the attack suite keeps using the fixture
    accounts from `security/attack-tests/setup.mjs`; teardown script deletes
    them after the final run.
22. **Docs:** update the two stale `/order/[orderNumber]` references
    (`README.md`, `PROJECT_HANDOVER.md`).
23. **`lib/email.ts` redaction:** stub log no longer interpolates the customer
    email. Security log events added: `auth.login.mfa_required`,
    `auth.mfa.setup_started/completed/success/failure/locked`,
    `checkout.honeypot`, `checkout.turnstile.fail`, `ratelimit.denied/degraded`
    (scope only). Ticket/token/code/secret/QR never logged.
24. **clientIp** order: `x-vercel-forwarded-for` → `x-forwarded-for` →
    `x-real-ip` → `'unknown'`.

## Final file map

### New server modules
- `lib/api-guard.ts` — `clientIp`, in-memory `rateLimit` (fallback),
  `sha256Hex`, `dbRateLimit(req, scope, max, windowSec)` (RPC
  `check_rate_limit(p_key_hash,p_max,p_window_seconds)`; `data===false` ⇒
  over; `error` ⇒ fallback + degraded log), `originAllowed` (strict URL parse,
  deny on parse failure/`null`/multi-value; compare `URL(origin).host` with
  `host` header, else `x-forwarded-host` first token; absent Origin ⇒ allow,
  CSRF-mitigation only), `honeypotTripped` (object-safe), `verifyTurnstile`
  (fail closed; hostname check), `requestId()`, generic copy. `import 'server-only'`.
- `lib/admin-ticket.ts` — `createAdminTicket(payload)` / `readAdminTicket(t)` /
  `ADMIN_MFA_TICKET_COOKIE = '__Host-thriv_mfa_ticket'`. Payload
  `{uid, email, atk, fid, cid, pur, exp}`; HMAC key
  `sha256('thriv-admin-ticket-v1:' + SUPABASE_SERVICE_ROLE_KEY)`; 503 if
  service env missing. `import 'server-only'`.
- `lib/admin-mfa.ts` — `getTotpFactors`, `enrollTotp`, `challengeTotp`,
  `verifyTotp`, `deleteUnverifiedFactorAsAdmin` (refuses anything not passed
  in as explicitly unverified). Discriminated results; no throws.
  `import 'server-only'`.
- `lib/audit.ts` — `writeAudit({actorId, action, entity, entityId, before,
  after})` → `audit_log` via service client; awaited, never fatal
  (`catch` + console). `import 'server-only'`.
- `components/TurnstileWidget.tsx` — explicit render; `onToken(t|null)`,
  `onReady()`; invisible honeypot sibling lives in the forms.
- `lib/log.ts` — redacting logger (fields named phone/email/address_line/
  notes/name redacted; email/phone-shaped substrings masked; never throws).

### Rewritten routes/pages
- `app/api/admin/auth/login/route.ts` — stages as §7; zod strict
  `{email,password,turnstile_token,website}`; rate limits
  (`admin-login:{ip}` 10/900, `admin-login-acct:{email}` 10/900) + existing
  `admin_login_attempts` throttle; on password+admin OK: verified TOTP ⇒
  challenge + set ticket cookie + **401 `{mfa_required:true}`**; none ⇒ clean
  unverified, enroll, challenge, set ticket cookie + **401
  `{mfa_setup:true, qr_data_uri, manual_key}`**; no cookie/token in JSON;
  `Cache-Control: no-store`.
- `app/api/admin/auth/mfa/verify/route.ts` — Origin → parse → zod strict
  `{code:/^\d{6}$/}` → IP limit (10/600) → read ticket cookie (401
  `MFA_EXPIRED` if bad) → uid limit (5/600; 429 `MFA_LOCKED`) →
  `verifyTotp` → assert `user.id===uid` + decoded JWT `aal==='aal2'` → set
  `__Host-thriv_admin_token` (maxAge `expires_in`), clear ticket cookie,
  clear login failures, maybe revoke aal1 session (§19) →
  `{success:true,user}`. Wrong code ⇒ 401 `MFA_INVALID` (cookie stays, user
  retries). Challenge expired ⇒ 401 `MFA_EXPIRED`.
- `lib/admin-auth.ts` — add JWT-payload `aal==='aal2'` check
  (`Buffer.from(part,'base64url')`, `payload.sub===user.id`, deny on any
  decode failure) after the admins check.
- `proxy.ts` — explicit cookie-clear on denied.
- `app/admin/login/page.tsx` — three stages; handles 401 MFA handoff;
  Turnstile widget + honeypot; QR `<img src={qr_data_uri}>` + manual key;
  `MFA_INVALID` keeps stage; `MFA_EXPIRED`/`MFA_LOCKED` back to password.
- `app/api/orders/route.ts` — stages as §7 (rates: `orders:{ip}` 6/600);
  zod: items 1–20, quantity 1–40, address 5–300 (client keeps 10+), email
  max 254, `.strict()` + `turnstile_token`/`website` per §17; response gains
  `public_token` (defence block requires it too); replay path unchanged;
  5xx `request_id`.
- `app/api/orders/[publicToken]/route.ts` — UUID gate (404), `order-lookup:{ip}`
  30/600, lookup by `public_token`, payload unchanged, `no-store`,
  `request_id`.
- `app/order/[publicToken]/page.tsx` — UUID gate → `notFound()`; metadata:
  fixed title + `robots:'noindex,nofollow'`.
- `components/OrderConfirmationClient.tsx` — prop `publicToken`; display
  `orderNumber` from data; key `thriv_order_${publicToken}`; stale-key sweep.
- `components/CheckoutForm.tsx` — honeypot + widget; payload gains
  `turnstile_token`/`website`; disable submit only when `ready && !token`;
  redirect/snapshot via `public_token`.
- `app/api/admin/orders/[orderNumber]/route.ts` — explicit columns (all
  except `public_token`), generic errors + `request_id`.
- `app/api/admin/**` sweep — Origin checks on POST/PATCH/DELETE; `request_id`
  on 5xx; `lib/audit.ts` wiring (status/payment/dispatch, product
  create/update/delete).
- `lib/rate-limit.ts` — deleted (all three importers repointed first).

### Phase 5 touchpoint (same deploy)
- `app/api/admin/products/route.ts` POST: `sharp(buffer).rotate()
  .webp({quality:82}).toBuffer()` per file; path `products/{batchUuid}/{fileUuid}.webp`;
  `{contentType:'image/webp', cacheControl:'31536000'}`; encode failure joins
  the existing `rejected[]` flow. Keep 4 MB combined (Vercel cap).
- `package.json`: `sharp` added.

### Phase 6 touchpoint (same deploy)
- `next.config.ts`: `script-src`/`frame-src` +=
  `https://challenges.cloudflare.com`; `frame-ancestors 'none'`;
  `X-Frame-Options: DENY`; `X-Robots-Tag: noindex` for `/admin*` and
  `/api/admin*` (via a second `headers()` entry).
- Server modules switch `console.*` → `lib/log.ts`; `lib/email.ts` redacted.
- `.env.example` += `NEXT_PUBLIC_TURNSTILE_SITE_KEY`,
  `TURNSTILE_SECRET_KEY`.
- `scripts/check-admin-guard.ts` must keep working (no `server-only` in
  `supabase-server.ts`).

## Deploy order
1. `sharp` installed; env vars set in `.env.local` + Vercel (test keys) **before**
   the code deploy (`NEXT_PUBLIC_*` is build-time).
2. Local build + dev-server tests → attack suite (local) → subagent code
   review of the diff → fix → commit → push (prod deploy) → prod subset of
   the suite + headers + build-grep.
