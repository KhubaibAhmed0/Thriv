# Attack test run — suite=prod base=https://thriv-five.vercel.app

Ran: 6 · Passed: 6 · Failed: 0 · Skipped: 33

| # | Check | Result | Observed |
|---|-------|--------|----------|
| 1 | CSP + security headers on / | PASS | all header checks ok |
| 2 | X-Robots-Tag noindex on /admin/login | PASS | status=200 x-robots-tag=noindex, nofollow |
| 3 | Unauth /api/admin/orders → 401 + noindex | PASS | status=401 x-robots-tag=noindex, nofollow |
| 4 | Order page: noindex, token not in title | PASS | status=200 title="Order Confirmed \| thriv" noindex=true |
| 5 | Old /order/<THR-> and /api/orders/<THR-> → 404 | PASS | page=404 api=404 |
| 6 | Checkout: cross-origin POST → 403 | SKIP | skipped (prod subset) |
| 7 | Checkout: malformed + oversized bodies → 400 | SKIP | skipped (prod subset) |
| 8 | Checkout: honeypot → 400, no order | SKIP | skipped (prod subset) |
| 9 | Checkout: missing / empty Turnstile token → 400 | SKIP | skipped (prod subset) |
| 10 | Checkout: 21 items → 400 (cap 20) | SKIP | skipped (prod subset) |
| 11 | Checkout: quantity 41 → 400 (cap 40) | SKIP | skipped (prod subset) |
| 12 | Checkout: unknown field rejected (strict) | SKIP | skipped (prod subset) |
| 13 | Checkout: invalid province → 400 | SKIP | skipped (prod subset) |
| 14 | Checkout: invalid email + phone → 400 | SKIP | skipped (prod subset) |
| 15 | Checkout: happy path → 201 + public_token (UUID) | SKIP | skipped (prod subset) |
| 16 | Checkout: per-IP burst → 429 with Retry-After | SKIP | skipped (prod subset) |
| 17 | Checkout: idempotent replay leaks no token | SKIP | skipped (prod subset) |
| 18 | Lookup: non-UUID token → 404 | PASS | status=404 |
| 19 | Lookup: unknown UUID → 404 | SKIP | skipped (prod subset) |
| 20 | Lookup: real token → 200, no PII, no-store | SKIP | skipped (prod subset) |
| 21 | Lookup: rate limit 30/600 per IP | SKIP | skipped (prod subset) |
| 22 | Admin login: cross-origin → 403 | SKIP | skipped (prod subset) |
| 23 | Admin login: honeypot → 400 | SKIP | skipped (prod subset) |
| 24 | Admin login: wrong password → 401, no cookie, no token | SKIP | skipped (prod subset) |
| 25 | Admin login: correct password → 401 mfa_required + httpOnly ticket | SKIP | skipped (prod subset) |
| 26 | MFA verify: no ticket → 401 MFA_EXPIRED | SKIP | skipped (prod subset) |
| 27 | MFA verify: non-numeric code → 400 | SKIP | skipped (prod subset) |
| 28 | MFA verify: wrong code → 401 MFA_INVALID, no admin cookie | SKIP | skipped (prod subset) |
| 29 | MFA verify: correct TOTP → 200 + httpOnly admin cookie | SKIP | skipped (prod subset) |
| 30 | Admin API: valid cookie → 200; no cookie → 401 | SKIP | skipped (prod subset) |
| 31 | Admin order detail: 200 and NO public_token in body | SKIP | skipped (prod subset) |
| 32 | Forged / aal1 / non-admin Bearer tokens → 401 | SKIP | skipped (prod subset) |
| 33 | Admin status PATCH: cross-origin → 403 | SKIP | skipped (prod subset) |
| 34 | Admin status PATCH: cancel test order → 200 | SKIP | skipped (prod subset) |
| 35 | Admin products POST: unauth → 401; cross-origin → 403 | SKIP | skipped (prod subset) |
| 36 | Admin products POST: fake image rejected (magic bytes) | SKIP | skipped (prod subset) |
| 37 | MFA uid limit: repeated wrong codes → 429 MFA_LOCKED | SKIP | skipped (prod subset) |
| 38 | Login failure throttle: 5 failures lock even a correct password | SKIP | skipped (prod subset) |
| 39 | GoTrue refuses a 2nd factor for an aal1 session with an existing factor | SKIP | skipped (prod subset) |