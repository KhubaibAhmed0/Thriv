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

## Batches B5–B6 — pending

Applying in report order: B5 (UX/a11y), B6 (hardening; F-48 already closed in B3). Each will get its own section here with the same evidence format.
