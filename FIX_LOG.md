# Thriv — Security & Quality Fix Log

Automated remediation of `AUDIT_REPORT.md` (86 findings — 7 P0 / 33 P1 / 41 P2 / 5 P3).
Each batch ships independently: branch → Vercel preview → probes → merge to `main` → production probe.

- **Run date:** 2026-10-17
- **Baseline:** `main` @ `37ef0ed`
- **Production:** `https://thriv-five.vercel.app`
- **Secrets policy:** tokens and DB credentials live only in `~/.config/thriv/` outside the repo, are never printed, and are revoked at the end of the job. The rotated admin password is **not** in this repo or this log.
- **DB access:** PostgreSQL 17.6 (Supabase `Thriv`, `ap-southeast-1`) via the session pooler. There is no `supabase_migrations` history table (schema was applied manually historically), so SQL changes are applied with `psycopg` and documented per batch. Full pre-fix backup taken before any data-touching batch.

---

## Batch B1 — Auth & security guards

**Findings closed:** F-01 (P0), F-02 (P0), F-03 (P0), F-08 (P1), F-42 (P2), F-43 (P2)
**Branch:** `fix/b1-security-guards`

### What was wrong

| Finding | Problem |
| :--- | :--- |
| F-01 | `lib/admin-auth.ts` authorized *any* token (even garbage) whenever the public Supabase env vars were unset — a fail-open dev-admin fallback. Live 401s today were luck (env is set in prod), not safety. |
| F-02 | Admin password `thriv2026` was committed in `PROJECT_HANDOVER.md` (and echoed in dead component placeholders). |
| F-03 | `supabase/schema.sql` installed permissive `USING (true)` RLS on `orders` — and the handover told operators to run it on a fresh DB. Live DB was safe, file was a landmine. |
| F-08 | Login + API guard skipped the `admins` membership check when the service key was absent — any Supabase-auth user would have received an admin cookie. |
| F-42 | `GET /api/admin/auth/me` echoed the raw Supabase access token into JS (XSS/exfil surface). The admin orders UI consumed it for Realtime. |
| F-43 | `middleware.ts` (deprecated in Next 16) duplicated its own fail-open env logic and page-gated `/admin/*` while `/api/admin/*` self-guarded with *different* code. |

### Changes

- **New `lib/supabase-env.ts`** — single source of truth for Supabase env config (public + service), with URL normalization and placeholder guards (`.env.example` values like `<anon_key>` or `your-project` count as **missing**, closing F-24 as a side effect).
- **`lib/admin-auth.ts`** — rewritten: `verifyAdminToken()` fails closed on missing env, missing service key, invalid token, or non-admin user. No dev-admin fallback. Shared by API routes (`verifyAdminRequest`) and the page guard.
- **`app/api/admin/auth/login/route.ts`** — uses the shared env helper; `admins`-table membership check is now **mandatory** (503 when server verification is unconfigured — no cookie is issued); proper 500 on DB errors, 403 for non-admins.
- **`app/api/admin/auth/me/route.ts`** — uses the shared guard; returns `{ authenticated, user: { id, email } }` only. The raw access token is no longer returned (F-42).
- **`components/admin/AdminOrdersListClient.tsx`** — Realtime subscription (which required the token echo) replaced with 30-second polling; new-order toast and badge behaviour preserved; `@supabase/supabase-js` no longer shipped to the admin UI.
- **`proxy.ts`** (new) + **`middleware.ts` deleted** — Next 16 `proxy` migration (F-43). Same shared fail-closed guard as the API routes; unconfigured env now redirects `/admin/*` to `/admin/login` instead of allowing pages.
- **Deleted `supabase/schema.sql`** (F-03) + **new `supabase/README.md`** warning that `supabase/migrations/` is authoritative and legacy permissive SQL must never be re-added.
- **Deleted `components/AdminDashboardClient.tsx`** (unreachable dead code — last place the `thriv2026` string lived, F-02 residue) and the now-orphaned **`lib/supabase.ts`**.
- **`PROJECT_HANDOVER.md`** — password removed; schema.sql instructions replaced with migrations-as-authoritative; admin-auth rules added.
- **`scripts/check-admin-guard.ts`** (new) — dependency-free assertion suite for the env helper and the guard's deny paths.
- **`.gitignore`** — `supabase/.temp/`, `graphify-out/`.

### Operational actions taken (before this commit)

