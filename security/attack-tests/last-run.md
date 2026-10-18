# Attack test run — suite=local base=http://127.0.0.1:3210

Ran: 39 · Passed: 39 · Failed: 0 · Skipped: 0

| # | Check | Result | Observed |
|---|-------|--------|----------|
| 1 | CSP + security headers on / | PASS | all header checks ok |
| 2 | X-Robots-Tag noindex on /admin/login | PASS | status=200 x-robots-tag=noindex, nofollow |
| 3 | Unauth /api/admin/orders → 401 + noindex | PASS | status=401 x-robots-tag=noindex, nofollow |
| 4 | Order page: noindex, token not in title | PASS | status=200 title="Order Confirmed \| thriv" noindex=true |
| 5 | Old /order/<THR-> and /api/orders/<THR-> → 404 | PASS | page=404 api=404 |
| 6 | Checkout: cross-origin POST → 403 | PASS | status=403 |
| 7 | Checkout: malformed + oversized bodies → 400 | PASS | malformed=400 oversized=400 json-parsed=409:true raw=400 |
| 8 | Checkout: honeypot → 400, no order | PASS | status=400 body={"error":"Could not process this request. Please reload the page and try again."} |
| 9 | Checkout: missing / empty Turnstile token → 400 | PASS | missing=400 empty=400 |
| 10 | Checkout: 21 items → 400 (cap 20) | PASS | status=400 |
| 11 | Checkout: quantity 41 → 400 (cap 40) | PASS | status=400 |
| 12 | Checkout: unknown field rejected (strict) | PASS | status=400 |
| 13 | Checkout: invalid province → 400 | PASS | status=400 |
| 14 | Checkout: invalid email + phone → 400 | PASS | email=400 phone=400 |
| 15 | Checkout: happy path → 201 + public_token (UUID) | PASS | status=201 keys=order_number,public_token,total_pkr,idempotent,email_enabled |
| 16 | Checkout: per-IP burst → 429 with Retry-After | PASS | statuses=409,409,409,409,409,409,429 retry-after=600 |
| 17 | Checkout: idempotent replay leaks no token | PASS | status=201 idempotent=true tokenLeak=false |
| 18 | Lookup: non-UUID token → 404 | PASS | status=404 |
| 19 | Lookup: unknown UUID → 404 | PASS | status=404 |
| 20 | Lookup: real token → 200, no PII, no-store | PASS | status=200 piiKeys=none phoneLeak=false emailLeak=false no-store=true |
| 21 | Lookup: rate limit 30/600 per IP | PASS | 429 after 31 requests |
| 22 | Admin login: cross-origin → 403 | PASS | status=403 |
| 23 | Admin login: honeypot → 400 | PASS | status=400 |
| 24 | Admin login: wrong password → 401, no cookie, no token | PASS | status=401 adminCookie=false tokenLeak=false |
| 25 | Admin login: correct password → 401 mfa_required + httpOnly ticket | PASS | status=401 mfaRequired=true ticketSet=true httpOnly=true secure=true |
| 26 | MFA verify: no ticket → 401 MFA_EXPIRED | PASS | status=401 code=MFA_EXPIRED |
| 27 | MFA verify: non-numeric code → 400 | PASS | status=400 |
| 28 | MFA verify: wrong code → 401 MFA_INVALID, no admin cookie | PASS | status=401 code=MFA_INVALID adminCookie=false |
| 29 | MFA verify: correct TOTP → 200 + httpOnly admin cookie | PASS | status=200 adminCookie=true httpOnly=true ticketCleared=true |
| 30 | Admin API: valid cookie → 200; no cookie → 401 | PASS | authed=200 anon=401 |
| 31 | Admin order detail: 200 and NO public_token in body | PASS | status=200 orderMatch=true publicTokenLeak=false |
| 32 | Forged / aal1 / non-admin Bearer tokens → 401 | PASS | garbage=401 aal1-admin=401 nonAdminUser=401 |
| 33 | Admin status PATCH: cross-origin → 403 | PASS | status=403 |
| 34 | Admin status PATCH: cancel test order → 200 | PASS | status=200 newStatus=cancelled |
| 35 | Admin products POST: unauth → 401; cross-origin → 403 | PASS | unauth=401 cross-origin=403 |
| 36 | Admin products POST: fake image rejected (magic bytes) | PASS | status=400 code=INVALID_UPLOADS err=Some photos were rejected: evil.jpg (not a real image file). |
| 37 | MFA uid limit: repeated wrong codes → 429 MFA_LOCKED | PASS | 401:MFA_INVALID,401:MFA_INVALID,401:MFA_INVALID,401:MFA_INVALID,429:MFA_LOCKED |
| 38 | Login failure throttle: 5 failures lock even a correct password | PASS | 401,401,401,401,401,429:TOO_MANY_ATTEMPTS |
| 39 | GoTrue refuses a 2nd factor for an aal1 session with an existing factor | PASS | enroll-with-existing-factor rejected: status=403 |