- **F-02:** production admin password rotated via the Supabase Auth admin API and verified with a live login on `thriv-five.vercel.app`; the old `thriv2026` no longer authenticates. New credential is stored with the owner (and in the operator's local credential file, not the repo).
- **F-08 (config):** signups disabled on the Supabase project (`disable_signup = true`) — single-owner store, no customer accounts exist.
- Full pre-fix DB backup (all 5 tables + schema + functions) stored outside the repo.

### Verification (local — this commit)

| Check | Result |
| :--- | :--- |
| `npx tsx scripts/check-admin-guard.ts` | ✅ 8 assertion groups: env parse/normalize/placeholder rejection + guard denies on missing service key, forged token, empty/blank/missing tokens |
| `npx tsc --noEmit` | ✅ clean |
| `npx eslint .` | 70 → 59 problems (all remaining pre-existing; touched files add no new problems) |
| `npm run build` | ✅ 51 routes; `proxy.ts` registered (“ƒ Proxy (Middleware)”) |
| Local prod server, **no Supabase env** (the F-01 scenario) | `/` + `/shop` 200 · `/admin` → 307 `/admin/login` (plain and with forged cookie) · `/admin/login` 200 · `GET /api/admin/orders` **401** (plain and forged cookie) · `GET /api/admin/auth/me` **401** · `POST /api/admin/auth/login` **503** |
| Local prod server, public env fake + **no service key** (the F-08 scenario) | `/` 200 · `/api/admin/orders` + `/me` **401** with forged token · `/admin` 307 |

### Deploy verification (2026-10-17)

**Preview** — branch `fix/b1-security-guards` deployed READY at commit `ca44f2d` (and again on the follow-up commit). Note: preview deployments on this Vercel project are behind **Vercel Authentication** (unauthenticated requests get `302 → vercel.com/sso-api`), so previews verify build/deploy mechanics; functional verification runs via the local real-backend battery below and then on production.

**Local battery against the real Supabase backend** (production build, real env, rotated credentials; all requests via `curl.exe` — 11/11):

| # | Check | Result |
| :- | :--- | :--- |
| 1 | `POST /api/admin/auth/login` (real creds) | 200, cookie set |
| 2 | `GET /api/admin/auth/me` (cookie) | 200; `authenticated: true`; **no `token` field in payload** |
| 3 | `GET /api/admin/auth/me` (Bearer) | 200 |
| 4 | `GET /api/admin/orders` (cookie) | 200, 2 orders |
| 5 | `GET /admin` (cookie) | 200 |
| 6 | `GET /admin/products` (cookie) | 200 |
| 7 | `GET /api/admin/orders` (forged cookie) | 401 |
| 8 | `GET /api/admin/auth/me` (forged Bearer) | 401 |
| 9 | `GET /admin` (forged cookie) | 307 → `/admin/login` |
| 10 | `POST login` wrong password | 401 |
| 11 | `POST /api/admin/auth/logout` | 200 |

**Production** (`thriv-five.vercel.app`, merge commit `b166a18`) — same battery, 13/13 checks pass: homepage + shop 200 · login 200 · `/me` 200 without token echo · Bearer 200 · orders 200 (2 orders intact) · `/admin` + `/admin/products` 200 · forged cookie/Bearer 401 · forged `/admin` 307 → login · wrong password 401 · logout 200.

Operational notes:
- PowerShell 5.1 `Invoke-WebRequest` cannot reliably send manual `Cookie` headers (restricted-header handling) — all live probes were run with `curl.exe`. Use curl for future flow checks.
- Guard failures are now logged with reasons (`[admin-auth] token rejected by Supabase Auth: …`) — this made the auth path observable during verification.
- `/api/admin/auth/me` early-exit now honours the Bearer header as well as the cookie, consistent with `verifyAdminRequest`.

---

## Batch B2 — Data integrity

**Findings closed:** F-04 (P0), F-11 (P1), F-12 (P1), F-54 (P2)
**Branch:** `fix/b2-data-integrity`

### What was wrong

| Finding | Problem |
| :--- | :--- |
| F-04 | Every status change (including shipped/delivered) ran `stock = 0` on each order line — one "Mark Shipped" click permanently sold out merch whose stock had already been decremented at checkout, and there was no edit screen to fix it. |
| F-11 | The 1-of-1 thrift rule existed only in UI code; the DB had no constraint and `PATCH /products/:id` accepted any stock (a thrift piece could be set to 50). |
| F-12 | No transition guards anywhere: delivered → cancelled restored stock for goods the customer had; cancelled → shipped re-zeroed; repeated cancels re-restored; `delivered_at` was never cleared; `order_events` recorded nonsensical paths. |
| F-54 | `place_order` validated each JSON line independently: `[{slug, 1}, {slug, 1}]` against stock 1 passed the check and died on `CHECK (stock >= 0)` as an opaque 500 — a legitimate 2-size merch cart triggered it. |

### Changes

- **New `supabase/migrations/20261017_b2_data_integrity.sql`** (applied to the live DB — see below):
  - `place_order()` v2 — per-slug aggregation: locks each distinct slug once (`FOR UPDATE`), sums quantities per slug for validation, subtotal and decrement; the item snapshot stays per line (sizes can differ).
  - `update_order_status(p_order_number, p_new_status, p_note, p_actor)` — **the only writer of order status**. Locks the order row; forward-only state machine with skips allowed (`new → confirmed|shipped|delivered|cancelled`, `confirmed → shipped|delivered|cancelled`, `shipped → delivered|cancelled`; delivered/cancelled terminal); same-status is a no-op; sets/clears `delivered_at`; on cancel restores stock exactly once (merch `+qty` aggregated per product, thrift back to 1) and writes the `order_events` row — all atomic. Raises `P0001` (invalid transition / unknown status) and `P0002` (order not found).
  - `products_thrift_one_of_one` CHECK (`is_merch OR stock <= 1`), added idempotently.
- **`app/api/admin/orders/[orderNumber]/status/route.ts`** — rewritten: all stock-writing code removed (F-04); status changes call the RPC, mapping `P0001 → 409`, `P0002 → 404`; payment status stays independent of fulfillment state.
- **`app/api/admin/products/[id]/route.ts`** (PATCH) and **`app/api/admin/products/route.ts`** (create) — stock validated: integer ≥ 0, thrift ≤ 1, empty updates rejected (F-11).
- **`components/admin/OrderDetailClient.tsx`** — fulfillment buttons mirror the state machine (Confirm only from new; Mark Shipped from new/confirmed; Cancel until delivered; delivered/cancelled show a terminal note) (F-12).
- **`supabase/README.md`** — migration list updated.

### Operational actions taken

- Migration applied to the live DB via `psycopg` after a full test pass inside a rolled-back transaction (no `supabase_migrations` history table — see header note). Live objects verified after apply: constraint present, `update_order_status` present, `place_order` is v2 (`GROUP BY 1` marker), 2 real orders and all stock counters untouched.

### Verification

| Check | Result |
| :--- | :--- |
| Transactional DB battery (fixture orders, rolled back) | ✅ 24/24: every transition edge (skip-forward allowed; delivered → cancelled/shipped and cancelled → confirmed rejected; no-ops silent), cancel restore exactness (merch +2 → 7, thrift → 1, single event row), constraint blocks thrift stock=2, F-54 duplicate-thrift-line attack blocked (`Only 1 remaining`), duplicate merch lines aggregate + decrement exactly once (2 snapshot lines), idempotent repeat creates nothing, negative quantity rejected; **rollback confirmed zero data/schema leaked** |
| `npx tsc --noEmit` | ✅ clean |
| `npm run build` | ✅ |
| `npx tsx scripts/check-admin-guard.ts` | ✅ all assertions pass |
| `npx eslint .` | 59 → 57 problems (all remaining pre-existing) |
| Local prod build + real backend HTTP battery | ✅ 8/8: login 200; delivered → shipped **409** (no change); unknown order **404**; same-status no-op **200**; thrift `stock=2` **400**; non-numeric stock **400**; orders list 200 (2 orders); live data verified untouched (statuses and stock counters) |
| Create-route probe (`POST` thrift, stock=5) | ✅ route now rejects with clean **400**; the pre-route build was stopped by the DB constraint (23514) without creating a row — both layers verified, products total unchanged (32) |

### Deploy verification (2026-10-17)

**Preview** — branch `fix/b2-data-integrity` deployed READY (previews on this project are behind Vercel Authentication, so mechanics only).

**Production** — branch commit `8dbbfbc`, merge commit `3be7b8c`, deployment READY. Same battery against `thriv-five.vercel.app`: **8/8 pass** — `delivered → shipped` rejected **409** with `Invalid status transition: delivered -> shipped`; unknown order **404**; same-status no-op **200**; thrift `stock=2` rejected **400** (`One-of-one thrift pieces can only have stock 0 or 1.`); non-numeric stock **400**; orders list 200 with both real orders intact (`THR-00001` delivered, `THR-00002` new) and stock counters unchanged.

---

## Batch B3 — Purchase path

**Findings closed:** F-05 (P0), F-07 (P0), F-09 (P1), F-13 (P1), F-14 (P1), F-17 (P1), F-18 (P1), F-19 (P1), F-20 (P1), F-28 (P1), F-29 (P1), F-58 (P2), plus F-48 (P2, closed early from B6)
**Branch:** `fix/b3-purchase-path`

### What was wrong

| Finding | Problem |
| :--- | :--- |
| F-05 | If the DB key was missing/unhealthy, checkout still returned 201 with a fake `THR-LOCAL-*` order — "Order Placed Successfully" with no row, no stock change, and a customer possibly sending a bank transfer for a nonexistent order. |
| F-07 | `/checkout`'s empty-cart redirect fired before the localStorage cart hydrated — any hard refresh or deep link bounced the customer to `/cart` and lost the form. |
| F-09 | `POST /api/orders` had no rate limit (inventory-depletion + replay abuse) and a replayed idempotent request re-sent the confirmation email. |
| F-13 | A static seed silently shadowed an empty/broken DB: the server fell back to seed data and the shop UI ignored empty API responses. |
| F-14 | `isServiceConfigured()` accepted placeholder/whitespace values → checkout attempted the RPC against garbage and 500'd instead of failing cleanly. |
| F-17 | Product pages were build-time SSG snapshots — price/stock/hide changes never reached them until a redeploy. |
| F-18 | `getProductBySlug` had no `is_active` filter — hidden products stayed viewable and add-to-cart-able until checkout 409'd. |
| F-19 | The confirmation email was awaited with no timeout; a stalled email turned a retry into a second order. |
| F-20 | Merch quick-add hardcoded size `L` and `place_order` never validated `selected_size` against `products.sizes`. |
| F-28 | Checkout errors had no `aria-invalid`/`aria-describedby`/`role=alert`, no focus management, and the error banner sat below a 7-field form. |
| F-29 | The WhatsApp field rejected spaced/dashed formats people actually type; client and API validators were duplicated and could drift. |
| F-58 | The confirmation page read `localStorage` only (bare page cross-device), mixed client snapshot lines with server totals, and kept PII indefinitely. |

### Changes

- **New `supabase/migrations/20261017_b3_place_order_v3.sql`** (applied to the live DB — see below): `place_order` v3 = v2 + per-line `selected_size` validation against `products.sizes` (`RAISE P0001: Please select a valid size for <product> (available: …)`); a NULL size is rejected when the product declares sizes; products without a sizes list are unaffected (legacy thrift rows still accept NULL). B2 behaviour (per-slug lock/aggregation, idempotency) unchanged.
- **`app/api/orders/route.ts`** — rewritten: per-IP rate limit (6 / 10 min) with `429` + `Retry-After` (F-09); unconfigured/placeholder DB or transport failure → `503 { code: 'CHECKOUT_UNAVAILABLE' }` and the form offers a WhatsApp fallback — never a fake success (F-05/F-14); RPC errors mapped to `409` ("sold out", "valid size", "Product not found", …), else `500`; email only when `!result.idempotent`, fire-and-forget with a 5 s `AbortSignal.timeout` (F-09/F-19); Zod caps — 25 items, slug ≤ 120, size ≤ 20 (F-48).
- **New `lib/rate-limit.ts`** — in-memory per-instance fixed-window limiter. Documented limitation: per-lambda, warm-instance only; move to an edge/KV store when traffic warrants. **New `lib/validation.ts`** — shared `PROVINCES` + Pakistani phone normalization (accepts `+92`/`0092`/`0` with spaces or dashes → `0XXXXXXXXXX`) used by both client and API (F-29).
- **New `app/api/orders/[orderNumber]/route.ts`** — public order lookup: number/status/payment/totals/created_at/items only, **no PII**; `THR-…` shape gate, 30/10 min rate limit, `503` when unconfigured (F-58).
- **`components/CheckoutForm.tsx`** — hydration gate before the empty-cart redirect (F-07); idempotency key persisted in `sessionStorage` across refreshes/retries, removed on success; snapshot gains `savedAt`; per-field `aria-invalid`/`aria-describedby` + `role="alert"` summary above the form + focus first invalid + validate-on-blur (F-28); phone normalized on blur with `inputMode="tel"` (F-29); `503` swaps the CTA to "Order on WhatsApp instead".
- **`lib/products-db.ts`** — DB-as-truth: when configured, the DB is the only source (empty/error → `[]` + `console.error`, never silent seed fallback); `getProductBySlug` filters `is_active` (F-13/F-18). Legacy hidden-slug filter kept until B4/F-15.
- **`app/product/[slug]/page.tsx`** — `generateStaticParams` removed, `dynamic = 'force-dynamic'`, related items from the live catalogue (F-17/F-18).
- **Quick-add sizing (F-20)** — new `lib/useQuickAdd.ts`: multi-size merch opens an inline size picker instead of hardcoding `L`; `components/ProductCard.tsx` + `components/ShopTheLook.tsx` use it (ShopTheLook row extracted so each row owns its picker state); cart page gains size-change chips via a new `CHANGE_SIZE` action (`lib/cart.ts`, `types/index.ts`), `CartProvider` exposes `changeSize` + `isHydrated`.
- **`components/OrderConfirmationClient.tsx`** — renders from the server lookup (authoritative items/money/payment), snapshot used only for PII display with a 24 h TTL (F-58).
- **`components/ShopCatalog.tsx` + `components/BrowseShopSection.tsx`** — accept empty API results (no stale-seed masking) (F-13).
- **`supabase/README.md`** — migration #5 documented.

### Operational actions taken

- Migration applied to the live DB via `psycopg` after a full test pass inside a rolled-back transaction (no `supabase_migrations` history table — see header note). Live objects verified after apply: `place_order` is v3 (size-validation marker), B2 markers (`GROUP BY 1` aggregation, `products_thrift_one_of_one`, `update_order_status`) intact, 2 real orders and stock counters untouched.

### Verification

| Check | Result |
| :--- | :--- |
| Transactional DB battery (fixtures, rolled back, then live apply) | ✅ 16/16: invalid size rejected `P0001` + **no order row persisted**; missing size rejected; valid size accepted (stock 2 → 1, snapshot keeps size); duplicate sized lines aggregate (stock 3 → 1, 2 snapshot lines, total Rs 3,398); thrift without sizes accepts NULL; B2 regression checks; **rollback zero leak**; live markers + counts unchanged |
| `npx tsc --noEmit` | ✅ clean |
| `npm run build` | ✅ (`/product/[slug]` now `ƒ` dynamic) |
| `npx tsx scripts/check-admin-guard.ts` | ✅ all assertions pass |
| `npx eslint .` | 57 → 52 problems (all remaining pre-existing) |
| Local prod build + real backend HTTP battery | ✅ 12/12: lookup `THR-00001` 200 with items and **no PII**, unknown/malformed 404, PDP rendered from live DB, invalid size 409 with available-sizes message, unknown slug 409, `0092` phone accepted (normalized), garbage phone 400, 26-item cart 400, repeated attempts 429, catalogue 200 (31 items) |
| Browser checks (real Chromium against the local prod build) | ✅ checkout deep-link with a hydrated cart **stays on `/checkout`** with form + items + size (F-07); shop quick-add opens the S/M/L/XL picker, cart stays empty until a size is picked, choosing M lands in the cart; cart page size chips flip M → L and persist (F-20) |

### Deploy verification (2026-10-17)

**Preview** — branch commit `d1dd3f0` deployed READY (`thriv-h37hztcs2-…vercel.app`); previews on this project are behind Vercel Authentication, so mechanics only.

**Production** — merge commit `b41d977`, deployment READY (`thriv-ltnd2sxby-…vercel.app`). Same battery against `thriv-five.vercel.app` (rate-limit case skipped so the operator IP stays usable): **12/12 pass** — order lookup 200 (1 line, no PII), unknown/malformed 404, PDP 200 from the live DB, invalid size **409** with `available: S, M, L, XL`, unknown slug 409, `0092`-format phone accepted, garbage phone 400, 26-item cart 400, catalogue 200 (31 items).

> Note: the `d1dd3f0` commit message labels the email-timeout change as F-53; per the audit report that behaviour is **F-19**. F-53 (admin upload gate) remains open in B6.

---

## Batch B4 — Dead-code / data-truth cleanup

**Findings closed:** F-10 (P1), F-15 (P1), F-16 (P1), F-21 (P1 — code deleted in B1, references verified), F-59 (P2), F-60 (P2), F-62 (P2), F-65 (P2), F-84 (P3), F-85 (P3)
**Also in this batch's report scope:** F-61 (closed in B3), F-64 (closed in B3), F-63 (resolves with F-27 in B5 — removing `/styleguide` removes the last `components/ui/*` consumer besides `Badge`)
**Branch:** `fix/b4-dead-code-data-truth`

### What was wrong

| Finding | Problem |
| :--- | :--- |
| F-10 | The admin add-product form always collected `subcategory` and `is_featured`, but the `products` table had neither column — the API parsed `subcategory` then ignored it, `is_featured` was never read. Subcategory filters and the "Featured Drop" badge were dead for every DB product. |
| F-15 | The removed `bershka-washed-black-balloon-jeans` row was still seeded active; the app compensated with a hardcoded slug filter in `lib/products-db.ts` (applied in two places), and the row 404'd everywhere except its own phantom listing. |
| F-16 | Every seeded image path (`/products/<slug>-N.jpg`) pointed at a file that never existed, and admin referenced a missing `/placeholder.png` — the storefront silently rendered broken images. |
| F-21 | Dead `AdminDashboardClient` (hardcoded-password gate, dead `x-admin-key` bypass, mock PII) + legacy `lib/supabase.ts` writer — deleted in B1; B4 verified no references remain. |
| F-59 | Documentation drift: one handover revision kept describing the old fallback checkout and old status names; `README.md` listed the removed Shop-The-Look section and the orphaned `/styleguide`; seed-file counts were wrong. |
| F-60 | `PAYMENT_LABELS` lived in 4 copies and `STATUS_CONFIG` in 2 — every copy/style change had to be repeated 4–6 times. |
| F-62 | The Rs 200 delivery fee exists in both TS (`lib/cart.ts`) and the SQL RPC with no cross-reference — money-facing drift risk. |
| F-65 | `lint` was a bare `eslint` (no target) and nothing ran it; the repo sat at 52 problems, including 5 real `rules-of-hooks` violations in `Header.tsx`. |
| F-84 | Dead sign-out handler + `LogOut` import, 25 unused vars/imports, 4 dead `data/products.ts` exports, 5 scaffold SVGs, stale header counts. |
| F-85 | Inert `vercel.json cleanUrls`, ternary-as-statement in `HeroCarousel`, stale `OrderStatus` union (`'pending'` never existed; `'new'`/`'cancelled'` missing). `.gitignore` fixed in B1; tsconfig SUSPECTED sub-items intentionally left as-is (documented). |

### Changes

- **New `supabase/migrations/20261017_b4_data_truth.sql`** (applied live — see below): adds `subcategory TEXT` + `is_featured BOOLEAN NOT NULL DEFAULT false`; backfills 31 subcategories + 3 featured flags from the static catalogue (gap-fill only, never clobbers manual values); hides the phantom balloon row via `is_active = false`; strips every fabricated `/products/*` path (`images = '{}'`); carries the F-62 runbook note. Idempotent — safe to re-run.
- **`lib/products-db.ts`** — `LEGACY_HIDDEN_SLUG` and both hardcoded filters deleted (visibility = `is_active`, one mechanism); `mapRow` no longer fabricates a subcategory (F-10/F-15).
- **`app/api/admin/products/route.ts` + `[id]/route.ts`** — POST inserts `subcategory`/`is_featured`; PATCH whitelist accepts both; `any` catches replaced by the new shared `lib/errors.ts` helper (F-10/F-65).
- **`components/ProductImage.tsx`** — never guesses an image path; without a URL it renders an explicit "Photo coming soon" tile (brand + subcategory + notice); unused `imageIndex` prop removed (F-16).
- **`components/admin/AdminProductsListClient.tsx`** — `/placeholder.png` references replaced with the existing Package-icon fallback (F-16).
- **`data/products.ts`** — 31 fake `images` arrays → `[]`; 4 dead query exports removed; header counts corrected (27 jeans / 4 tees) (F-16/F-84).
- **New `lib/orderLabels.ts`** — single source for customer payment labels, admin short/long variants (`paymentLabel()`), `ENUM_TO_CLIENT`, and `STATUS_CONFIG`; the 6 duplicate copies removed from the order components (F-60).
- **`lib/cart.ts`** — cross-reference comment tying `FLAT_DELIVERY_FEE` to `v_delivery_fee` in SQL and the B4 migration note (F-62).
- **F-65** — `"lint": "eslint ."` + `"typecheck": "tsc --noEmit"`; new `.github/workflows/ci.yml` (node 22, `npm ci`, typecheck + lint + build, all blocking); **lint burned down 52 → 0 problems** (Header hooks fix, typed error paths, unused-var removal, effect lint restructured or explicitly disclosed where the rule can't see the await boundary).
- **`types/index.ts`** — `OrderStatus` = `'new' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'` (F-85).
- **`vercel.json`** — `cleanUrls` removed; **`components/HeroCarousel.tsx`** — ternary-as-statement → if/else (F-85).
- **Docs (F-59)** — README (homepage sections, PDP rendering note, `/styleguide` removed) and PROJECT_HANDOVER (DB-required checkout, real status names, file tree, migration list, product counts).
- **Deleted** — 5 scaffold SVGs (F-84). The historical no-op `EXCEPTION` block in `20260920_place_order_rpc.sql` is intentionally left in place: that file is superseded by the B2/B3 migrations, and rewriting applied history is riskier than leaving dead text (noted in the audit as acceptable).

### Operational actions taken

- Migration applied to the live DB via `psycopg` after a full test pass inside a rolled-back transaction. Post-apply state verified: columns present, 31 subcategories + 3 featured flags backfilled, balloon row inactive, 0 fabricated image paths, product (32) and order (2) row counts unchanged.

### Verification

| Check | Result |
| :--- | :--- |
| Transactional DB battery (rolled back, then live apply) | ✅ 28/28: columns exist; 31 subcategories backfilled; 3 featured; balloon hidden and the visible catalogue still 31; 0 fabricated image paths; counts unchanged; B2/B3 markers intact; `place_order` still rejects an invalid size (`P0001`); rollback zero-leak |
| `npx tsc --noEmit` | ✅ clean |
| `npx eslint .` | ✅ **0 problems** (was 52) |
| `npm run build` | ✅ clean |
| Local HTTP battery (real backend) | ✅ B3 regression 12/12 (lookup no-PII, 404s, PDP from DB, size/slug 409s, phone formats, cart cap, catalogue 31) |
| Local admin API test | ✅ 11/11: unauthenticated PATCH 401; `is_featured` PATCH round-trip (write + revert); `subcategory` PATCH round-trip (write + revert to NULL); POST create persists both fields; throwaway row deleted by the test |
| Local storefront truth probes | ✅ PDP renders "Photo coming soon" and zero `/products/*.jpg` references; API 31 items / 0 images / 7 subcategories / 3 featured; hidden slug 404 |
| Browser (local Chromium) | ✅ shop: 31 visible placeholder tiles, 0 console errors; PDP: 4 tiles, 0 console errors |

### Deploy verification (2026-10-17)

**Preview** — branch commit `45b7d6e` deployed READY (`thriv-m4fuqgv41-…vercel.app`); previews on this project are behind Vercel Authentication, so mechanics only.

**Production** — merge commit `fb991bf`, deployment READY (`thriv-jeno66a0o-…vercel.app`). Against `thriv-five.vercel.app`:
- B3 regression battery: **12/12** (rate-limit case skipped so the operator IP stays usable).
- Admin API: **11/11** (login, unauth 401, PATCH round-trips, POST persistence, DB cleanup).
- Storefront probes: PDP 200 with "Photo coming soon" + no fake paths; API 31 items / 0 images / 3 featured / 7 subcategories; hidden slug **404**.
- Browser (real Chromium): shop shows **31 "Photo coming soon" tiles + 3 Featured Drop badges**, 0 fake `<img>` paths, 0 console errors.

> Non-automatable item (flagged for the owner): **real product photos**. The storefront shows an explicit "Photo coming soon" tile until photos are uploaded via **admin → Add product / Edit** — uploads land in Supabase Storage as absolute URLs and appear everywhere automatically.

---

## Batch B5 (part a) — Storefront UX & accessibility

**Findings closed in this deploy:** F-22 *(storefront half)*, F-23, F-24, F-25, F-26, F-27 (also closes F-63), F-30, F-31, F-33, F-34 *(storefront half)*, F-40, F-66, F-67 *(storefront half)*, F-68 *(core palette)*, F-70, F-71, F-72, F-73 *(storefront half)*, F-74, F-75, F-76, F-79 *(data + public display half)*, F-80, F-86 *(storefront half)*
**Branch:** `fix/b5a-storefront-ux`

### What was wrong

| Finding | Problem |
| :--- | :--- |
| F-22 | Add-product form ships fabricated measurement/size defaults, and the PDP never says when measurements are missing. |
| F-23 | "Complete The Fit" arrows had no handlers and copy named a different product on every PDP. |
| F-24 | Wishlist heart was a no-op (component state only, not persisted, no wishlist page). |
| F-25 | No `not-found.tsx` / `error.tsx` / `global-error.tsx` — unknown slugs got a bare unbranded Next error. |
| F-26 | Confirmation + FAQ claimed an email was sent although email is a silent stub without `RESEND_API_KEY`. |
| F-27 / F-63 | `/styleguide` was publicly reachable and linked dead components; no `robots.txt`/`sitemap.xml`; three orphaned `ui/` files. |
| F-30 | `#9A9A9A` muted token used as text = 2.4–2.8:1 (~120 usages) — sitewide WCAG 1.4.3 failure. |
| F-31 | No `prefers-reduced-motion` support anywhere (hero transitions, pulses). |
| F-33 | Mobile menu button's `focus:outline-none` killed the global focus ring. |
| F-34 / F-67 | Three competing dropdown patterns; the storefront one had no keyboard/AT semantics. |
| F-40 | Condition grades shown but never explained where shown (definitions buried in FAQ). |
| F-66 | No `og:image`/`twitter:card` — WhatsApp/Instagram shares rendered as bare text links. |
| F-68 | Design tokens declared then ignored (~1,100 hardcoded hex literals). |
| F-70 | No `aria-live` regions for cart mutations / filter result counts. |
| F-71 | No social block for an Instagram-first brand. |
| F-72 | Fake "4-of-5" rating dots rendered as 5 dots — reads as a broken score. |
| F-73 | Touch targets below 44px: hero dots 6px, arrows 36px, hearts 32px, CTAs ~28px, steppers 28px. |
| F-74 | WhatsApp FAB overlapped the primary CTA on cart/checkout/confirmation; no safe-area inset. |
| F-75 | FAB pre-filled message was generic even on high-intent PDPs. |
| F-76 | No "how to measure yourself" guide — the top pre-purchase question for vintage denim. |
| F-79 | No tracking-number/courier field although confirmation + FAQ promised one. |
| F-80 | Heading-level skips (h1→h3) on home/shop/cart/PDP; footer started at h4. |
| F-86 | Polish bundle: dead Tailwind classes, public footer admin link, dash leftovers, mobile header a11y. |

### Changes

- **Design tokens (F-68/F-30)** — new `--color-muted-text: #67635D` (≥4.5:1 on light surfaces; `muted` is now reserved for decorative hairlines/dots), plus `--color-card-hover` and `--color-badge-sold-border`. Scripted exact-match migration (`b5_tokenize.py`, dry-run report kept) replaced **641 utility-`[#hex]` classes across 38 files** with theme tokens; class-level hex literals dropped from 949 to ~201, and everything left in the storefront is either an inline style (OG images, `global-error`) or a JS palette value, not a stray class. Admin dark shades are queued for part b.
- **Real wishlist (F-24)** — new `components/WishlistProvider.tsx` (localStorage `thriv_wishlist_v1`), new `/wishlist` page (noindex), header heart link + count pill, `aria-pressed` hearts on cards and PDP.
- **Truthful email copy (F-26)** — `lib/email.ts` stub now returns `success: false` and exports `isEmailConfigured()`; both `/api/orders` responses carry `email_enabled`; the confirmation page and FAQ only promise a receipt when email delivery is actually switched on.
- **Order tracking (F-79)** — new migration `20261017_b5_order_tracking.sql` adds `orders.courier` + `orders.tracking_number` (applied live); the public lookup returns both; the confirmation page shows the real number once dispatched (admin input lands in part b).
- **ShopTheLook (F-23)** — rewritten: fake arrows and "Look 01" copy removed; copy is derived from real items (brands, item count) and the section hides when empty.
- **Branded states + SEO (F-25/F-27/F-66)** — new `not-found`/`error`/`global-error` pages, `robots.txt` (disallows `/admin`, `/api`, `/cart`, `/checkout`, `/order`, `/wishlist`), force-dynamic `sitemap.xml` (36 URLs), root + per-product `opengraph-image` (1200×630 PNG via `next/og`), `twitter: summary_large_image`. `/styleguide` and the orphaned `ui/Button`, `ui/FilterChip`, `ui/FormFields` deleted. Canonical origin moved to `lib/site-url.ts` (`NEXT_PUBLIC_SITE_URL`, default = live Vercel URL).
- **A11y (F-31/F-33/F-40/F-70/F-73/F-74/F-80)** — global `prefers-reduced-motion` block + JS `scrollBy` behavior check; 44px targets (hero dots/arrows, card + PDP hearts, card CTA, steppers, YMAL arrows, FAB); focus-visible restored on the mobile menu toggle; `role="status"` live regions for cart mutations and filter counts; sr-only section headings remove all h-level skips; grade note + `/faq#condition-grades` anchor on the PDP; FAB gets safe-area inset and a compact icon-only mode on cart/checkout/order pages; per-product FAB message (F-75); "How to measure yourself" details guide (F-76).
- **Honesty pass (F-16/F-71/F-72)** — fake rating dots removed; "Follow the Drops" band links the real `@thriv.pk` Instagram + WhatsApp; placeholder tiles darken their text to a ≥5.2:1 worst case, and sold-out cards no longer apply a whole-card 80% opacity (which had dropped every label below 4.5:1).
- **Forms/UX (F-34/F-67/F-86)** — `CustomDropdown` is now a styled native `<select>` (keyboard/AT semantics for free); new shop search field + `role="status"` result count; dead classes removed; footer admin link removed; dash/formatting fixes (contact, FAQ); header mobile menu gets `aria-expanded`/`aria-controls` and Escape-to-close.

### Operational actions taken

- Migration applied to the live DB via `psycopg` after a rolled-back dry run (both columns verified inside the transaction first). Post-apply state: `courier` + `tracking_number` present, order row count unchanged (2).
- Canonical origin verified against DNS + the Vercel API: `thriv.pk` is **not** attached to any DNS record or Vercel project today, so metadata/sitemap/robots/OG default to the live `https://thriv-five.vercel.app`. Attaching the domain later needs only the `NEXT_PUBLIC_SITE_URL` env var — no code change (flagged below).

### Verification

| Check | Result |
| :--- | :--- |
| `npx tsc --noEmit` | ✓ clean |
| `npx eslint .` | ✓ 0 problems |
| `npm run build` | ✓ clean (new routes present: 404/error/global-error, robots, sitemap, wishlist, both OG images) |
| B5 route probes (local, real backend) | ✓ **32/32**: robots, sitemap 36 URLs, both OG images as PNG, branded 404s, wishlist, FAQ anchor, tracking lookup, social band, PDP extras, contact copy, cart live region |
| B3 regression battery (local) | ✓ **12/12** |
| Admin API battery (local) | ✓ **11/11** |
| Lighthouse (local Chromium) | ✓ `/shop` and PDP: **accessibility 100, best-practices 100, SEO 100**, 0 failing audits |
| Browser (local, real Chromium) | ✓ shop: 31 tiles, 3 native selects, `role="status"` pill; home: hero dots/arrows 44px; PDP: heart 44px + `aria-pressed`, steppers 44px, details toggle, add-to-cart live announcement; **wishlist end-to-end** (save → header count → `/wishlist` card → reload persistence → remove → empty state); 0 console errors |

### Deploy verification (2026-10-17)

**Preview** — branch commits `b557807` and `6dcbc77` deployed READY (`thriv-4qbc4486p-…`, `thriv-1yu3j97z1-…vercel.app`); previews on this project are behind Vercel Authentication, so mechanics only.

**Production** — merge commit `9b487f1`, deployment READY (`thriv-ok5qgki5o-…vercel.app`). Against `thriv-five.vercel.app`:
- B5 route probes: **32/32** — both OG endpoints return PNG, branded 404s for unknown page + slug, order lookup now returns `tracking_number`/`courier`/`email_enabled`.
- B3 regression battery: **12/12** (rate-limit case skipped so the operator IP stays usable).
- Metadata: `og:image` resolves to an absolute `…/opengraph-image` PNG (1200×630) with `twitter:card summary_large_image`.

> Flagged for the owner (non-automatable): **attach a custom domain**. `thriv.pk` doesn't resolve today; once it is added in Vercel, set `NEXT_PUBLIC_SITE_URL=https://thriv.pk` and every canonical/sitemap/OG URL follows. The social band links the real Instagram handle — embedding real IG posts still needs owner-provided post URLs.

---

## Batch B5 (part b) — Admin UX & polish

**Findings closed in this deploy:** F-22 *(form + server half)*, F-32, F-34 / F-67 *(admin half)*, F-35, F-36, F-37, F-38, F-39, F-68 *(admin dark scale)*, F-73 *(admin half)*, F-77, F-78, F-79 *(admin input half)*, F-81, F-86 *(admin bits + payment/currency drift)*
**Branch:** `fix/b5b-admin-ux`

### What was wrong

| Finding | Problem |
| :--- | :--- |
| F-22 | Add-product form fabricated values (brand "Zara", grade "Premium", sizes S/M/L/XL pre-selected, measurements prefilled, stock "5"); the API silently re-defaulted anything missing. |
| F-32 | No visible focus indicator anywhere in the admin — keyboard use was effectively blind. |
| F-34 / F-67 | Admin dropdowns were the third competing pattern, unstyled natives mixed with custom markup and no `aria-invalid` wiring. |
| F-35 | Admin form fields had no label/`for`/`id` associations — screen readers announced unlabeled inputs; icon buttons had no names. |
| F-36 | Submitting an invalid product gave one banner (or nothing) — no per-field message, no error summary, no focus management. |
| F-37 | Admin header jammed brand + tabs + actions into one row on phones (overlap ≈ 375px). |
| F-38 | Order detail had its own ad-hoc header — inconsistent with the shared admin nav, no tab context. |
| F-39 | Products could only be created and (mis-)toggled — no way to edit name, brand, grade, or price after creation. |
| F-68 | Admin dark theme was ~40 hand-tuned hexes (`#1a1a1a`…#3a3a3a`) with no shared scale. |
| F-73 | Admin action buttons were ~30px, size steppers 28px, refresh/sign-out ~32px. |
| F-77 | Destructive actions used raw `alert()` / `window.confirm()`. |
| F-78 | Fulfilment was a soup of status buttons with no next-step clarity and no confirmation on irreversible delivery. |
| F-79 | The public tracking field shipped in part a had no admin input. |
| F-81 | `text-neutral-500` on near-black = ≈3.3:1; placeholder/empty-state text illegible. |
| F-86 | Payment card copy/format drift (`Rs` spacing), dead `animate-in`-style classes, misc admin leftovers. |

### Changes

- **Token scale (F-68/F-81)** — five-tone admin palette in `app/globals.css` `@theme`: `admin-bg #161616`, `admin-field #202020`, `admin-raised #242424`, `admin-line #2a2a2a`, `admin-line-strong #303030`; context-aware script (`b5b_tokenize.py`) rewrote every remaining stray shade (79 replacements this pass after the hand refactors); final scan leaves **only 3 hex literals** in `components/admin/*` — all `dotColor` JS palette values, not classes. `text-neutral-500` → `400` throughout the admin (empty states, placeholders, meta rows).
- **Focus ring (F-32)** — `[data-admin]:focus-visible, [data-admin] :focus-visible { outline-color: #ffffff }` + `color-scheme: dark`; `data-admin` attribute added to every admin page/client root (orders, inventory, detail, new-product, login).
- **Dropdowns (F-34/F-67)** — `AdminDropdown` rewritten as a styled native `<select>` with `id`, `invalid`, `describedBy` props (mirrors the part-a storefront pattern); placeholder options render "Select brand" / "Select grade" with `value=""`.
- **Labels + error UX (F-35/F-36)** — `id`/`htmlFor`/`aria-invalid`/`aria-describedby` on every field (including all four measurement inputs); submitting an invalid form now renders an `role="alert"` summary ("N fields need attention") plus per-field messages, moves focus to the first invalid control, and `noValidate` on the form so the in-page system (not native bubbles) owns messaging.
- **Edit product (F-39)** — new `EditItemModal` (name, brand, grade, price, stock, subcategory, featured) on every inventory card; `PATCH /api/admin/products/[id]` extended with a whitelist: non-empty name, brand/condition strings, positive-integer price, stock, subcategory, `is_featured`.
- **Fulfilment rebuild (F-78/F-79)** — single primary next-action button (`new → Confirm Order`, `confirmed → Mark Shipped`, `shipped → Mark Delivered`), a 3-step stepper, "More actions" disclosure (skip-to-shipped for new orders, Cancel Order with confirm dialog), delivery gated behind a confirm dialog; new **Dispatch Details** card (courier + tracking number, hidden for new/cancelled orders) saved through the status route (both fields ≤80/≤60 chars, `null` when cleared, response echoes them).
- **Feedback primitives (F-77)** — `components/admin/AdminFeedback.tsx`: `AdminToast` (`role="status"`, 4s auto-dismiss) and `ConfirmDialog` (`role="dialog"`, `aria-modal`, Escape + backdrop close, focus lands on the confirm button, destructive variant); every `alert()`/`window.confirm()` replaced.
- **Layout & targets (F-37/F-73/F-38)** — admin header is now two rows below `sm` (brand/actions, then full-width tabs; 118px tall at 375px, no horizontal overflow); refresh + sign-out are 44px, inventory action buttons 44→, size steppers `w-11 h-11`, photo-remove 36px secondary. Order detail uses the shared `AdminNavHeader`.
- **Truthful defaults (F-22)** — client no longer sends fabricated brand/grade/sizes/measurements/stock; server rejects thrift without a grade, merch without sizes, and any product without stock; sizes are stored exactly as selected (`null` for non-merch), blank measurements are stripped (all-blank → `null`).
- **Polish (F-86)** — payment card copy/format aligned, dead `animate-in zoom-in-95`-style classes removed sitewide (repo-wide scan = 0), `scrollbar-none` → `no-scrollbar`, login page got its own metadata (`Admin Sign In | Thriv`) via `app/admin/login/layout.tsx` and a `<main>` landmark, toast/notification dismiss got a name + 36px target.

### Verification

| Check | Result |
| :--- | :--- |
| `npx tsc --noEmit` / `npx eslint` / `npm run build` | ✓ all clean |
| B5b admin battery (new, local) | ✓ **15/15** — condition/sizes/stock 400s, exact sizes stored, blank measurements dropped, PATCH name+condition round-trip + invalid price 400, dispatch round-trip + restore, empty-body 400, unauth 401 |
| B4 admin battery (local) | ✓ **11/11** |
| B5 route probes (local) | ✓ **32/32** |
| B3 regression battery (local) | ✓ **12/12** |
| Lighthouse (local Chromium) | ✓ `/admin` **100/100/100**, `/admin/products` **100/100/100**, order detail **100/100/100**, `/admin/login` **100/100/100** — first passes caught real issues, all fixed before deploy: stock-badge white-on-emerald 2.93:1 → dark chips (≈9:1), inventory h3-without-h2 → sr-only "All items" h2, hidden-card `opacity-60` meta text 3.25:1 → overlay-only dimming, login page missing `<main>` |
| Browser (local, real Chromium) | ✓ F-37: nav wraps to its own full-width row at 375px (`nav width 328px`, header 118px, no h-overflow); F-32 rule live (`outline-color: rgb(255,255,255)`, `color-scheme: dark`); 44×44 action/refresh/sign-out + size steppers with `aria-pressed` toggle; F-22 defaults all blank with "Select brand"/"Select grade" placeholders; F-36 empty submit → "5 fields need attention" alert + 4 field errors + `aria-invalid` + focus on `product-photos`, no navigation; F-39 edit round-trip (open modal → save → "Item updated" toast → row updates → revert); F-77 confirm dialog focus + Escape + backdrop; F-78 `new` order: primary "Confirm Order" + More actions ("Mark Shipped (skip)", "Cancel Order") + no dispatch card; delivered order: full stepper + completed note + dispatch card; F-79 dispatch round-trip verified end-to-end |

### Deploy verification (2026-10-17)

**Preview** — commit `3fe1fe4` deployed READY (`thriv-b4jun0cdf-…vercel.app`); previews remain behind Vercel Authentication, so mechanics only.

**Production** — merge commit `628a9f8`, deployment READY (`thriv-3cflnwtgr-…vercel.app`). Against `thriv-five.vercel.app`:
- B5 route probes: **32/32**.
- B3 regression battery: **12/12**.
- Admin API battery: **11/11**.
- New B5b admin battery: **15/15** — validation rejections, exact-size storage, edit whitelist, dispatch round-trip (written, verified, restored), auth guards.

> Flagged for the owner (non-automatable): nothing new in this batch. The standing items from earlier batches remain: **attach a custom domain** (set `NEXT_PUBLIC_SITE_URL` when done), **real product photos** (upload via admin → Edit; the storefront shows "Photo coming soon" until then), **real Instagram post URLs**, and a final **copy/tone** pass.

---

## Batch B6 — Security & resilience hardening

**Findings closed in this deploy:** F-41, F-44 *(throttle half; MFA enrollment is an owner step — flagged below)*, F-45, F-46, F-47, F-49, F-50, F-51, F-52, F-53, F-55, F-56, F-57, F-82, F-83
**Branch:** `fix/b6-hardening` (+ follow-up commit `350f8da`)

### What was wrong

| Finding | Problem |
| :--- | :--- |
| F-41 | Checkout/admin routes returned raw Postgres error text and classified by substring match (`msg.includes('Only ')`) — anonymous callers got schema disclosure. |
| F-44 | No login throttling/lockout: the admin password was the whole security model, brute-forceable at full speed. |
| F-45 | No security headers at all — `/admin/login` was framable (clickjacking), no CSP containment, `X-Powered-By` on. |
| F-46 | No security-event logging: failed logins silent, admin mutations unaudited — no trace if the B1 holes had been exploited. |
| F-47 | Logout only cleared the cookie; a copied token stayed valid until expiry. |
| F-49 | Admin product endpoints skipped validation — free text hit typed columns (`22P02` → 500), `category` unconstrained. |
| F-50 | Check-then-insert idempotency with no `unique_violation` handler (concurrent retries → raw 500 or duplicates), key regenerated per mount, replay echoed the order number. |
| F-51 | `is_admin()` (backs RLS and storage policies) ran `SECURITY DEFINER` without a pinned `search_path`. |
| F-52 | Deleting a product orphaned its photos in the bucket; storage grants were blanket and the bucket was listable with any anon key. |
| F-53 | Upload failures swallowed (product created with missing photos while the admin saw success); no server-side size/type gate. |
| F-55 | Three indexes duplicating UNIQUE constraints, two with no consumer; the hot storefront query `(is_active, created_at desc)` unindexed. |
| F-56 | Migrations claimed "safe to re-run" but the Realtime `ADD TABLE` errors on a second run. |
| F-57 | Realtime toast had no `role="status"` and rows hardcoded `item_count: 1`; Realtime had no remaining consumer once the admin moved to polling. |
| F-82 | Weak, shadownable cookie name; `**.supabase.co` image allowlist (any project's storage); attacker-controlled text interpolated into emails. |
| F-83 | No `updated_at` on products/orders; admin list endpoints fetched all rows unbounded. |

### Changes

- **Migration `20261017_b6_hardening.sql`** (applied to the live DB before deploy — additive and backward compatible with the running build, verified; re-runnable — proven by a full re-apply): `admin_login_attempts` + RLS; `is_admin()` search_path pinned; **`place_order` v4** — TH001–TH007 SQLSTATEs, replay reduced to `{idempotent:true}`, race-safe via per-slug lock + in-lock replay recheck + `unique_violation` handler; `updated_at` columns + `set_updated_at()` triggers on products/orders; `products_category_check`; six redundant indexes dropped + `idx_products_active_created` added; storage policies dropped; `orders` removed from `supabase_realtime`; the initial-schema publication statement wrapped for true idempotency (F-56).
- **Checkout errors (F-41)** — `lib/order-errors.ts` maps SQLSTATE → fixed `{status, code, message}`; unrecognised errors become a generic 500 with the WhatsApp fallback; raw detail goes to server logs only.
- **Login throttle + audit trail (F-44/F-46)** — `lib/admin-login-throttle.ts`: 5 failures / 15 min per email+IP → `429` + `Retry-After`, a successful login clears the counter; `lib/security-log.ts`: one-line structured JSON events (`auth.login.success/failure/blocked/denied`, `auth.logout`, `admin.product.create/update/delete`, `admin.product.upload_rejected`, `order.replay`, `auth.denied`).
- **Headers (F-45)** — CSP (`default-src 'self'`; script-src pinned to self + Next's inline bootstrap; img/connect limited to the project's Supabase host), `X-Frame-Options: SAMEORIGIN` + `frame-ancestors 'self'` (same-origin embedding tooling intentionally kept working; cross-origin framing blocked), `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS; `poweredByHeader: false`.
- **Session lifecycle (F-47/F-82)** — cookie renamed to **`__Host-thriv_admin_token`** (Secure, HttpOnly, Path=/, no Domain, `Max-Age` = the token's real `expires_in` ≈ 3600 s — no 7-day fallback); logout revokes the Supabase session server-side (`signOut(token, 'global')`) and reports `revoked: true`.
- **Admin validation (F-49)** — `lib/admin-product-schema.ts` Zod: category/condition/size unions, 1-of-1 thrift stock, price/stock bounds; 400 with field errors; PATCH whitelist. The DB `CHECK` backstops `category` independently.
- **Upload gate (F-53)** — size (4 MB combined — deliberately under Vercel's 4.5 MB request-body cap), MIME allowlist and **magic-byte** checks server-side; a failed upload aborts and removes anything already uploaded; the product row is written only after all photos land; the form mirrors the same gate client-side.
- **Replay UX (F-50)** — the idempotency key is persisted in `sessionStorage` (stable across reload retries, cleared on success); server replay returns only `{idempotent:true}`; the form shows an "order already submitted" panel instead of duplicating.
- **Storage (F-52)** — product delete now removes its bucket objects (reported as `storage.removed`); storage policies dropped. **Honest note:** `REVOKE` on `storage.objects`/`buckets` is a no-op — those grants belong to `supabase_storage_admin` (platform-managed; 16 survive). Denial is enforced by RLS with zero policies, verified live: anon bucket list returns `[]`, uploads are denied, and public URL serving is unaffected. A deleted object may briefly resolve from Supabase's CDN cache — deletion is verified against the bucket listing, not the URL.
- **Scale hygiene (F-55/F-83)** — redundant indexes dropped, `(is_active, created_at desc)` added; `updated_at` columns/triggers; admin orders/products GETs gained `limit`/`offset`/`total`/`has_more` (defaults keep the UI unchanged).
- **Misc (F-57/F-82)** — Realtime toast replaced by polling with `role="status"`; the Supabase image host is derived from `NEXT_PUBLIC_SUPABASE_URL` and pinned exactly; email lines are sanitized against newline/control-char injection. **Kept deliberately:** the `THR-` sequential order-number format (documented, owner-facing; unchanged this pass).

### Verification

| Check | Result |
| :--- | :--- |
| `npm run typecheck` / `lint` / `build` | ✓ all clean |
| B6 migration battery (new) | ✓ **48/48** across dry-run → committed → re-apply (idempotency proven twice) |
| B6 DB battery (new) | ✓ **29/29** — replay minimality (rolled-back tx leaves no rows), **two-connection race**: concurrent retry returns exactly `{idempotent:true}`, exactly one order exists, test row cleaned up; TH001–TH007 probes; `updated_at` trigger fires; category CHECK rejects; storage RLS effective |
| B6 HTTP battery (new, local) | ✓ **55/55** — headers/CSP, `__Host-` cookie attributes (Secure, HttpOnly, Path=/, no Domain, Max-Age=3600), pagination + `updated_at`, Zod 400s, upload gate (fake / oversize / 9 photos / combined > 4 MB), create → serve → `/next/image` → delete → bucket-empty, SQLSTATE 409s with no DB leak, throttle 5×401 → 429 + `Retry-After`, logout `revoked:true` |
| Browser (local, real Chromium) | ✓ storefront hydrates under the CSP (0 console errors); add-to-cart increments the badge (2 → 3, reverted after); admin **form login on `http://localhost`** → dashboard (the `__Host-` cookie is accepted on localhost); `/me` authenticated; token **invisible to JS** (HttpOnly); Sign Out → back to login, `/me` 401 |
| Security-log evidence | ✓ 13 structured events captured in the server log (upload rejections, create/delete, login failure ×5 / blocked / success, logout) |

### Deploy verification (2026-10-17)

**Preview** — commit `ae1b192` deployed READY; follow-up `350f8da` deployed READY. Previews remain behind Vercel Authentication (probes hit the SSO wall — mechanics only).

**Production** — merge commits `50e1673` and `2fd214a`, deployments READY. Against `thriv-five.vercel.app`:
- B6 HTTP battery: **56/56**. The first production run (53/54) caught a real platform interaction worth noting: Vercel rejects request bodies over 4.5 MB with its own **413 before the route can answer**, so a gate advertising "5 MB allowed" promised more than the platform honors. Limits were re-aligned to **4 MB combined** (client + server, with a clear `400` / `PAYLOAD_TOO_LARGE` instead of a bare 413) and redeployed as `2fd214a`; the prod re-run is fully green.
- Final sweep: **zero** `b6-test` products or storage objects left in the DB/bucket.
- Prod browser smoke: `/shop` hydrates with **0 console errors** under the live CSP; 29 add-to-cart buttons interactive.

> **Flagged for the owner (non-automatable):**
> - **MFA enrollment** for the admin account (F-44 remainder): Supabase dashboard → Authentication → Users → enroll TOTP. The throttle now limits brute force; MFA removes the password-only failure mode.
> - Uploads are capped at **4 MB combined per product** because of the Vercel request-body limit; if full-size camera photos are needed later, the path forward is client-side compression or direct-to-storage signed uploads.
> - Standing items from earlier batches: **attach the custom domain** (+ set `NEXT_PUBLIC_SITE_URL`), **real product photos**, **real Instagram post URLs**, and a final **copy/tone** pass.

---

## Batch B7 — Deep security hardening (2026-10-18)

**Scope:** the owner's 7-phase hardening brief — DB-level limits, admin MFA, API/input hardening, upload validation, headers/secrets, and a live attack suite. Builds on the B6 foundation; no design or copy changes.

### What was added / changed

- **Migration `20261018_security_hardening.sql`** (applied and verified before the code deploy; additive and backward compatible with the running build): `rate_limits` table + `check_rate_limit(key, max, window)` RPC (sha256-keyed, fixed-window, service-only — raw IPs/emails never stored); `orders.public_token` (UUID, unique) now returned by `place_order`; `audit_log` + UPDATE triggers on `products`, `orders`, and admin mutations; RPC hardening on the order path.
- **Admin auth (MFA, completes F-44)** — TOTP two-factor: password step → signed 5-minute stateless ticket cookie (`__Host-thriv_mfa_ticket`, HMAC-SHA256 keyed from the service key) → code step → `aal2` Supabase session is the only credential `verifyAdminToken` accepts. Both lockout buckets count **failures only** (a success can never move a legitimate admin toward lockout).
- **Turnstile** — checkout + admin login; missing/blank secret fails **closed**; hostname binding active for real keys (test keys exempted until the owner's real keys are installed; a missing hostname on a real-key verification is rejected).
- **Checkout** — per-IP DB burst limit, honeypot, strict Zod (unknown keys rejected, items ≤ 20, quantity ≤ 40), generic error copy, no PII in logs.
- **Order lookup** — confirmation links and the lookup API are keyed by the unguessable `public_token` (UUID); legacy `THR-` links 404 by design. Lookup responses carry no PII, are `no-store`, and rate-limited.
- **Uploads** — magic-byte validation then **sharp re-encode** to WebP (strips payloads/EXIF), 4 photos / 4 MB combined, storage paths are server-generated UUIDs only.
- **Headers** — CSP `script-src`/`frame-src` allow `challenges.cloudflare.com`; `frame-ancestors 'none'` + `X-Frame-Options: DENY`; `X-Robots-Tag: noindex, nofollow` on `/admin/*`, `/api/admin/*`, and `/order/*`.
- **Deps** — `next` / `eslint-config-next` → **16.4.2**; `npm audit --omit=dev` = 0; 5 dev-only highs remain in the `eslint-config-next` brace-chain (no patched release; `audit fix --force` would downgrade to 14.x — declined, documented).
- **Attack suite** — `security/attack-tests/`: `setup.mjs` (fixture users + MFA enrollment), `run.mjs` (**39 checks**; `SUITE=prod` runs the 6 read-only checks), `teardown.mjs` (removes fixtures and counters, detaching `order_events.created_by` first).

### Verification

| Check | Result |
| :--- | :--- |
| `npx tsc --noEmit` / `eslint .` / `npm run build` | ✓ all clean (Next 16.4.2) |
| `npx tsx scripts/check-admin-guard.ts` | ✓ all assertions pass |
| Local attack suite vs production build (`security/attack-tests/last-run.md`) | ✓ **39/39** — headers, checkout, lookup, admin MFA/lockouts, uploads, forgot/aal1/non-admin tokens |
| Production read-only subset vs `thriv-five.vercel.app` (`security/attack-tests/last-run-prod.md`) | ✓ **6/6** (headers, noindex, unauth 401, token-page title, legacy 404) |
| Two independent review passes (security + integration) of the full diff | ✓ all blockers fixed before deploy (failure-only lockout counting, confirmation-page false-success state, password handling, `/order` noindex, Turnstile hostname fail-closed) |
| GoTrue aal1 → second-factor bypass probe | ✓ refused (403) — a password-only session cannot enroll its way to aal2; pinned as suite check #39 |

### Operational notes (2026-10-18)

- **Vercel env restored before deploy**: the project was missing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (production had been surviving on an older deployment's snapshot) — re-set from the local env, together with the Turnstile variables (Production + Preview).
- Deploy `c35214c` → **READY**; production header sweep + read-only subset green.
- Fixtures torn down after the final run: both attack-test users deleted; `admins` / `rate_limits` / `admin_login_attempts` rows removed; `order_events.created_by` detached (FK to `auth.users`) before the user delete.
- Five cancelled suite orders remain in the orders table for the record: `THR-00009` … `THR-00013` (customer "Attack Test Order", all cancelled with stock restored).

> **Flagged for the owner:**
> - **Re-login + re-enroll TOTP**: the `aal2` rule invalidates every pre-existing admin session (including the owner's). The first login after this deploy walks through QR enrollment — keep the authenticator safe.
> - **Real Turnstile keys**: Cloudflare's always-pass **test** keys are in place until real keys are pasted into Vercel (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`); the bot check and hostname binding activate automatically with real keys.
> - **HIBP leaked-password protection** is a Supabase **Pro-plan** feature — the Management API rejected enabling it on the current Free plan. Consider upgrading, or accept the current password policy.
> - **`RESEND_API_KEY` is not set** in Vercel — order-confirmation emails remain intentionally stubbed.

---

## Batch B7.1 — First-login hotfix (2026-10-18, from a live production report)

**Symptom:** the owner's first production admin sign-in failed with *"Server error during authentication."* (HTTP 500) despite a correct password.

**Root cause:** GoTrue omits the `factors` field from `GET /auth/v1/user` (and from the sign-in payload) **entirely while a user has no TOTP factors**. `lib/admin-mfa.ts` `readFactors()` treated the missing field as a parse failure, so `getTotpFactors()` returned `{ok:false}` and the login route answered 500 at the factor-lookup step — *before* the first-login enrollment branch could run. The attack-suite fixture always had a factor (enrolled by `setup.mjs`), so the field was always present in tests; only a true first-ever login — exactly the owner's state — hit the gap. Probed live against the project: pre-enrollment `factors` is absent; after verification it is `array[1] verified/totp`.

**Fix:** `getTotpFactors()` now treats any `200` from `/user` as authoritative — `readFactors(body) ?? []`; a missing field means "no factors", never an error. Non-200 responses still fall back to the sign-in payload and then fail closed, as before. No other callers affected (`recheck` in the login route benefits identically).

**Verification:**

| Check | Result |
| :--- | :--- |
| `npm run build` (incl. TypeScript) | ✓ clean |
| New probe `security/attack-tests/probe-nofactor-login.mjs` vs local production build | ✓ **8/8** — password → `mfa_setup` + QR + manual key → live TOTP → `aal2` admin cookie → `/api/admin/orders` 200 |
| Full local attack suite (`IP_OFFSET=60`, has-factor path) | ✓ **39/39** |
| Same no-factor probe vs production | ✓ **8/8** — deploy `de51d65` READY; password → `mfa_setup` + QR + manual key → live TOTP → `aal2` cookie → `/api/admin/orders` 200 |

**Residue:** the probe creates and deletes its own throwaway admin (user + `admins` row + known `rate_limits`/`admin_login_attempts` buckets); suite teardown re-confirmed users removed 2/2.

---

## Batch B7.2 — Turnstile submit gating + honeypot hardening (2026-10-18, second live report)

**Symptom:** after B7.1, the owner's retry showed *"Could not process this request. Please try again."* — the login route's generic 400 for an absent/failed Turnstile token (or a tripped honeypot).

**Root cause:** the Sign In button was disabled only while `turnstileReady && !turnstileToken`, so it was **enabled during two real windows** — before the widget's first render, and during the widget remount that follows every failed attempt. A fast click in either window (typical with password-manager autofill) sent `turnstile_token: null`; the server failed closed with the generic 400; the error handler then remounted the widget again — clicking faster than the widget re-rendered looped there indefinitely. Secondary hardening: the honeypot input was only positioned off-screen (not `display:none`) and carried no password-manager ignore hints.

**Fix (client-only; server fail-closed behaviour untouched):**
- `TurnstileWidget` gains `onUnavailable()`, fired ONLY when no token can be expected without a page state change (missing site key / script blocked / widget error) — never during loading or remounting.
- Admin login and checkout disable submit until a token exists OR `onUnavailable` fired; the "never a dead button" case for blocked scripts is preserved (submit re-enables, server rejects visibly).
- Both honeypots moved to `display:none` + `data-lpignore` / `data-1p-ignore` / `data-bwignore`.

**Verification (production, real browser — deploy `a4c08d1` READY):**

| Check | Result |
| :--- | :--- |
| Fresh load: submit disabled until the token arrives (was enabled-at-load before) | ✓ observed disabled → enabled |
| Wrong password: request reached the server **with a valid token**; 401 "Invalid login credentials" | ✓ observed |
| During the post-error widget remount the button is DISABLED (previously enabled with null token — the loop) | ✓ observed |
| Fresh token arrives → button re-enables (no dead button) | ✓ observed |
| Correct password → **QR enrollment screen** (QR renders, manual key shown) | ✓ observed + screenshot |
| Live TOTP → `aal2` cookie → `/admin` dashboard | ✓ reached `Orders \| Thriv Admin` |
| Browser console | only the two expected 401s from the deliberate wrong-password + `mfa_setup` responses |
| Temp admin + buckets + attempts rows | deleted — residue check: 0 probe users, 1 admins row (`admin@thriv.pk`) |

---

## Batch B8 — Admin MFA temporarily disabled (owner request, 2026-10-18)

**Request:** after the first-sign-in enrolment friction (B7.1/B7.2), the owner asked to remove the two-factor step: *"remove the 2fa for now. just a simple login"*.

**Implementation (one flag, fully reversible):** `lib/admin-mfa-config.ts` exports `ADMIN_MFA_ENABLED = false`.

- `app/api/admin/auth/login/route.ts` (v2.1): while the flag is off, a correct password sets `__Host-thriv_admin_token` directly from the fresh password-grant session (aal1), clears any stale MFA ticket cookie, and returns `{success:true}` — no `mfa_required`/`mfa_setup`, no QR. The entire MFA branch below it is untouched.
- `lib/admin-auth.ts`: the aal2 requirement applies only while the flag is on; the aal1 password-grant session is accepted (still requires a valid Supabase `getUser` identity, a matching `sub`, and an `admins` row).
- Everything else stays active: Origin check, honeypot, Turnstile (fail closed), IP + account DB rate limits, email+IP failure throttle, admins membership, and all Phase 4–7 hardening (headers, uploads, order tokens).

**Re-enabling** = set `ADMIN_MFA_ENABLED = true` and redeploy; no other change. The ticket, the `mfa/verify` route, and the QR enrolment UI are intact.

**Verification:**

| Check | Result |
| :--- | :--- |
| Local probe — temp no-factor admin; wrong password → 401; correct password → 200 + admin cookie (no ticket, no mfa flags); admin API 200 with cookie; 401 without; self-cleanup | ✓ **7/7** |
| Same probe vs production (commit `da6d15e`, deploy READY) | ✓ **7/7** |
| Real browser vs production: email + password → straight to `/admin` "Customer Orders" dashboard (no QR step), zero console errors | ✓ observed |
| Temp admin + its buckets + attempts rows | deleted after both runs |

**Attack-suite note:** checks #25, #27–#29, #37 (MFA flow) and the aal1-admin assertion in #32 are expected to **FAIL by design** while the flag is off; they pass again unchanged once MFA is re-enabled. The suite was not modified — the MFA-off path is covered by the two probes above instead.

---

## Batch B9 — Order-confirmation emails live via Resend (owner request, 2026-10-18)

**Request:** switch on customer order-confirmation emails; the owner supplied a Resend API key.

**Installed:** `RESEND_API_KEY` in Vercel (Production + Preview, encrypted) and in the local `.env.local` (git-ignored — never committed). The key is a Resend *sending-access-only* key: it can send mail but cannot manage domains, contacts, or keys — exactly the least privilege a production mailer should hold.

**What works now:** the order-confirmation email (`lib/email.ts` → Resend HTTP API, fire-and-forget — it can never delay or fail an order) sends for real. Verified end-to-end on a local production build against the live services:

| Check | Result |
| :--- | :--- |
| Direct Resend send to the account's testing inbox (`thriv.str@gmail.com`) | ✓ accepted, id `01a14efb-…` |
| Real order through `/api/orders` (THR-00016, customer email = that inbox) | ✓ 201; server log `[email] Confirmation sent for order THR-00016 (id: 01a14efc-…)` |
| Admin cancel path + stock restored (temp admin → simple login → status PATCH) | ✓ THR-00016 cancelled, product stock back to 1; temp admin user fully cleaned up |
| Truthful-copy gate (audit F-26) | `email_enabled` now requires the key **and** `RESEND_FROM_EMAIL` (`canDeliverCustomerEmail()` in `lib/email.ts`); until a verified sending domain exists, the confirmation page keeps the WhatsApp-primary copy instead of promising a receipt |

**One owner action remains for customer delivery:** verify a sending domain in Resend (resend.com/domains → add domain → copy the SPF/DKIM DNS records into the domain's DNS). Resend rejects every send to a customer address until then — only the account's own inbox can receive mail. When the domain shows **Verified**, set `RESEND_FROM_EMAIL` (e.g. `Thriv <orders@thriv.pk>`) in Vercel and redeploy: emails start flowing, and the confirmation copy flips to "a receipt is on its way" automatically.

**Notes:** until the domain is verified, customer sends are attempted and rejected (403, logged) — orders are unaffected. Test order THR-00016 remains as cancelled (same policy as THR-00009–00015). The `order_events.created_by` cleanup quirk was confirmed again: null it before deleting an admin user, or Supabase Auth returns 500.

---

## Batch B10 — Performance: cacheable catalogue, SSR shop, WOFF2 fonts, sin1 functions (owner request, 2026-10-19)

**Request:** full production performance audit, then a plan; owner approved deploying the first phases — "deploy to production then measure the times".

**What was wrong (audited 2026-10-18, production, from Karachi):** zero caching anywhere — home SSR on every request (`revalidate = 0`, no-store, 1.29 s TTFB, always MISS); product pages `force-dynamic` with two DB queries per view (1.6–2.6 s); `/api/products` `force-dynamic` (1.38 s median — the endpoint the shop's client waterfall waited on); functions running in `iad1` (US-East) while the database lives in `ap-southeast-1` (Singapore) and users are nearest `bom1` — every dynamic request paid two intercontinental hops. Raw TTF fonts were ~70% of first-visit wire weight (Inter 876 KB + Anton 171 KB ≈ 1,023 KB).

**Changes (commit `acfe331`, deployed via `vercel --prod` CLI):**

- **ISR where safe:** `revalidate = 60` on `/`, `/product/[slug]` (now `generateStaticParams` for all 31 products) and `GET /api/products`; sitemap hourly. Only `/api/orders/[publicToken]` stays `force-dynamic`.
- **New `lib/revalidate.ts` — `revalidateCatalog()`:** on-demand invalidation of `/`, `/shop`, `/product/[slug]` (all), `/api/products`, `/sitemap.xml`. Called after every catalogue-affecting mutation: admin product create/update/delete, order-status transitions (`update_order_status` stock effects) and successful `place_order` (stock decrement). Audit F-17/F-18 freshness preserved: mutations land on the next request; edits that bypass the app (Studio/psql) heal within the 60 s window; `place_order` still validates price + stock server-side.
- **`/shop` server-rendered:** the catalogue is baked into the prerendered HTML (113 KB, all 31 pieces) — the shell → JS → `/api/products` fetch waterfall is gone. A `SearchParamsBridge` (its own Suspense boundary) keeps the `useSearchParams()` client-bailout off the product grid, so the grid prerenders; filters refine in place after hydration (cost: one unfiltered frame on filtered URLs). Client retry path kept for the error state.
- **Fonts:** TTF → subsetted WOFF2 via fontTools (Inter 876 KB → 144 KB; Anton 171 KB → 32 KB; −83% combined); `next/font/local` updated; preloads render on home and shop.
- **Region:** `vercel.json` → `"regions": ["sin1"]` — functions co-located with Supabase. Runbook + helper: `docs/perf/region-ab.md`, `scripts/perf/region-ab.ps1`.

**Measured — production, Karachi, same methodology as the audit (4 runs; TTFB):**

| Route | Before (2026-10-18) | After (2026-10-19) |
| :--- | :--- | :--- |
| `/` | 1.29 s, MISS, no-store | **0.26–0.30 s steady-state HIT** (ISR 60 s; first two runs 0.59/0.72 s network warm-up) |
| `/shop` (pieces visible) | 1.6–2.2 s (client fetch) | **in the first HTML** — 31 pieces baked in; TTFB 0.25–0.29 s |
| `/product/[slug]` | 1.6–2.6 s, MISS | **0.26–0.41 s HIT** (runs 3–4 show background revalidation in `bom1::sin1`) |
| `/api/products` | 1.38 s median, MISS | **0.28–0.36 s HIT** |
| `/cart` (static control) | 0.33–0.36 s | 0.28–0.33 s (unchanged — catalogue now sits at the static edge floor) |
| `/order/*` (DB-bound dynamic) | dynamic MISS class | **0.33–0.37 s, function in `sin1`** (region move live) |
| 404 (unknown route) | ~1.0 s anomaly | **0.24–0.28 s HIT** (prerendered static) |

**Verification:**

| Check | Result |
| :--- | :--- |
| Local: `tsc --noEmit`, `eslint`, `next build` | ✓ clean; route table ISR/SSG exactly as intended (57 pages) |
| Local prod server (`next start`) | ✓ all catalogue routes HIT + `s-maxage=60`; `/shop` serves 113 KB with all 31 products |
| Production curl matrix | ✓ the table above |
| Production browser (real Chrome, shop) | ✓ hydration clean (0 console errors); `31 pieces` → click Denim → `/shop?category=jeans`, `27 pieces`, aria state correct; custom fonts loaded; cold tab load ≈ 0.8 s |
| Fonts served | ✓ `200`, `font/woff2`, 144,440 B, `immutable` |
| Deploy | `vercel --prod` → READY, aliased to `thriv-five.vercel.app` |

**Notes / open items:**

- The region A/B (`sin1` vs `bom1`) second leg was **not run**: with the catalogue edge-cached and remaining dynamic routes DB-bound, `sin1` answers a fresh DB-backed function request in ~0.34 s from Karachi (same order as the ~0.32 s static floor); rationale recorded in `docs/perf/region-ab.md §7.5`. Flip `vercel.json` to `["bom1"]` if a formal counter-measurement is ever wanted — one-line revert, procedure in the doc.
- **Contract for future work:** any new endpoint that mutates products or stock **must** call `revalidateCatalog()` after success, or ISR will serve stale data for up to 60 s.
- One live check remains owner-side (no code impact): an admin product edit should now appear on `/`, its product page and `/api/products` within seconds.
- Phase 5 (image pipeline) was completed in B11 below. The Instagram → listing workflow remains open from the plan.

---

## Batch B11 - Image pipeline: resize on upload + responsive optimized delivery (2026-10-19)

**Request:** owner asked whether product photos would slow the site down, ahead of the first photo batch. Approved the three image fixes before upload.

**What was wrong (audited before any photo existed):**

- The sharp upload pipeline re-encoded to WebP but **never resized**. A 12 MP phone photo stayed 4000x3000 and became a 1.5-3 MB WebP.
- `ProductImage` rendered product photos with `unoptimized`, so the PDP downloaded that full file verbatim (and only ever renders `images[0]`).
- `sizes` was wrong in both directions: the PDP asked for `25vw` (it occupies ~55vw) while the shop grid asked for `50vw` (it occupies ~33vw), and every `HomeMedia` slot shared the hero hint.
- Cart, checkout and "pairs well with" never passed `imageUrl` at all - they would have kept showing placeholders even after photos went live.

**Changes (commit `a027aca`, deployed via `vercel --prod` CLI):**

- **Upload:** `.rotate()` → `.resize({ width: 1600, height: 2000, fit: 'inside', withoutEnlargement: true })` → `.webp({ quality: 82 })`. Caps the stored master at display size without upscaling small sources; EXIF handling unchanged.
- **`ProductImage`:** `unoptimized` removed, `sizes` became a caller-supplied prop (default = PDP hero). Thumbnails now request real pixel widths: cart `96px`, checkout `56px`, pairs-well-with `80px`; grid cards and the PDP got exact hints.
- **`HomeMedia`:** optional `sizes` prop so hero (`40vw` / 515px cap), campaign (`36vw` / 465px), editorial (`55vw` / 715px), feature (`52vw` / 660px), home grid and shop grid (`33vw` / 440px cap; `50vw` ≤767px) each fetch their own size.
- **`next.config.ts`:** `minimumCacheTTL: 31536000` (storage object paths are immutable UUIDs) and `formats: ["image/avif", "image/webp"]`.

**Measured (local production build + real Supabase object + optimizer):**

| Check | Result |
| :--- | :--- |
| 12 MP worst-case source → old pipeline | 3,740 KB, 4032x3024 |
| 12 MP worst-case source → new pipeline | **937 KB, 1600x1200 (-75%)**; 800x600 source stays 800x600 |
| Optimizer, `w=640` | **43 KB AVIF** (-95% vs source) |
| Optimizer, `w=828` | 102 KB AVIF |
| Optimizer, `w=1080` | **128 KB AVIF** - the variant a 3-col card picks at 2x |
| Optimizer, `w=1920` | 339 KB AVIF |
| Response header | `Cache-Control: public, max-age=31536000` (config applied) |
| Shop HTML | `srcset` with 256-3840 w candidates, `sizes="(max-width: 767px) 50vw, (max-width: 1328px) 33vw, 440px"`, `loading="lazy"` |
| PDP HTML | `sizes="(max-width: 1024px) 100vw, (max-width: 1328px) 55vw, 720px"` plus `<link rel="preload" as="image" imageSrcSet=...>` |
| Gates | `tsc --noEmit`, `eslint`, `next build` all clean; no test data left in the build (verified 0 matches) |
| Production | all 31 pieces render, PDP buy button present, 0 console errors; warm TTFB unchanged (home ~0.30 s, `/api/products` ~0.31 s, `/shop` HIT) |

**Operational notes:**

- Vercel Hobby includes 5,000 image transformations/month and the CDN caches each variant for a year, so a 31-product catalogue needs roughly 310 one-time transformations (~16x headroom). Exceeding the quota would make images fail, not just slow down - revisit if the catalogue grows by an order of magnitude.
- Any future image writer (seed script, service-role import) must apply the same resize before upload; the cap lives only in the admin POST route today.
- **Open gap found during this batch:** `PATCH /api/admin/products/[id]` accepts JSON metadata only (price/stock/visibility/name/etc.) and there is **no product edit page**, so photos cannot be attached to the 31 existing products through the admin UI. They can only be set at creation. A small script or a multipart PATCH + edit form is needed before the existing catalogue can receive photos.

---

## Batch B12 - Website image pack imported as live listings (owner request, 2026-10-21)

**Request:** the owner dropped a folder of generated website imagery and asked for the items to become catalogue entries, named after their files, with placeholder prices and descriptions.

**What was done:**

- Added `scripts/import-product-images.mjs` - a reusable importer. It reads a manifest, runs every photo through the same sharp chain as the admin upload (`rotate` -> cap 1600x2000 -> WebP q82), uploads to `products/imports/<batch>/<uuid>.webp`, inserts a product row with a unique slug, and writes a rollback record (`scripts/imports/result-*.json`, gitignored). `--dry-run` validates without writing. This also closes the "photos can only be attached at creation" gap for programmatic imports.
- Added `scripts/imports/website-images-2026-10-21.json` - 17 entries, one per file in the owner's pack. Product name = file name without extension. Category uses the existing taxonomy (`jeans` for the two denim shots, `graphic-tees` for everything else); subcategory carries the real type (`anime-tees`, `stickers`, `sweatshirts`, `full-looks`, `baggy`, `vintage-wash`).
- Dummy data: prices Rs 999-2,499, stock 10 (sticker 25), sizes S-XL (jeans 30-36, sticker "One size"), descriptions "Placeholder listing imported from the website image pack...".
- All 17 are **live** (`is_active = true`) per the owner's choice.

**Verification:**

| Check | Result |
| :--- | :--- |
| Dry run | 17/17 files found; 35.8 MB of PNGs -> 2.49 MB of WebP (-93%) |
| Live import | 17/17 inserted, 0 failures; active products 31 -> **48** |
| `/shop` after ISR | **48 pieces**, 48 unique product links, 197 `/_next/image` references |
| Category counts | All 48 / Denim 29 / Graphic tees 19 |
| Browser (shop) | 17/17 photos load, 0 broken, 0 console errors |
| Browser (PDP) | Tanjiro, Luffy, sticker ("One size"), jeans (30-36) all render with add-to-cart |
| Images served | optimized `/_next/image` AVIF/WebP variants, not originals |

**Notes / open items:**

- Two files share the name "Luffy Rising Sun Graphic Tee" (one in `Graphic Tees/One Piece`, one in `Section 2`, byte-identical). Per the owner's "every file" choice both became listings; slugs are `luffy-rising-sun-graphic-tee` and `-2`. Delete one later if the duplicate card is unwanted.
- The sweatshirt/henley/full-look photos live under `graphic-tees` because the catalogue still only has `jeans` and `graphic-tees`. A `sweatshirts` category is a small change if the taxonomy should match.
- The first shop screen can still show grey placeholder tiles: the existing 31 thrift pieces have no photos yet and the default sort is "Featured & newest".
- **Prices/descriptions cannot be edited in the admin UI** (no product edit page; PATCH accepts price/name/stock/visibility but not description). Until an edit form exists, the practical path for the owner's next pass is a bulk-update script driven by a manifest.
