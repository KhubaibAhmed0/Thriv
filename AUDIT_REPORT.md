# Thriv — Consolidated Audit Report (5-Lens Merge)

**Date:** 2026-10-17 · **Commit:** `37ef0ed` · **Working tree:** clean except untracked `graphify-out/`
**Method:** 5 parallel lens reviewers (dead code, runtime/logic, database/Supabase, security/auth, UX/a11y) + coordinator source verification of 13 flagged claims + tool runs (`eslint` — 70 problems: 41 errors, 29 warnings; `tsc` — clean; `next build` — OK, 51 routes). 131 raw findings reviewed; **86 post-dedup findings (F-01…F-86)**.
**Raw reports:**
- `C:/Users/InaequoSolutions-PC/AppData/Local/Temp/opencode/audit/1-dead-code.md` (27 findings: DC-01…DC-27)
- `C:/Users/InaequoSolutions-PC/AppData/Local/Temp/opencode/audit/2-runtime-bugs.md` (20 findings: RB-01…RB-20)
- `C:/Users/InaequoSolutions-PC/AppData/Local/Temp/opencode/audit/3-database.md` (26 findings: DB-01…DB-26)
- `C:/Users/InaequoSolutions-PC/AppData/Local/Temp/opencode/audit/4-security.md` (21 findings: SEC-01…SEC-21)
- `C:/Users/InaequoSolutions-PC/AppData/Local/Temp/opencode/audit/5-ux.md` (58 findings: P0-1…P3-11)
- Evidence files: `eslint-full.txt`, `refscan-report.txt` (same folder)

Dedup note: findings are merged **by defect**, not by title. Where severities differed, the conservative (higher) severity was kept unless a lower one is clearly better justified — stated in one clause on the finding. `VERIFIED-SOURCE` = confirmed against source during consolidation; `CONFIRMED` = deterministic from code (no live test run); `SUSPECTED` = needs the stated live test.

---

## 1. Plain-language summary (for the owner)

- **Your admin area can be unlocked by one bad deploy setting.** If the Supabase public keys are missing but the database key is present, anyone who sends *any* password-like value can read and edit every order — customer names, phone numbers, addresses, and even delete products. The login check is written to say "allow" in that state. (`F-01`, `F-08`)
- **Your admin password `thriv2026` is written in the public GitHub repo** (handover doc and an old unused dashboard file). Treat it as burned and change it — one login attempt confirms whether that old password still works. (`F-02`)
- **One file the project notes tell you to run would make all orders public.** `supabase/schema.sql` opens the orders table to "anyone with the app's public key"; the live database uses the safe migrations, but the file and the instruction are a trap. (`F-03`)
- **One "Mark Shipped" click erases remaining stock.** A printed tee with 26 left goes to "Sold Out" site-wide, and there is no edit screen to fix it — the only workaround is to delete and recreate the listing, which changes its link. (`F-04`, `F-39`)
- **If the database key is missing after a deploy, checkout still says "Order Placed Successfully".** No order is saved, the store never sees it, and a customer may send a bank transfer for an order that does not exist. (`F-05`)
- **Refreshing the checkout page throws the customer back to the cart** and loses whatever they typed — this is the most common abandonment path in online shops. (`F-07`)
- **Your own footer's "Admin Portal" link can crash the page** for any customer who taps it, because the site header breaks a React rule when navigating between the shop and admin. (`F-06`)
- **New products entered in admin lose the fit/category and "Featured" you choose** — the Baggy & Wide-Leg and Cargo Denim filters can never match them, and nothing appears in Featured. (`F-10`)
- **Products without an uploaded photo show a blank tile** — the starter data points at photo files that do not exist anywhere in the project; the admin inventory shows a broken image icon. (`F-16`)
- **A hidden product can still be bought** (it fails only at checkout), and product pages keep showing the old price and stock after you change them, until the site is rebuilt. (`F-17`, `F-18`)

---

## 2. Severity overview (after dedup)

| Severity | CONFIRMED | VERIFIED-SOURCE | SUSPECTED | Total |
|---|---|---|---|---|
| **P0** — money/security/data loss | 1 | 6 | 0 | **7** |
| **P1** — broken feature / trust / purchase path | 27 | 5 | 1 | **33** |
| **P2** — hardening / maintenance / polish | 38 | 2 | 1 | **41** |
| **P3** — nits (grouped bundles) | 5 | 0 | 0 | **5** |
| **Total** | **71** | **13** | **2** | **86** |

Notes: several CONFIRMED findings carry a SUSPECTED live-state sub-claim (F-02 password reuse; F-09 email-on-replay; F-16 sitewide image scope; F-50 concurrency). P3 rows are consolidated bundles of ~20 raw nit findings. Cross-lens agreement on the highest-impact defects is summarised in section 6.

---

## 3. Master findings table

| ID | Sev | Area | Finding (one line) | Primary location | Verdict |
|---|---|---|---|---|---|
| F-01 | P0 | Security | Admin guard authorises anyone with any token when public Supabase env vars are unset (fails open) | `lib/admin-auth.ts:23-26` | VERIFIED-SOURCE |
| F-02 | P0 | Security | Admin password `thriv2026` committed in a public repo (docs + dead component); rotation required | `PROJECT_HANDOVER.md:28,96`; `components/AdminDashboardClient.tsx:218-223` | VERIFIED-SOURCE (exposure) / SUSPECTED (reuse) |
| F-03 | P0 | Security | `supabase/schema.sql` installs `USING (true)` RLS on orders and the handover tells operators to run it | `supabase/schema.sql:50-54`; `PROJECT_HANDOVER.md:126` | VERIFIED-SOURCE |
| F-04 | P0 | DB | Shipped/Delivered status sets `stock = 0` for every line (incl. merch already decremented at checkout) | `app/api/admin/orders/[orderNumber]/status/route.ts:117-131` | VERIFIED-SOURCE |
| F-05 | P0 | Runtime | Offline mode returns 201 `THR-LOCAL-*` fake order — "Order Placed Successfully" with no DB row, no stock change | `app/api/orders/route.ts:86-96` | CONFIRMED |
| F-06 | P0 | Runtime | Header returns early before 5 hooks → client-side crash navigating storefront ↔ `/admin` (footer Admin link) | `components/Header.tsx:11-19` | VERIFIED-SOURCE |
| F-07 | P0 | UX | `/checkout` empty-cart redirect fires before cart hydration → hard refresh/deep-link bounces to `/cart` | `components/CheckoutForm.tsx:85-89`; `components/CartProvider.tsx:30` | VERIFIED-SOURCE |
| F-08 | P1 | Security | Admins-table membership check is skipped when the service key is absent — any Supabase-auth user gets the admin cookie | `app/api/admin/auth/login/route.ts:74-99`; `lib/admin-auth.ts:42-53` | VERIFIED-SOURCE |
| F-09 | P1 | Security | Public `POST /api/orders` has no rate limit: inventory depletion + confirmation-email replay (replay email behaviour unverified) | `app/api/orders/route.ts:116-145`; `supabase/migrations/20260920_place_order_rpc.sql:91-105,196-198` | CONFIRMED / SUSPECTED (email replay) |
| F-10 | P1 | DB | `subcategory` + `is_featured` columns don't exist: admin values silently discarded, subcategory filters and Featured logic dead for DB products | `app/api/admin/products/route.ts:58`; `lib/products-db.ts:24,34,62,72`; `components/admin/AddProductForm.tsx:149` | CONFIRMED |
| F-11 | P1 | DB | 1-of-1 invariant not enforced in DB; `PATCH /products/:id` accepts any `stock` (thrift can be set to 50) | `supabase/migrations/20260920_initial_schema.sql:58`; `app/api/admin/products/[id]/route.ts:27-31` | CONFIRMED |
| F-12 | P1 | DB | No status-transition guards; cancel restores wrong stock; `delivered_at` never cleared; cancel-from-delivered resurrects sold items | `app/api/admin/orders/[orderNumber]/status/route.ts:132-153`; `components/admin/OrderDetailClient.tsx:552-584` | VERIFIED-SOURCE |
| F-13 | P1 | DB | Static seed silently shadows an empty/broken DB (server fallback + client ignores empty API response) | `lib/products-db.ts:6-42`; `components/ShopCatalog.tsx:38-47`; `components/BrowseShopSection.tsx:27-36` | CONFIRMED |
| F-14 | P1 | DB | `isServiceConfigured()` has no placeholder/trim guard → placeholder URL counts as configured → checkout 500 instead of fallback | `lib/supabase-server.ts:48-53`; `app/api/orders/route.ts:86-99` | VERIFIED-SOURCE |
| F-15 | P1 | DB | Removed `bershka-washed-black-balloon-jeans` still seeded active; two hardcoded code filters; admin link 404s | `lib/products-db.ts:17,45`; `supabase/migrations/20260920_initial_schema.sql:258-262` | VERIFIED-SOURCE |
| F-16 | P1 | DB | Image pipeline broken: seed paths `/products/*.jpg` exist nowhere; `placeholder.png` missing; fallback is a CSS tile | `components/ProductImage.tsx:57,83`; `supabase/migrations/20260920_initial_schema.sql:224`; `components/admin/AdminProductsListClient.tsx:257,272` | VERIFIED-SOURCE (scope refined) |
| F-17 | P1 | Runtime | PDP is build-time SSG with no revalidation — price/stock/hide changes never reach `/product/[slug]` until redeploy | `app/product/[slug]/page.tsx:13-17,44`; `lib/products-db.ts:44-79` | CONFIRMED (build-verified) |
| F-18 | P1 | Runtime | `getProductBySlug` has no `is_active` filter — hidden products stay viewable and add-to-cart-able until checkout 409 | `lib/products-db.ts:49-53` | CONFIRMED |
| F-19 | P1 | Runtime | Confirmation email awaited with no timeout before the response → stalled email can turn one order into two on retry | `app/api/orders/route.ts:137-145`; `lib/email.ts:64-94`; `components/CheckoutForm.tsx:66` | CONFIRMED |
| F-20 | P1 | Runtime | Merch quick-add hardcodes size `L`; RPC never validates `selected_size` against `products.sizes` | `components/ProductCard.tsx:23,31-33`; `supabase/migrations/20260920_place_order_rpc.sql:189,214` | CONFIRMED |
| F-21 | P1 | Dead code | Dead `AdminDashboardClient` + legacy `lib/supabase.ts`: hardcoded-password gate, dead `x-admin-key` bypass, mock PII, obsolete-schema writer, client-inlinable key path | `components/AdminDashboardClient.tsx:29-68,149,218-235`; `lib/supabase.ts:3-10,110-158,204-207` | CONFIRMED |
| F-22 | P1 | UX | Add-product form ships pre-filled measurements/size/grade — fabricated specs publish verbatim on a no-returns listing | `components/admin/AddProductForm.tsx:57,62,66-71` | CONFIRMED |
| F-23 | P1 | UX | "Complete The Fit" arrows have no handlers and copy names a different product on every PDP | `components/ShopTheLook.tsx:41-52,57-70` | CONFIRMED |
| F-24 | P1 | UX | Wishlist heart is a no-op (component state only, not persisted, no wishlist page) | `components/ProductCard.tsx:39-43`; `components/ProductDetailClient.tsx:106-120` | CONFIRMED |
| F-25 | P1 | UX | No `not-found.tsx` / `error.tsx` / `global-error.tsx` — unknown product slugs get a bare unbranded Next error page | repo-wide (glob: 0 files); `app/product/[slug]/page.tsx:47` | CONFIRMED |
| F-26 | P1 | UX | Confirmation page + FAQ claim an email was sent, but email is a silent stub when `RESEND_API_KEY` is unset | `components/OrderConfirmationClient.tsx:92-95`; `app/faq/page.tsx:84`; `lib/email.ts:33-38` | CONFIRMED |
| F-27 | P1 | UX | `/styleguide` is publicly reachable, leaks internal phase notes and real cart buttons; no `robots.txt`/`sitemap.xml` | `app/styleguide/page.tsx:75-85,104`; no `app/robots.ts`/`app/sitemap.ts` | CONFIRMED |
| F-28 | P1 | UX | Checkout errors: no `aria-invalid`/`aria-describedby`/`aria-live`, no focus management, banner off-screen below the CTA | `components/CheckoutForm.tsx:98-128,489-494,528-565` | CONFIRMED |
| F-29 | P1 | UX | WhatsApp field rejects spaced/dashed numbers people actually type; client/API regexes duplicated and can drift | `components/CheckoutForm.tsx:17-22`; `app/api/orders/route.ts:30-35` | CONFIRMED |
| F-30 | P1 | UX | Muted token `#9A9A9A` used as text = 2.36–2.81:1 (needs 4.5:1) — sitewide WCAG 1.4.3 failure (~120 usages) | `app/globals.css:12` | CONFIRMED (computed) |
| F-31 | P1 | UX | No `prefers-reduced-motion` support anywhere (hero transitions, pulses, smooth scroll) | `app/globals.css` (no media query); `components/HeroCarousel.tsx:43` | CONFIRMED |
| F-32 | P1 | UX | Global focus ring `#111111` is invisible on every admin surface (`#111111`/`#161616`) — 1.00:1 | `app/globals.css:84-88` | CONFIRMED |
| F-33 | P1 | UX | Mobile menu button's `focus:outline-none` overrides the global focus ring (specificity) — no visible focus | `components/Header.tsx:39` | CONFIRMED |
| F-34 | P1 | UX | Custom dropdowns: no focus style on trigger; `role="option"` on buttons with no arrow-key/activedescendant/Escape-return semantics | `components/admin/AdminDropdown.tsx:76-79,110-159`; `components/ui/CustomDropdown.tsx:108-156` | CONFIRMED |
| F-35 | P1 | UX | Add-product form: 10+ controls without `htmlFor`/ids — Accessibility-name failure | `components/admin/AddProductForm.tsx:373-399,405-435,529-599` | CONFIRMED |
| F-36 | P1 | UX | Add-product errors appear only as a banner at the top of a very long form, not announced, no field marking | `components/admin/AddProductForm.tsx:120-140,273-278,639-655` | CONFIRMED |
| F-37 | P1 | UX | Admin nav header does not fit 375px (no wrap/overflow) → horizontal page scroll | `components/admin/AdminNavHeader.tsx:31-105` | SUSPECTED (needs rendered check) |
| F-38 | P1 | UX | Order detail has its own header: no Orders/Inventory tabs, no Refresh, no Sign Out | `components/admin/OrderDetailClient.tsx:269-287` | CONFIRMED |
| F-39 | P1 | UX | Inventory has no edit action — typos/price/stock fixes require delete + recreate (new slug, broken links) | `components/admin/AdminProductsListClient.tsx:342-373` vs `app/api/admin/products/[id]/route.ts:27-31` | CONFIRMED |
| F-40 | P1 | UX | Condition grades never explained where shown (badge only; definitions buried in FAQ accordion) | `components/ProductDetailClient.tsx:168`; `app/faq/page.tsx:53-71` | CONFIRMED |
| F-41 | P2 | Security | Raw Postgres/RPC error messages returned to anonymous clients; 409/500 split by fragile substring matching | `app/api/orders/route.ts:120-134`; `app/api/admin/orders/route.ts:42-44` | CONFIRMED |
| F-42 | P2 | Security | `/api/admin/auth/me` echoes the raw Supabase access token in the JSON body (HttpOnly cookie undermined) | `app/api/admin/auth/me/route.ts:48-55`; `components/admin/AdminOrdersListClient.tsx:215-225` | VERIFIED-SOURCE |
| F-43 | P2 | Security | Middleware matcher `['/admin/:path*']` does not cover `/api/admin/*`; middleware fails open without env; `middleware.ts` deprecated in Next 16 (rename to `proxy.ts`) | `middleware.ts:25-28,101-103` | VERIFIED-SOURCE |
| F-44 | P2 | Security | No login throttling, lockout or MFA for the single admin account | `app/api/admin/auth/login/route.ts:59-69` | CONFIRMED |
| F-45 | P2 | Security | No security headers anywhere (no CSP, no `frame-ancestors`/`X-Frame-Options`, no `Referrer-Policy`); `X-Powered-By` on | `next.config.ts` (no `headers()`); `vercel.json` | CONFIRMED |
| F-46 | P2 | Security | No security-event logging/audit (failed logins, admin mutations) — OWASP A09 | `app/api/admin/auth/login/route.ts:64-68`; `lib/admin-auth.ts:59-61` | CONFIRMED |
| F-47 | P2 | Security | Logout clears the cookie only; no server-side session revocation — copied token survives logout until expiry | `app/api/admin/auth/logout/route.ts:3-15` | CONFIRMED |
| F-48 | P2 | Security | Checkout `items` array/strings unbounded in Zod schema — lock-starvation / oversized transactions | `app/api/orders/route.ts:21-25,58` | CONFIRMED |
| F-49 | P2 | Security | Admin product endpoints skip Zod: free-text into enum/union columns, no bounds, empty updates succeed | `app/api/admin/products/route.ts:52-101`; `app/api/admin/products/[id]/route.ts:27-31` | CONFIRMED |
| F-50 | P2 | DB | Idempotency check-then-insert race (raw 500 on duplicate key) + key regenerated per mount (lost on reload) + replay returns order number/total | `supabase/migrations/20260920_place_order_rpc.sql:88-105,168-182`; `components/CheckoutForm.tsx:66` | CONFIRMED / SUSPECTED (race window) |
| F-51 | P2 | DB | `SECURITY DEFINER` functions without pinned `search_path` | `supabase/migrations/20260920_place_order_rpc.sql:10-14`; `supabase/migrations/20260920_initial_schema.sql:133-142` | CONFIRMED |
| F-52 | P2 | DB | Storage: orphaned objects on product delete/update, `GRANT ALL` to anon/authenticated, bucket-wide SELECT listing | `app/api/admin/products/[id]/route.ts:67-78`; `supabase/migrations/20260921_products_storage.sql:21-24,68-71` | CONFIRMED |
| F-53 | P2 | DB | Upload failures swallowed (product still created) and no server-side MIME/size check before upload | `app/api/admin/products/route.ts:110-157` | CONFIRMED |
| F-54 | P2 | DB | Duplicate line items for one slug defeat the per-line stock check → raw check-constraint 500 | `supabase/migrations/20260920_place_order_rpc.sql:137-163,185-220` | CONFIRMED |
| F-55 | P2 | DB | Index hygiene: 3 redundant unique duplicates, 2 unused, hot `(is_active, created_at)` query unindexed | `supabase/migrations/20260920_initial_schema.sql:119-127`; `lib/products-db.ts:10-13` | CONFIRMED |
| F-56 | P2 | DB | Migrations not actually re-runnable (`ALTER PUBLICATION ADD TABLE` fails on re-run) despite "Safe to re-run" header | `supabase/migrations/20260920_initial_schema.sql:6,208` | CONFIRMED |
| F-57 | P2 | Runtime | Realtime order toast isn't announced and hardcodes `item_count: 1` for multi-line orders | `components/admin/AdminOrdersListClient.tsx:247-261,355-387` | CONFIRMED |
| F-58 | P2 | Runtime | Confirmation page reads `localStorage` only (bare page cross-device/share) and mixes snapshot lines with the server total | `components/OrderConfirmationClient.tsx:44,182,191-199`; `components/CheckoutForm.tsx:177-189`; `app/api/orders/route.ts:186-189` | CONFIRMED |
| F-59 | P2 | Dead code | Documentation drift: dead files documented as live, wrong product counts (31 vs 32), removed sections listed | `PROJECT_HANDOVER.md:76,80,82,96,100,126`; `README.md:33,41`; `data/products.ts:5,662` | CONFIRMED |
| F-60 | P2 | Dead code | `PAYMENT_LABELS` ×4 and `STATUS_CONFIG` ×2 — copy changes must be made 4–6 times | `components/OrderConfirmationClient.tsx:9`; `components/admin/OrderDetailClient.tsx:70,111`; `components/admin/AdminOrdersListClient.tsx:53,94` | CONFIRMED |
| F-61 | P2 | Dead code | Row→Product mapping duplicated verbatim in `products-db.ts` (bershka hack applied twice) | `lib/products-db.ts:16-35` vs `:56-73` | CONFIRMED |
| F-62 | P2 | Dead code | Delivery fee is a constant in two code paths (TS + SQL RPC) plus hard-coded prose in 10+ locations — money-facing drift risk | `lib/cart.ts:4`; `supabase/migrations/20260920_place_order_rpc.sql:37`; `app/page.tsx:274,277` | CONFIRMED |
| F-63 | P2 | Dead code | Parallel UI layers: checkout reimplements form primitives; `components/ui/*` consumed only by the orphaned `/styleguide` | `components/CheckoutForm.tsx:528,537`; `app/styleguide/page.tsx:3-10,95-96` | CONFIRMED |
| F-64 | P2 | Dead code | Sold-out state computed in the cart and never rendered | `components/CartPageClient.tsx:61` | CONFIRMED |
| F-65 | P2 | Dead code | Lint is red (41 errors/29 warnings) and nothing runs it (bare script, no CI) | `package.json:9`; no `.github/**` | CONFIRMED |
| F-66 | P2 | UX | No `og:image`/`twitter:card` — WhatsApp/Instagram shares render as bare text links | `app/layout.tsx:16-28`; `app/product/[slug]/page.tsx:31-39` | CONFIRMED |
| F-67 | P2 | UX | Three competing dropdown patterns (custom, admin, native) with inconsistent accessibility | `components/ui/CustomDropdown.tsx`; `components/admin/AdminDropdown.tsx`; `components/CheckoutForm.tsx:313-323` | CONFIRMED |
| F-68 | P2 | UX | Design tokens declared then ignored (~1,100 hardcoded hex literals; token utilities used 0 times) | `app/globals.css:6-44` vs all components | CONFIRMED |
| F-69 | P2 | UX | `text-[#666666]` invented on `/contact` while `--color-body #444444` exists | `app/contact/page.tsx:54,81,105,119,136` | CONFIRMED |
| F-70 | P2 | UX | No `aria-live` regions for cart mutations / filter result counts | `components/CartPageClient.tsx:118-153`; `components/ShopCatalog.tsx:180-182` | CONFIRMED |
| F-71 | P2 | UX | No social proof block for an Instagram-first brand (no reviews/UGC/IG embed) | `app/page.tsx` (no social section); `components/ProductCard.tsx:187-203` | CONFIRMED |
| F-72 | P2 | UX | Fake 4-of-5 rating dots rendered as 5 dots — reads as a broken score, marked `aria-hidden` | `components/ProductCard.tsx:192-202`; `components/ShopTheLook.tsx:125-136` | CONFIRMED |
| F-73 | P2 | UX | Touch targets below 44px: hero dots 6px, arrows 36px, hearts 32px, CTA ~28px, steppers 28px, admin icon buttons ~30px | `components/HeroCarousel.tsx:64-79,119-136`; `components/ProductCard.tsx:67-85,160-183`; `components/CartPageClient.tsx:128-146` | CONFIRMED |
| F-74 | P2 | UX | WhatsApp FAB (`fixed bottom-6 right-6`) overlaps the primary CTA on cart/checkout/confirmation; no safe-area inset | `components/WhatsAppFAB.tsx:25` | SUSPECTED |
| F-75 | P2 | UX | FAB pre-filled message is generic on every page, incl. high-intent PDPs | `components/WhatsAppFAB.tsx:14` | CONFIRMED |
| F-76 | P2 | UX | No "how to measure yourself" guide — the top pre-purchase question for vintage denim | `components/ProductDetailClient.tsx:370-372` | CONFIRMED |
| F-77 | P2 | UX | `alert()`/`confirm()` used for all admin error/destructive flows; no success feedback on status changes | `components/admin/OrderDetailClient.tsx:195,201,221,226,575`; `components/admin/AdminProductsListClient.tsx:82,89,97,109,114` | CONFIRMED |
| F-78 | P2 | UX | Fulfilment actions not a guided sequence — "Mark Delivered" is the biggest button even on a fresh order | `components/admin/OrderDetailClient.tsx:506-586` | CONFIRMED |
| F-79 | P2 | UX | No tracking-number/courier field although confirmation + FAQ promise one | `components/admin/OrderDetailClient.tsx:266-630` (no field); `components/OrderConfirmationClient.tsx:156`; `app/faq/page.tsx:26` | CONFIRMED |
| F-80 | P2 | UX | Heading-level skips (h1→h3) on home/shop/cart/PDP; footer starts at h4 | `app/page.tsx:66,95`; `components/CartPageClient.tsx:91,163`; `components/Footer.tsx:25` | CONFIRMED |
| F-81 | P2 | UX | Admin dark-surface contrast: `text-neutral-500` on `#161616`/`#111111` = 3.82:1/3.98:1 | `components/admin/OrderDetailClient.tsx:433,614`; `components/admin/AdminOrdersListClient.tsx:441,485` | CONFIRMED |
| F-82 | P3 | Security | Security nits: cookie hardening (`__Host-` prefix, maxAge fallback), `**.supabase.co` image remote pattern, attacker text in emails | `app/api/admin/auth/login/route.ts:110-118`; `next.config.ts:5-10`; `lib/email.ts:40-62` | CONFIRMED |
| F-83 | P3 | DB | Scale hygiene: no `updated_at` on products/orders, global order-number sequence format, no pagination on admin lists | `supabase/migrations/20260920_initial_schema.sql:34,63-87`; `app/api/admin/orders/route.ts:23-40` | CONFIRMED |
| F-84 | P3 | Dead code | Deletion bundle: dead sign-out handler + unused `LogOut`, 25 unused vars/imports, no-op exception block, 2 dead exports, 5 scaffold SVGs | `components/admin/AdminOrdersListClient.tsx:11,291-297`; `supabase/migrations/20260920_place_order_rpc.sql:233-237`; `data/products.ts:766,771`; `public/*.svg` | CONFIRMED |
| F-85 | P3 | Dead code | Config nits: duplicate `.vercel` ignore, tsconfig scaffolds (SUSPECTED), inert `vercel.json cleanUrls`, `graphify-out/` untracked (gitignore only — do not delete), ternary-as-statement, stale `OrderStatus` union | `.gitignore:37,43`; `tsconfig.json:3,5`; `vercel.json:4`; `graphify-out/`; `components/HeroCarousel.tsx:49`; `types/index.ts:91` | CONFIRMED (SUSPECTED sub-items) |
| F-86 | P3 | UX | Polish bundle: dead Tailwind classes, public footer admin link, payment/currency drift, dash leftovers, mobile header a11y details, shop search affordances, admin login title | `components/Header.tsx:129,149-154`; `components/Footer.tsx:132-134,144-160`; `app/contact/page.tsx:123`; `components/ShopCatalog.tsx:55,252-266`; `app/admin/login/page.tsx:1` | CONFIRMED |

## 4. Detailed findings

Grouped by severity. Each finding lists what happens, exact locations, business impact, which reviewer(s) found it (raw report IDs), and a fix direction. Fix batches (section 8) reference these IDs.

### P0 — money / security / data loss

**F-01 · P0 · Admin authorization fails open when public Supabase env vars are unset** (SEC-01 / DB-02 / RB-02) — coordinator verification #4, VERIFIED-SOURCE
- **What / where:** `lib/admin-auth.ts:23-26` returns `{ authorized: true, user: { id: 'dev-admin' } }` for **any non-empty token** (cookie or `Authorization: Bearer`) whenever `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` are unset — while `isServiceConfigured()` (`lib/supabase-server.ts:48-53`) stays true if a service key exists, so every `/api/admin/*` handler runs with full DB power. The guard reads only the `NEXT_PUBLIC_*` names (no `SUPABASE_URL` fallbacks), unlike middleware/login/service client.
- **Impact:** with a plausibly half-configured deployment, anyone can dump every order (name, phone, address), rewrite statuses, create/delete products and upload into the public bucket. The storefront and admin UI look normal, so it is easy to miss.
- **Evidence:** reviewer #4 (`4-security.md`, SEC-01), #3 (`3-database.md`, DB-02), #2 (`2-runtime-bugs.md`, RB-02); coordinator note #4. Also addressed here: the skipped admins-table check (SEC-01 sub-item b → tracked as F-08) and the middleware fail-open (`middleware.ts:25-28`, F-43).
- **Fix direction:** make `verifyAdminRequest` fail **closed** (`return { authorized: false }` when env is missing); use one shared env-resolution helper for guard, middleware and service client; keep any dev bypass behind an explicit, non-production flag; add the unit test "no token → false; junk token → false; non-admin user → false; admin user → true".

**F-02 · P0 · Admin password `thriv2026` committed in a public repository** (SEC-02 / DC-01) — VERIFIED-SOURCE (exposure); SUSPECTED (live reuse)
- **What / where:** `PROJECT_HANDOVER.md:28` lists `Admin Password | thriv2026` and `:96` repeats it; `components/AdminDashboardClient.tsx:218-223` hardcodes the same string. The GitHub repo `github.com/KhubaibAhmed0/Thriv` is public (verified), and the string remains in git history even after deletion.
- **Impact:** a scraper can learn the storefront's historic admin credential. Whether the live Supabase Auth password still equals it is unverified — if it was reused, one `POST /api/admin/auth/login` yields a full admin session.
- **Evidence:** reviewer #4 (`4-security.md`, SEC-02); #1 (`1-dead-code.md`, DC-01); coordinator note #9.
- **Fix direction:** rotate the Supabase Auth password to a generated 20+ char secret now; enable MFA on the Supabase account; disable public signups; scrub the handover and consider `git filter-repo`/treat the password as burned. Live test: one login attempt with `thriv2026` (owner-authorised) or check Supabase Auth users; `git log -p --all -S thriv2026`.

**F-03 · P0 · `supabase/schema.sql` ships permissive RLS and the handover tells operators to run it** (DB-01 / SEC-03 / DC-02 / RB-03) — coordinator verification #8, VERIFIED-SOURCE
- **What / where:** `supabase/schema.sql:50-54` creates `USING (true)` SELECT/UPDATE and `WITH CHECK (true)` INSERT policies on `orders`/`order_items`, against a **different column set** than the live migrations (`whatsapp`/`total` vs `customer_phone`/`total_pkr`). `PROJECT_HANDOVER.md:126` (and `:84`) instructs running this file. `CREATE TABLE IF NOT EXISTS` means on an already-migrated DB the tables survive but the policies still execute against them.
- **Impact:** if run against a live or re-provisioned project, the public anon key could read all customer PII and rewrite any order. If run first on a fresh project, checkout breaks while the storefront still looks healthy (static fallback). Live exposure today is SUSPECTED (the working admin suggests the migration schema is live).
- **Evidence:** all four backend reviewers: #3 (DB-01), #4 (SEC-03), #1 (DC-02), #2 (RB-03); coordinator note #8.
- **Fix direction:** delete `supabase/schema.sql` (or move to `supabase/legacy/` with a loud "DO NOT RUN" header) and fix `PROJECT_HANDOVER.md:84,126` to point at the three migrations in order. If it was ever run, drop the five policies (SEC-03 remediation) and re-apply `20260920_initial_schema.sql`. Live test: anon-key `GET /rest/v1/orders?select=order_number,customer_name,customer_phone&limit=1` (on a scratch project or with owner sign-off).

**F-04 · P0 · "Shipped"/"Delivered" sets stock to 0 for every line item** (DB-03 / RB-01 / UX P0-4) — coordinator verification #7, VERIFIED-SOURCE
- **What / where:** `app/api/admin/orders/[orderNumber]/status/route.ts:117-131` updates `products.stock = 0` for every item on `shipped`/`delivered`, but `place_order` already decremented the exact quantity at checkout (`supabase/migrations/20260920_place_order_rpc.sql:196-198`). The cancel branch right below (`:144-149`) proves merch stock is variable — it restores `is_merch ? stock + qty : 1`.
- **Impact:** dispatching one tee order drives that design's stock from e.g. 8 to 0 → "Sold Out" site-wide, every other pending order 409s, and there is no stock-edit UI (F-39) to recover — manual SQL only. Repeated silent loss of saleable inventory on ordinary fulfilment.
- **Evidence:** reviewer #3 (DB-03), #2 (RB-01), #5 (P0-4); coordinator notes #7.
- **Fix direction:** delete the stock writes from the status route entirely — stock is `place_order`'s responsibility; the status route should only append `order_events`. If a visual "sold out" is wanted for thrift, set it only for `!is_merch` and already-zero rows.

**F-05 · P0 · Offline mode fabricates order success** (RB-06 / UX P0-5) — CONFIRMED
- **What / where:** `app/api/orders/route.ts:86-96` returns HTTP 201 `{ order_number: 'THR-LOCAL-<ts>', total_pkr: 0, offline: true }` when `isServiceConfigured()` is false. `CheckoutForm` treats any 2xx as success (`components/CheckoutForm.tsx:174-201`): clears cart, writes the localStorage snapshot, shows "Order Placed Successfully".
- **Impact:** with a missing/lost service key after a redeploy, the customer sees success and may transfer money for an order that is never recorded; the owner sees nothing. Silent revenue loss + broken trust, invisible to both sides. *(RT rated P1 — config-dependent; UX rated P0 for the money impact — conservative P0 kept.)*
- **Evidence:** reviewer #2 (RB-06), #5 (P0-5).
- **Fix direction:** return 503 in production with a "checkout temporarily unavailable — message us on WhatsApp" state (the FAB CTA exists); only keep a fake order for an explicit dev mode, and surface `offline: true` in the UI if kept.

**F-06 · P0 · Header hooks-order violation — client-side crash on storefront ↔ admin navigation** (UX P0-1 / DC-06) — coordinator verification #1, VERIFIED-SOURCE
- **What / where:** `components/Header.tsx:11-19` returns `null` for `/admin` paths **before** calling 5 hooks (`useCart`, 3× `useState`, `useRouter`). ESLint reports 5× `react-hooks/rules-of-hooks`. `Header` lives in the root layout, so it is not remounted on client navigation; the footer's `<Link href="/admin">` (`components/Footer.tsx:132`) triggers the count change.
- **Impact:** tapping "Admin Portal" in the footer (public on every page) crashes the page for any customer; with no `error.tsx` (F-25) the site shows the bare Next.js error screen.
- **Evidence:** reviewer #5 (P0-1), #1 (DC-06); coordinator note #1.
- **Fix direction:** keep all hooks unconditional and move the `null` return after them (or split an inner component); add `app/error.tsx` so any future crash degrades gracefully.

**F-07 · P0 · `/checkout` hard refresh/deep link bounces to `/cart` before cart hydration** (UX P0-2 / RB-12 / UX P2-5) — coordinator verification #2, VERIFIED-SOURCE
- **What / where:** `components/CheckoutForm.tsx:85-89` redirects whenever `items.length === 0`; `CartProvider` hydrates from `localStorage` in an effect (`components/CartProvider.tsx:33-49`) but never exposes `isHydrated` (tracked at `:30`). Child effects run before parent effects, so the guard fires on the first commit.
- **Impact:** refresh, back/forward, backgrounded-tab restore or a bookmark of `/checkout` throws the customer back to `/cart`, discarding the filled form — the classic abandonment path. The same missing flag causes the empty-cart flash on `/cart`. *(RT rated P2; UX P0 — conservative P0 kept.)*
- **Evidence:** reviewer #5 (P0-2, P2-5), #2 (RB-12); coordinator note #2.
- **Fix direction:** expose `isHydrated` from `useCart()` and gate the redirect on it (or render a spinner until hydration completes); use the same flag for the cart empty-state skeleton.

### P1 — broken features, trust, purchase path

**F-08 · P1 · Admins-membership check skipped when the service key is absent** (SEC-04 / SEC-01b) — coordinator verification #5, VERIFIED-SOURCE
- **What / where:** `app/api/admin/auth/login/route.ts:74-99` wraps the `public.admins` lookup in `if (isServiceConfigured())` — when false, execution falls through to issuing the `thriv_admin_token` cookie (`:101-118`) for **any** Supabase-verified user. `/me` (`app/api/admin/auth/me/route.ts:35-46`) and the request guard (`lib/admin-auth.ts:42-53`) skip the same check.
- **Impact:** if the service key is missing and Supabase signups are enabled, an attacker self-signs-up, logs in and holds a valid admin session for the token lifetime; data endpoints 503 until the key is restored, then the session is fully privileged.
- **Evidence:** reviewer #4 (SEC-04); coordinator note #5. (Related 403 body leaks the internal userId — fold into fix.)
- **Fix direction:** fail closed (503) when the service client is unavailable instead of skipping the check; disable public signups in Supabase; drop the userId echo. Test: Supabase dashboard → Authentication → Providers → "Allow new users to sign up".

**F-09 · P1 · Public order endpoint has no rate limit / abuse control** (SEC-05; replay oracle SEC-19) — CONFIRMED; email-replay sub-claim SUSPECTED (coordinator note #13)
- **What / where:** `app/api/orders/route.ts:116-145` — no limiter anywhere, and `sendOrderConfirmationEmail` runs unconditionally after the RPC, including the idempotent-replay branch (`place_order_rpc.sql:91-105` returns the existing order; stock decrement at `:196-198` is real per fresh key).
- **Impact:** (a) script one request per public slug with fresh keys → every 1-of-1 thrift piece zeroes out, store shows all sold out; (b) repeated identical requests with one key may re-send unlimited branded emails to a chosen address (unverified — see the test); (c) DB row/sequence pollution.
- **Evidence:** reviewer #4 (SEC-05; SEC-19); coordinator note #13 keeps the email-replay claim flagged.
- **Fix direction:** only email when the RPC actually created the order (`if (!result.idempotent)`); add rate limiting/bot protection (Vercel WAF, Upstash-style per-IP cap, or a signed checkout token) in front of `POST /api/orders`; cap items (F-48). Test: stage one order, repeat the identical body 5×, count emails.

**F-10 · P1 · `subcategory` and `is_featured` don't exist in the DB — admin values silently discarded** (DB-04 / DB-05 / DC-05 / RB-10) — CONFIRMED
- **What / where:** the add-product form collects both (`components/admin/AddProductForm.tsx:56,149,154`), the API parses `subcategory` (`app/api/admin/products/route.ts:58`) and never inserts either; no such columns exist (`supabase/migrations/20260920_initial_schema.sql:47-64`). Readers invent fallbacks (`lib/products-db.ts:24,34,62,72`).
- **Impact:** every admin-created jean becomes `straight-leg`, every tee `anime-tees` — "Baggy & Wide-Leg"/"Cargo Denim"/"Vintage Wash" chips can never match; `is_featured` is always false, so the homepage Featured merch and "featured first" sort silently lose all DB products.
- **Evidence:** reviewer #3 (DB-04, DB-05), #1 (DC-05), #2 (RB-10).
- **Fix direction:** add `subcategory TEXT` + `is_featured BOOLEAN NOT NULL DEFAULT false` via migration (index if filtered server-side), include both in insert/GET/PATCH and the seed, and stop fabricating defaults in `products-db.ts` (flag/log unknowns).

**F-11 · P1 · The 1-of-1 rule is not enforced by the database (or the API)** (DB-08 / RB-18) — CONFIRMED
- **What / where:** the only stock constraint is `CHECK (stock >= 0)` (`supabase/migrations/20260920_initial_schema.sql:58`); `PATCH /api/admin/products/[id]` copies any numeric `stock` wholesale (`app/api/admin/products/[id]/route.ts:27-31`), accepts empty bodies and leaks raw Postgres errors on negatives.
- **Impact:** a thrift "one of one" can be shown as stock 50 and double-sold; the invariant the whole business rests on lives only in client clamping (`lib/cart.ts:20-32`) and the RPC lock. Also lets admins silently break the storefront's "Stock: 1" honesty.
- **Evidence:** reviewer #3 (DB-08), #2 (RB-18).
- **Fix direction:** add `CHECK (is_merch OR stock IN (0,1))` and an upper bound for merch stock; validate `stock`/`price_pkr` server-side (integers, ranges, `is_merch`-aware); 400 on empty payloads.

**F-12 · P1 · No status-transition guards; cancel restores wrong stock; `delivered_at` never cleared** (RB-07 / DB-09) — coordinator verification #7 (restore formula), VERIFIED-SOURCE
- **What / where:** `app/api/admin/orders/[orderNumber]/status/route.ts:132-153` restores `prod.stock + (item.quantity || 1)` for merch and hard-sets `1` for thrift, for **any** prior status; `delivered_at` is only ever set (`:78-80`); the UI offers Cancel on delivered orders and confirms on cancelled ones (`components/admin/OrderDetailClient.tsx:552-584`).
- **Impact:** Delivered → Cancel restores stock for goods the customer physically has (and after F-04 the merch count is wrong anyway); Cancelled → Shipped re-zeroes; thrift cancel resurrects sold pieces; `order_events` records nonsensical paths so audit history is untrustworthy. Each click re-triggers it.
- **Evidence:** reviewer #2 (RB-07), #3 (DB-09); coordinator note #7.
- **Fix direction:** define and enforce allowed transitions server-side (`new→confirmed→shipped→delivered`; `→cancelled` only from non-terminal), mirror in the UI; make one SQL function the only writer of `products.stock`; clear or ignore `delivered_at` for non-delivered states.

**F-13 · P1 · Static seed silently shadows an empty or broken database** (DB-07 / UX P2-7) — CONFIRMED
- **What / where:** `lib/products-db.ts:6-42` falls back to the 31-product static array whenever the DB errors (catch) **or returns zero rows** (`data.length > 0` guard); client components also ignore empty API responses — `components/ShopCatalog.tsx:38-47`, `components/BrowseShopSection.tsx:27-36`.
- **Impact:** a configured-but-empty/mis-seeded/erroring DB still shows a full catalogue; checkout for those phantom slugs dies (`Product not found` → 500); a deleted-all catalog keeps rendering stale items. Failures are only a `console.warn`.
- **Evidence:** reviewer #3 (DB-07), #5 (P2-7).
- **Fix direction:** distinguish "unconfigured" (static OK) from "configured but failing/empty" (render empty + operator signal); accept `Array.isArray(data.products)` client-side; map `Product not found` to 409.

**F-14 · P1 · `isServiceConfigured()` accepts placeholders/whitespace → checkout 500 instead of fallback** (DB-10) — coordinator verification #11, VERIFIED-SOURCE
- **What / where:** `lib/supabase-server.ts:48-53` uses bare truthiness (no trim, no placeholder rejection — unlike `lib/supabase.ts:12-19`); `.env.example:5` ships `https://<project>.supabase.co`; `app/api/orders/route.ts:99` calls `getServiceClient()` outside any try/catch.
- **Impact:** copying `.env.example` verbatim (or a trailing-space URL) marks the service "configured", the RPC fails with a DNS/fetch error, checkout returns 500 and the order is lost — exactly the scenario the handover claims is impossible. Three different env-name fallback sets exist across `supabase-server.ts:21-24`, `admin-auth.ts:17-18`, `login/route.ts:32-37`, `middleware.ts:14-19`.
- **Evidence:** reviewer #3 (DB-10); coordinator note #11.
- **Fix direction:** one `getSupabaseConfig()` helper that trims, strips `/rest/v1`, rejects non-https/`<`-placeholders, exposes `configured`; use it everywhere; wrap client construction + RPC in the route's try/catch so failures degrade to the offline path.

**F-15 · P1 · Phantom seed row: `bershka-washed-black-balloon-jeans`** (DC-04 / DB-23 / RB-15) — coordinator verification #10, VERIFIED-SOURCE
- **What / where:** the seed upserts it active (`supabase/migrations/20260920_initial_schema.sql:258-262`) while code hard-excludes it twice (`lib/products-db.ts:17,45`). Admin inventory (reads DB directly) shows it live; its "View on live store" link 404s (`components/admin/AdminProductsListClient.tsx:343-350`).
- **Impact:** DB and storefront disagree by design; publish/hide toggles have no effect; a re-seed resurrects the inconsistency; the row is still orderable through the RPC.
- **Evidence:** reviewer #1 (DC-04), #3 (DB-23), #2 (RB-15); coordinator note #10.
- **Fix direction:** forward migration to delete or `is_active = false` the row, then delete both hardcoded exclusions; make `is_active` the single mechanism.

**F-16 · P1 · Product image pipeline broken: seed paths 404, fallback missing, admin placeholder missing** (UX P0-3 / DB-19 / DC-15) — coordinator verification #12 (scope refined), VERIFIED-SOURCE
- **What / where:** no `public/products/` exists (only scaffold SVGs + favicon) yet every seed row stores `/products/*-1.jpg` (e.g. `supabase/migrations/20260920_initial_schema.sql:224`); `components/ProductImage.tsx:57` tries the DB `image_url` first and otherwise builds the 404 path, falling back to a CSS tile (`:83,91-119`); admin cards render `/placeholder.png`, which also doesn't exist (`components/admin/AdminProductsListClient.tsx:257,272`).
- **Impact:** every listing without a valid uploaded image (all seeded rows, fresh deployments) shows a flat placeholder — fatal for a photo-sells-the-garment thrift brand; admin inventory shows broken images. Scope: products *lacking* `image_url`; not necessarily all live products (coordinator note #12) — verify against the live store.
- **Evidence:** reviewer #5 (P0-3), #3 (DB-19), #1 (DC-15); coordinator note #12.
- **Fix direction:** upload the real photo set and/or make seed data omit fake paths; normalize on absolute storage URLs; ship `public/placeholder.png`; render an explicit "Photo coming soon" state rather than a silent error fallback. Test: open `/shop`, count placeholder tiles; check one PDP for a product with no uploaded image.

**F-17 · P1 · Product pages are build-time SSG snapshots — price/stock/hide changes never reach them** (RB-04) — CONFIRMED (build-verified)
- **What / where:** `app/product/[slug]/page.tsx:13-17` prerenders all slugs via `generateStaticParams`; `:44` fetches once at build; `lib/products-db.ts:44-79` has no revalidation. Build output: `● /product/[slug]` with 31 static paths; nothing calls `revalidatePath` after admin edits.
- **Impact:** after a price change the PDP shows the old price (customer may owe a different amount than displayed); zeroed stock still offers "Add to Cart"; hidden items keep their old page; failures surface only at checkout.
- **Evidence:** reviewer #2 (RB-04) with build verification.
- **Fix direction:** make the segment dynamic (`export const dynamic = 'force-dynamic'` / `revalidate = 0`) or add `revalidate` + `revalidatePath('/product/[slug]')` (and `/shop`, `/`) after admin product mutations.

**F-18 · P1 · Hidden products stay viewable and add-to-cart-able until checkout** (RB-05) — CONFIRMED
- **What / where:** `getAllProducts` filters `.eq('is_active', true)` (`lib/products-db.ts:12`) but `getProductBySlug` does not (`:49-53`); only the RPC enforces availability, late (`20260920_place_order_rpc.sql:151-153`, `Product is no longer available`). Hiding is the core admin lever (`AdminProductsListClient.tsx:352-363`).
- **Impact:** a hidden item's PDP still works and Add to Cart succeeds; the customer only learns after filling the whole checkout form (409). Compounds with F-17.
- **Evidence:** reviewer #2 (RB-05).
- **Fix direction:** add `.eq('is_active', true)` in `getProductBySlug` (and filter `relatedProducts`); consider removing hidden items from the cart on load.

**F-19 · P1 · Awaited, timeout-less confirmation email can turn one order into two** (RB-08) — CONFIRMED (chain)
- **What / where:** `app/api/orders/route.ts:137-145` awaits `sendOrderConfirmationEmail` before responding; `lib/email.ts:64-94` has no `AbortSignal`; the idempotency key is `useState(() => crypto.randomUUID())` per mount (`components/CheckoutForm.tsx:66`) and the form re-enables on failure (`:202-205`).
- **Impact:** if Resend/network stalls, the order is committed but the client never gets the number; the customer reloads and resubmits with a **new** key → a second real order and double decrement (thrift stopped only by the stock check). Test: block `api.resend.com`, submit, reload, resubmit.
- **Evidence:** reviewer #2 (RB-08).
- **Fix direction:** fire-and-forget the email (`void … .catch(…)`) with a 5 s `AbortSignal.timeout`; persist the idempotency key in `sessionStorage` so reload retries reuse it.

**F-20 · P1 · Merch quick-add hardcodes size L; the server never validates size** (RB-13 / UX P1-3 / UX P2-14) — CONFIRMED
- **What / where:** `components/ProductCard.tsx:23,31-33` adds merch as `'L'` regardless of the product's `sizes` (same in `ShopTheLook.tsx:23`); `place_order` copies `selected_size` blindly (`20260920_place_order_rpc.sql:189,214`) with no membership check; the cart cannot change size (`components/CartPageClient.tsx:107-148`).
- **Impact:** a size-M customer orders an L on a final-sale (no-return) item — the single most likely post-purchase dispute; fulfilment receives an impossible size. *(RT rated P2; UX P1 — conservative P1 kept.)*
- **Evidence:** reviewer #2 (RB-13), #5 (P1-3, P2-14).
- **Fix direction:** for merch, open a size picker on the card (or route to the PDP); default to `sizes[0]` never `'L'`; validate `selected_size ∈ products.sizes` in the RPC; allow size change in the cart.

**F-21 · P1 · Dead dashboard + legacy writer are loaded traps** (DC-01 residual / DC-03 / DB-06 / DB-22 / SEC-15 / RB-19 / UX P3-1) — CONFIRMED
- **What / where:** `components/AdminDashboardClient.tsx` is unreachable (no page imports it) yet ships `MOCK_ORDERS` rendered as if real when unconfigured (`:29-68,194-202`), a hardcoded-password gate (`:218-223`, see F-02), a password sent as `x-admin-key` that no route reads (`:231-235`), and is the only consumer of `lib/supabase.ts` (`:26`) — a legacy writer targeting dropped columns (`lib/supabase.ts:110-158,204-207`) that reads `SUPABASE_SERVICE_ROLE_KEY` at module scope in a file a client component type-imports.
- **Impact:** zero runtime impact today (grep-verified dead); latent traps: re-wiring revives a plaintext gate, a price-trusting write path, and a service-key bundling hazard; the docs still call it "the admin portal". *P0 credential aspect is tracked as F-02; the dead code itself is conservatively P1 (DB-06/DC-03 rated the trap P1).*
- **Evidence:** reviewer #1 (DC-01, DC-03), #3 (DB-06, DB-22), #4 (SEC-15), #2 (RB-19), #5 (P3-1).
- **Fix direction:** delete `components/AdminDashboardClient.tsx` and `lib/supabase.ts` (keep `@supabase/supabase-js` — used elsewhere); move any needed row types to `types/db.ts`; update `PROJECT_HANDOVER.md:76,96`.

### P1 — UX (usability & accessibility)

**F-22 · P1 · Add-product defaults publish fabricated measurements** (UX P1-1) — `components/admin/AddProductForm.tsx:57,62,66-71` pre-fills `32/41/30/12 in` etc., submitted verbatim (`:159-178`) and rendered as "Exact Measurements (Inches)" on the PDP (`components/ProductDetailClient.tsx:329`) — while the no-returns consent says the listing carries exact measurements (`components/CheckoutForm.tsx:428`). An owner who changes only name/price/photo publishes wrong specs on final-sale goods. Fix: empty initial values, require measurements for the active category, show a PDP empty state when unset.

**F-23 · P1 · "Complete The Fit" arrows are dead and the copy names another product** (UX P1-2 / DC-17) — `components/ShopTheLook.tsx:57-70` renders Previous/Next buttons with no `onClick`/state; `:41-52` hardcodes a Zara+Akira look on every PDP (live via `components/ProductDetailClient.tsx:394`). Fake affordance + wrong merchandising claim. Fix: wire to `relatedProducts` or delete the arrows; derive copy from the actual product.

**F-24 · P1 · Wishlist heart is a no-op** (UX P1-4) — `components/ProductCard.tsx:39-43` toggles component-local state only (same at `components/ProductDetailClient.tsx:106-120`); no persistence, no list page, yet the button is labelled "Add to wishlist". Fix: persist (localStorage + `/wishlist`) or remove the heart until it exists.

**F-25 · P1 · No custom 404 / error / global-error pages** (UX P1-5) — zero matches repo-wide; `notFound()` fires on unknown product slugs (`app/product/[slug]/page.tsx:47`) — exactly the WhatsApp link a customer holds after a thrift piece sells out. Users see an unbranded dead-end. Fix: branded `not-found.tsx` (search + shop CTAs + WhatsApp), `error.tsx` with retry, and "similar items" handling on sold-out PDPs.

**F-26 · P1 · Confirmation page + FAQ claim an email that may never send** (UX P1-6) — `components/OrderConfirmationClient.tsx:92-95` says "Confirmation has been sent to …"; `app/faq/page.tsx:84` repeats it; but `lib/email.ts:33-38` returns `{ success: true, stub: true }` and skips the send when `RESEND_API_KEY` is unset — so the route can never react (`app/api/orders/route.ts:138-145`). Fix: return the outcome and only claim a send on real success; make copy WhatsApp-primary; make the stub `success: false`.

**F-27 · P1 · `/styleguide` is public and there is no robots.txt/sitemap.xml** (UX P1-7) — `app/styleguide/page.tsx:14-17,75-85,104` serves internal phase notes, a stale dataset count, and live Add-to-Cart buttons wired to the real cart; no `app/robots.ts`/`app/sitemap.ts` exist. Fix: 404 the route in production, add `robots.ts` (disallow `/admin`, `/api`) and a `sitemap.ts` covering shop + live product slugs — Google is the second discovery channel.

**F-28 · P1 · Checkout errors are invisible to assistive tech and off-screen** (UX P1-8 + P1-9) — `components/CheckoutForm.tsx:528-565` inputs get no `aria-invalid`/`aria-describedby` (repo-wide: 0 matches for `aria-live`/`aria-describedby`), the error paragraph has no id, nothing is announced; validation runs only in `handleSubmit` (`:118`) and the banner sits below a 7-field form (`:489-494`). No focus move to the first invalid field. Fix: per-field ids + `aria-invalid`/`aria-describedby`, `role="alert"` summary above the form, focus the first error, validate on blur.

**F-29 · P1 · WhatsApp field rejects the formats people type (and the two validators can drift)** (UX P1-10 / DC-08) — `components/CheckoutForm.tsx:17-22` and `app/api/orders/route.ts:30-35` both demand `/^(\+92|0092|0)[0-9]{10}$/` — spaces/dashes from contacts are rejected with a message that doesn't say "digits only". The duplicated regex + province list (`CheckoutForm.tsx:42-49` vs `orders/route.ts:32-45`) can drift independently. Fix: normalize input on change, accept `+92`/`92`/`0`, `inputMode="numeric"`, shared validators in one module.

**F-30 · P1 · Muted text token `#9A9A9A` fails contrast sitewide** (UX P1-11) — declared at `app/globals.css:12`, used ~120× for real copy (breadcrumbs `components/ShopCatalog.tsx:152`, card meta `components/ProductCard.tsx:108-114`, footer headings `components/Footer.tsx:83,112,141`). Computed: 2.54:1 on `#F5F3F0`, 2.36:1 on `#EDEBE8`, 2.81:1 on white (needs 4.5:1; WCAG 1.4.3). Fix: darken to ≈`#67635D` for text (keep `#9A9A9A` for hairlines only) or split text/decor tokens.

**F-31 · P1 · Zero `prefers-reduced-motion` support** (UX P1-12) — 0 matches repo-wide; live motion includes hero transitions/swipe (`components/HeroCarousel.tsx:43-51`), `animate-pulse`, `animate-spin`, `hover:scale`, smooth scroll (`components/YouMayAlsoLikeRow.tsx:17,21`). Fix: global reduced-motion media query in `app/globals.css` + conditional `scrollBy` behavior.

**F-32 · P1 · Admin focus rings are black on black** (UX P1-13) — `app/globals.css:84-88` outlines `#111111` on admin surfaces `#111111`/`#161616` = 1.00:1; WCAG 2.4.7/1.4.11. Fix: surface-scoped ring (white/light outline for admin) via a data attribute or class.

**F-33 · P1 · Mobile menu button kills its own focus ring** (UX P1-14) — `components/Header.tsx:39`: `focus:outline-none` (specificity 0,2,0) beats the global `:focus-visible` (0,1,0). Fix: delete `focus:outline-none`.

**F-34 · P1 · Custom dropdowns: no focus style and broken listbox semantics** (UX P1-15 + P1-16) — `components/admin/AdminDropdown.tsx:76-79` `outline-none` with hover-only border; both dropdowns render `role="option"` on `<button>`s inside `role="listbox"` with no arrow keys, no `aria-activedescendant`, no focus return on Escape (`components/ui/CustomDropdown.tsx:108-156`; `AdminDropdown.tsx:110-159`). Fix: add focus-visible ring; replace with native `<select>` or implement the full ARIA listbox pattern.

**F-35 · P1 · 10+ unlabelled controls in the add-product form** (UX P1-17) — `components/admin/AddProductForm.tsx:373-399` (Category/Style), `:405-435` (Brand/Condition/Stock), `:529-599` (six measurements) lack `htmlFor`/ids; only `product-name`/`product-price` are associated. Fix: ids + `htmlFor` everywhere (incl. an `id`/`ariaLabelledBy` prop for `AdminDropdown`), units in the accessible name.

**F-36 · P1 · Add-product errors show off-screen and unannounced** (UX P1-18) — `components/admin/AddProductForm.tsx:120-140` sets one banner (`:273-278`) at the top of a ~2,000px form with submit at `:639-655`; no `role="alert"`, no field marking, no scroll/focus. Fix: per-field errors + summary near submit, focus the first invalid input.

**F-37 · P1 · Admin header doesn't fit a phone** (UX P1-19) — SUSPECTED. `components/admin/AdminNavHeader.tsx:31-105` is a single non-wrapping row (~528px min-content at 375px) → horizontal page scroll. Test: DevTools 375×812 on `/admin`, assert `document.documentElement.scrollWidth <= 375`. Fix: `flex-wrap` or second row for nav below 640px.

**F-38 · P1 · Order detail is a navigation cul-de-sac** (UX P1-20) — `components/admin/OrderDetailClient.tsx:269-287` custom header has only "← Orders" + status pill: no Inventory tab, no Refresh, no Sign Out, even though this is the most-used admin screen. Fix: render `AdminNavHeader` above the content.

**F-39 · P1 · Inventory has no edit action** (UX P1-21) — `components/admin/AdminProductsListClient.tsx:342-373` offers view/toggle/delete only, while `PATCH /api/admin/products/[id]` already accepts `stock`/`price_pkr` (`app/api/admin/products/[id]/route.ts:27-31`). Fixing a typo means delete + recreate → new random-suffixed slug (`app/api/admin/products/route.ts:5-13`) → shared links break. Fix: Edit drawer reusing the form in edit mode + inline price/stock edit; extend PATCH fields.

**F-40 · P1 · Condition grades aren't explained where they're shown** (UX P1-22) — badges on PDP/cards (`components/ProductDetailClient.tsx:168`; `components/ProductCard.tsx:127`) are bare pills; the well-written definitions live only in an FAQ accordion (`app/faq/page.tsx:53-71`). Fix: one-line definition under the PDP badge + "What do grades mean?" link; legend row on the grid.

### P2 — hardening, maintenance, polish (compact)

**F-41 · P2 · Raw database errors returned to clients** (SEC-08 / DB-17) — `app/api/orders/route.ts:120-134` (anonymous!) passes `error.message` verbatim and classifies 409 vs 500 by substring (`msg.includes('Only ')`); admin routes do the same (`app/api/admin/orders/route.ts:42-44`). Anonymous callers get schema/constraint disclosure and attack iteration speeds up. Fix: map by SQLSTATE to fixed codes (`OUT_OF_STOCK`/`PRODUCT_UNAVAILABLE`/`SERVER_ERROR`), log raw detail server-side.

**F-42 · P2 · `/api/admin/auth/me` returns the raw access token** (SEC-09 / DB-21) — `app/api/admin/auth/me/route.ts:48-55` echoes the token the HttpOnly cookie exists to hide; consumed for Realtime at `components/admin/AdminOrdersListClient.tsx:215-225`. Any XSS/log/proxy capture = live admin token. Coordinator note #6, VERIFIED-SOURCE. Fix: drop `token`; proxy Realtime or shorten the session.

**F-43 · P2 · Middleware scope + deprecation + fail-open** (SEC-07 / RB-20) — coordinator note #3, VERIFIED-SOURCE. `middleware.ts:101-103` matcher `['/admin/:path*']` covers pages but **not** `/api/admin/*` (routes must self-guard — see F-01); `:25-28` fails open when env is missing; the file convention is deprecated in Next 16 (`⚠ … use "proxy" instead` in build output; rename via `npx @next/codemod@canary middleware-to-proxy .`). Fix: migrate to `proxy.ts`, fail closed, unify the auth implementation with `lib/admin-auth.ts`.

**F-44 · P2 · No login throttling/lockout/MFA** (SEC-06) — `app/api/admin/auth/login/route.ts:59-69` returns Supabase errors with no attempt counter/delay/CAPTCHA/MFA; the password is the whole security model. Only Supabase platform throttling applies. Fix: enable TOTP/MFA or email OTP; app-level throttle by IP+email; log failures (F-46).

**F-45 · P2 · No security headers** (SEC-10) — `next.config.ts` has no `headers()`; `vercel.json` none either → `/admin/login` is framable (clickjacking), no CSP containment, `X-Powered-By` on. Fix: `X-Frame-Options: DENY`, a tuned CSP with `frame-ancestors 'none'`, `Referrer-Policy`, `X-Content-Type-Options`, `poweredByHeader: false`.

**F-46 · P2 · No security-event logging/audit** (SEC-13) — failed logins are silent (`app/api/admin/auth/login/route.ts:64-68`); `verifyAdminRequest` logs only thrown errors (`lib/admin-auth.ts:59-61`); admin mutations unaudited. If F-01/F-02 were exploited there is no trace. Fix: structured logs + alarm when the guard's fallback branch is ever used; log `auth.login.*` and `admin.mutation`.

**F-47 · P2 · Logout has no server-side revocation** (SEC-12) — `app/api/admin/auth/logout/route.ts:3-15` only clears the cookie; a copied token stays valid until expiry. Fix: revoke the Supabase session (admin `signOut`) or a denylist checked by the guard; align cookie `maxAge` with real expiry.

**F-48 · P2 · Unbounded checkout schema** (SEC-11) — `app/api/orders/route.ts:21-25,58`: `items` has no `.max()`, `product_slug`/`selected_size` no `.max()` → thousands of items hold `FOR UPDATE` locks in the RPC (`20260920_place_order_rpc.sql:115-132`) and inflate the transaction. Fix: `.max(20)` items, `.max(120)`/`.max(20)` strings, per-slug dedupe before the RPC.

**F-49 · P2 · Admin product endpoints skip Zod; free text meets typed columns** (SEC-14 / DB-20) — `app/api/admin/products/route.ts:52-101` manual FormData parsing (`condition` into a Postgres enum → `22P02` → 500; `category` unconstrained; malformed `measurements` silently null) and `[id]/route.ts:27-31` `typeof` checks only. Fix: Zod unions matching `types/index.ts:5-21`, 400 with field errors, add a `CHECK` on category.

**F-50 · P2 · Idempotency race, per-mount key, replay oracle** (RB-09 / DB-11 / SEC-19) — `20260920_place_order_rpc.sql:88-105` check-then-insert with no `ON CONFLICT`/`unique_violation` handler → concurrent duplicates get a raw 500 instead of the existing order; `components/CheckoutForm.tsx:66` regenerates the key per mount so a reload retry creates a second order; the replay branch returns the order number/total (`:91-104`). CONFIRMED (code) / SUSPECTED (race window). Fix: upsert-returning or exception handler; persist the key in `sessionStorage`; return only `{ idempotent: true }` on replay.

**F-51 · P2 · `SECURITY DEFINER` without `search_path`** (DB-12 / SEC-18) — `20260920_place_order_rpc.sql:10-14` and `20260920_initial_schema.sql:133-142` (`is_admin()` backs RLS + storage policies). Schema-shadowing surface; Supabase linter flags it. Fix: `SET search_path = public, pg_temp` and schema-qualified bodies.

**F-52 · P2 · Storage orphans, over-broad grants, public listing** (DB-14) — `app/api/admin/products/[id]/route.ts:67-78` deletes the row only (no `storage.remove` anywhere); `20260921_products_storage.sql:21-24` grants ALL on `storage.objects`/`buckets` to anon/authenticated; `:68-71` lets any anon key list the bucket. Fix: delete objects on product delete/update, drop the blanket grants, scope the SELECT policy.

**F-53 · P2 · Upload failures swallowed; no server-side gate** (RB-11 / DB-15) — `app/api/admin/products/route.ts:110-157` logs upload errors and continues → product created with missing/zero images while the admin sees "Item Published!"; `file.type`/extension trusted, no 5 MB check against the bucket cap. Fix: validate size/magic bytes before upload, abort or return failed-file list; disable the button during upload.

**F-54 · P2 · Duplicate line items defeat the per-line stock check** (DB-16) — `20260920_place_order_rpc.sql:137-163` validates each JSON element independently (no per-slug aggregation), then `:185-220` decrements per element → `[{slug,1},{slug,1}]` against stock 1 passes checks and dies on `CHECK (stock >= 0)` as an opaque 500 (a legitimate 2-size merch cart triggers it). Fix: aggregate by slug, validate once, decrement once.

**F-55 · P2 · Index hygiene** (DB-18) — `20260920_initial_schema.sql:119-127` creates three indexes duplicating UNIQUE constraints; `idx_products_category`/`idx_orders_status` have no server-side consumer; the hot query `lib/products-db.ts:10-13` (`.eq('is_active')\order(created_at desc)`) is unindexed. Fix: drop redundant/unused, add `(is_active, created_at DESC)`.

**F-56 · P2 · Migrations claim "Safe to re-run" but are not** (DB-13) — `20260920_initial_schema.sql:6` vs `:208` `ALTER PUBLICATION supabase_realtime ADD TABLE orders` (errors on re-run). Fix: wrap in `DO $$ … EXCEPTION WHEN duplicate_object THEN NULL$$`, or move to tracked Supabase CLI migrations.

**F-57 · P2 · Realtime toast unannounced + `item_count: 1` hardcoded** (RB-14 / UX P2-20) — `components/admin/AdminOrdersListClient.tsx:247-261` builds realtime rows with `item_count: 1` (real count only after refresh, vs `app/api/admin/orders/route.ts:60`); the toast (`:355-387`) has no `role="status"` and self-dismisses. Fix: re-fetch the order on insert, add live-region semantics.

**F-58 · P2 · Confirmation page is localStorage-only and mixes money sources** (RB-16 / SEC-21 / UX §2.6) — `components/OrderConfirmationClient.tsx:44` reads only `localStorage` (cross-device/private-mode/shared WhatsApp link = bare "Order received" page, no re-send); `components/CheckoutForm.tsx:177-189` stores client items/subtotal/delivery but the server total, so line math can contradict the Total after a price change; the snapshot persists customer PII indefinitely (no TTL). Fix: render confirmation from server data (add an order-lookup by number with minimal fields), short TTL on the snapshot.

**F-59 · P2 · Documentation drift** (DC-16 / UX P3-7) — `PROJECT_HANDOVER.md:76,80,82,96,100,126` documents dead files as live (dead dashboard, `lib/supabase.ts`, `schema.sql`, the leaked password) and wrong counts (32 vs 31 products); `README.md:33,41` lists a removed home section and the orphaned `/styleguide`; `data/products.ts:5,662` and `app/styleguide/page.tsx:77,84` carry stale counts. Fix: one documentation pass after deletions land.

**F-60 · P2 · `PAYMENT_LABELS` ×4, `STATUS_CONFIG` ×2** (DC-07) — `components/OrderConfirmationClient.tsx:9`; `components/admin/OrderDetailClient.tsx:70,111`; `components/admin/AdminOrdersListClient.tsx:53,94`; dead `AdminDashboardClient.tsx:141`. Fix: extract `lib/orderLabels.ts`.

**F-61 · P2 · Duplicated row→Product mapping** (DC-10) — `lib/products-db.ts:16-35` vs `:56-73` (same 18 fields; the bershka hack is applied twice). Fix: one `mapRowToProduct(row)`.

**F-62 · P2 · Delivery fee in two code paths + prose in 10+ places** (DC-11) — `lib/cart.ts:4` (`FLAT_DELIVERY_FEE = 200`) vs `20260920_place_order_rpc.sql:37` (`v_delivery_fee := 200`) vs prose (`app/page.tsx:274,277`; `components/ShopCatalog.tsx:344`; `components/ProductDetailClient.tsx:309,317`, etc.). No mismatch today (RT refuted; DB agrees) — the risk is silent drift if only one side changes. Fix: single source (return the DB value to the client or ship one shared constant with a migration comment).

**F-63 · P2 · Parallel UI layers / orphaned styleguide design system** (DC-09 / DC-14 / UX P3-2) — checkout reimplements `FieldGroup`/`inputClass` (`components/CheckoutForm.tsx:528,537`) while `components/ui/FormFields.tsx` is consumed only by `app/styleguide/page.tsx:6`; `FilterChip` has zero real uses (`:5`); `/styleguide` has no inbound link anywhere. Fix: pick one home for primitives; decide the styleguide's fate (flag it off / delete) as part of F-27.

**F-64 · P2 · Sold-out state computed and discarded** (DC-12) — `components/CartPageClient.tsx:61` `const isSoldOut = item.product.stock <= 0;` never rendered; users only learn at the server RPC (`'This piece has just sold out'`). Fix: render the badge/CTA state (or delete the variable).

**F-65 · P2 · Lint is red and unenforced** (DC-18) — `package.json:9` bare `"lint": "eslint"`; `npx --no-install eslint .` → 70 problems (41 errors: 28 `no-explicit-any`, 25 unused vars, 7 set-state-in-effect, 5 rules-of-hooks, 2 exhaustive-deps, 1 no-img-element, 1 no-unused-expressions, 1 refs-during-render; 29 warnings). No CI (`.github/**` absent). Fix: real lint script, CI gate, burn-down.

**F-66 · P2 · No OG/Twitter images** (UX P2-1) — `app/layout.tsx:16-28` and `app/product/[slug]/page.tsx:31-39` set no images/card; WhatsApp — the primary sharing channel — renders bare text links. Fix: `opengraph-image.tsx` + per-product image, `twitter: summary_large_image`.

**F-67 · P2 · Three dropdown implementations** (UX P2-2) — `CustomDropdown` vs `AdminDropdown` vs native select (`components/CheckoutForm.tsx:313-323`); only the native one is accessible; radii/heights differ. Fix: converge on styled native `<select>` (or one accessible popover).

**F-68 · P2 · Tokens declared then ignored** (UX P2-3) — `app/globals.css:6-44` defines ~20 tokens; `text-muted`/`bg-card`/`border-border`/`shadow-card` used 0 times while ~1,100 hex literals live in 38 files (e.g. `ProductDetailClient.tsx` 75, `CheckoutForm.tsx` 70). Fix: mechanical migration to token utilities.

**F-69 · P2 · `#666666` invented on `/contact`** (UX P2-4) — `app/contact/page.tsx:54,81,105,119,136`; `#444444` exists for body copy (5.7:1 → 8.8:1 if replaced). Fix: replace.

**F-70 · P2 · No live regions for cart/filter changes** (UX P2-6) — zero `aria-live`/`role="status"` in the repo; add-to-cart, removals, quantity and result counts are silent for screen readers (`components/CartPageClient.tsx:118-153`; `components/ShopCatalog.tsx:180-182`). Fix: one `sr-only` polite live region per surface.

**F-71 · P2 · No social proof for an Instagram brand** (UX P2-8) — no reviews/UGC/IG feed; only an artificial dot row (F-72). Fix: embed real IG posts, add a post-purchase review path (never invent numbers).

**F-72 · P2 · Fake rating dots** (UX P2-9) — `components/ProductCard.tsx:192-202`, `components/ShopTheLook.tsx:125-136`: 4-of-5 filled dots under labels like "Disinfected & Handpicked", `aria-hidden` — reads as a broken 4.0 score. Fix: delete or replace with the real condition badge.

**F-73 · P2 · Sub-44px touch targets** (UX P2-10) — hero dots 6px (`components/HeroCarousel.tsx:74-75`), arrows 36px (`:124,132`), card heart 32px (`components/ProductCard.tsx:72`), card CTA ~28px (`:164`), cart remove ~24px (`components/CartPageClient.tsx:101`), steppers 28px (`:128-146`), admin icon buttons ~30px (`components/admin/AdminProductsListClient.tsx:347-371`). Fix: min 44px hit areas.

**F-74 · P2 · WhatsApp FAB overlap + safe area** (UX P2-11) — SUSPECTED. `components/WhatsAppFAB.tsx:25` `fixed bottom-6 right-6` ~170px wide sits over the right edge of full-width CTAs on cart/checkout/confirmation; ignores `env(safe-area-inset-bottom)`. Test: 375×812 on `/checkout`, scroll to the bottom, `elementFromPoint(btnRight-20, btnCenterY)` → expect the FAB. Fix: safe-area inset + icon-only FAB on those screens.

**F-75 · P2 · FAB message generic on PDPs** (UX P2-12) — `components/WhatsAppFAB.tsx:14` sends "Hello Thriv! I have a question about an item." everywhere; the highest-intent leads come from PDPs. Fix: include brand/name/size/condition from the pathname.

**F-76 · P2 · No self-measuring guide** (UX P2-13) — `components/ProductDetailClient.tsx:370-372` says only "Compare against a pair you currently own." Fix: collapsible 4-step guide + FAQ link.

**F-77 · P2 · `alert()`/`confirm()` for all admin feedback** (UX P2-15) — `components/admin/OrderDetailClient.tsx:195,201,221,226,575`; `components/admin/AdminProductsListClient.tsx:82,89,97,109,114`; success gives no confirmation. Fix: in-app toast (`role="status"`) + inline error card.

**F-78 · P2 · Fulfilment actions not sequenced** (UX P2-16) — `components/admin/OrderDetailClient.tsx:506-586` shows all actions flat; "Mark Delivered" is the biggest button even for a brand-new order (fat-finger risk). Fix: show only the next action per state, others behind "More actions"; add a stepper.

**F-79 · P2 · No tracking-number field** (UX P2-17) — confirmation + FAQ promise a courier tracking number (`components/OrderConfirmationClient.tsx:156`; `app/faq/page.tsx:26`) but the admin has nowhere to store/send one (`components/admin/OrderDetailClient.tsx:266-630`). Fix: `tracking_number`/`courier` + WhatsApp deep link.

**F-80 · P2 · Heading-level skips** (UX P2-18) — home `h1→h3` (`app/page.tsx:66,95`), cart item names h3 before the h2 summary (`components/CartPageClient.tsx:91,163`), PDP (`components/ProductDetailClient.tsx:328,379`), footer starts at h4 (`components/Footer.tsx:25`). Fix: add/rename levels; axe "heading-order".

**F-81 · P2 · Admin dark-surface contrast** (UX P2-19) — `text-neutral-500` (#737373) on `#161616`/`#111111` = 3.82:1/3.98:1 for 10–12px text (`components/admin/OrderDetailClient.tsx:433,614`; `components/admin/AdminOrdersListClient.tsx:441,485`). Fix: `text-neutral-400` (#a3a3a3 → 7.17:1) for informational text.

### P3 — nits (grouped bundles)

- **F-82 · Security nits:** cookie hardening (`__Host-` prefix, no 7-day fallback maxAge — `app/api/admin/auth/login/route.ts:110-118`); `remotePatterns` allows **any** `**.supabase.co` host (`next.config.ts:5-10`); attacker-controlled name/address interpolated into confirmation emails (`lib/email.ts:40-62`), amplified by F-09.
- **F-83 · DB scale hygiene:** no `updated_at` on real `products`/`orders` while dead `lib/supabase.ts:206` writes it; global `THR-` sequence format (`20260920_initial_schema.sql:34,69-70`); admin list endpoints fetch all rows with no pagination (`app/api/admin/orders/route.ts:23-40`, `app/api/admin/products/route.ts:27-30`) — fine at 32 rows, not at 2,000.
- **F-84 · Dead-code deletion bundle:** dead `handleSignOut` + unused `LogOut` (`components/admin/AdminOrdersListClient.tsx:11,291-297`); 25 unused vars/imports (`app/admin/login/page.tsx:6-7`; `app/styleguide/page.tsx:5,7`; `lib/cart.ts:1`; … full list in 1-dead-code.md DC-19); no-op `EXCEPTION … RAISE` block (`20260920_place_order_rpc.sql:233-237`); dead exports `getProductsByCategory`/`getFeaturedProducts` (`data/products.ts:766,771`); 5 unreferenced scaffold SVGs (`public/*.svg`).
- **F-85 · Config nits:** duplicate `.vercel` ignore (`.gitignore:37,43`); `target: ES2017` + `allowJs` scaffold leftovers (`tsconfig.json:3,5`, SUSPECTED); inert `cleanUrls` (`vercel.json:4`, SUSPECTED); **`graphify-out/` is the codebase knowledge graph — do NOT delete; add it to `.gitignore` only** (harmless today: untracked, ~780 KB); ternary-as-statement (`components/HeroCarousel.tsx:49`); stale `OrderStatus` union `'pending'|…` vs DB enum `'new'|…|'cancelled'` (`types/index.ts:91` vs `20260920_initial_schema.sql:17`, also RB-17 / UX P3-11).
- **F-86 · UX polish bundle:** dead Tailwind classes (`animate-in`, `fade-in`, `zoom-in-95`, `scrollbar-none` — not in Tailwind v4 core, no plugin: `components/Header.tsx:129`, `components/ui/CustomDropdown.tsx:112`, `components/admin/AdminDropdown.tsx:113`); public "Admin Portal" footer link (`components/Footer.tsx:132-134`, also F-06's trigger); payment-method list drift (`components/Footer.tsx:144-160` vs disabled card radio `components/CheckoutForm.tsx:52-58`); currency/format drift (`components/admin/AddProductForm.tsx:456,460` vs `lib/formatPrice.ts:6`); spaced en dashes on `/contact` (`app/contact/page.tsx:123`); mobile header a11y details (icon-only submit without label, no `aria-expanded`, no Escape close — `components/Header.tsx:112-119,149-154,161-213`); shop page lacks its own search input (`components/ShopCatalog.tsx:55,252-266`); admin login page inherits the storefront title (`app/admin/login/page.tsx:1`).

## 5. Cross-lens agreement matrix

Independently found by multiple reviewers (strongest credibility signal). "Coordinator" = also re-verified against source during consolidation.

| Defect | Reviewers | Merged as |
|---|---|---|
| Admin auth fail-open (any token = admin) | Security (SEC-01), DB (DB-02), Runtime (RB-02) + Coordinator | F-01 |
| Admins-check skipped without service key | Security (SEC-04), Security (SEC-01b), DB (DB-02) + Coordinator | F-08 |
| `schema.sql` permissive RLS + handover instruction | DB (DB-01), Security (SEC-03), Dead code (DC-02), Runtime (RB-03) + Coordinator | F-03 |
| Stock zeroed on shipped/delivered | DB (DB-03), Runtime (RB-01), UX (P0-4) + Coordinator | F-04 |
| Header hooks-order crash | UX (P0-1), Dead code (DC-06) + Coordinator | F-06 |
| Checkout hydration bounce | UX (P0-2, P2-5), Runtime (RB-12) + Coordinator | F-07 |
| Offline fake-order 201 | Runtime (RB-06), UX (P0-5) | F-05 |
| `subcategory`/`is_featured` missing | DB (DB-04, DB-05), Dead code (DC-05), Runtime (RB-10) | F-10 |
| Phantom `bershka-…` seed row + hardcoded filters | Dead code (DC-04), DB (DB-23), Runtime (RB-15) + Coordinator | F-15 |
| Dead dashboard with password + `x-admin-key` + mocks | Dead code (DC-01), Security (SEC-02, SEC-15), Runtime (RB-19), DB (DB-22), UX (P3-1) | F-02 + F-21 |
| Product images missing / broken fallback | UX (P0-3), DB (DB-19), Dead code (DC-15) + Coordinator (scope nuance) | F-16 |
| Status transitions unguarded / cancel arithmetic | Runtime (RB-07), DB (DB-09) + Coordinator | F-12 |
| Idempotency race + key lost on reload (+ replay oracle) | Runtime (RB-09), DB (DB-11), Security (SEC-19) | F-50 |
| Raw DB errors to clients | DB (DB-17), Security (SEC-08) | F-41 |
| Upload failures swallowed | Runtime (RB-11), DB (DB-15) | F-53 |
| `/me` returns raw token | DB (DB-21), Security (SEC-09) + Coordinator | F-42 |
| `SECURITY DEFINER` search_path | DB (DB-12), Security (SEC-18) | F-51 |
| Middleware matcher/deprecation | Security (SEC-07), Runtime (RB-20) + Coordinator | F-43 |
| 1-of-1 not enforced | DB (DB-08), Runtime (RB-18), Security (SEC-14 partial) | F-11 |
| Static seed shadows empty DB | DB (DB-07), UX (P2-7) | F-13 |
| Stale `OrderStatus` union | Runtime (RB-17), UX (P3-11) | F-85 |
| Dead/duplicated UI layers + styleguide orphan | Dead code (DC-09, DC-14), UX (P3-2) | F-63 |
| Duplicated admin form fields dropped | Dead code (DC-05), Runtime (RB-10), DB (DB-04/05) | F-10 |

## 6. Refuted / non-issues + unverified-but-plausible (with live tests)

### Refuted — do not "fix" (verified during review)

1. **"/styleguide uses `useSearchParams` without Suspense → build fails"** — refuted. `app/styleguide/page.tsx:95-97` wraps `CategoryFilterRow` in `<Suspense>`; `next build` completed (`✓ Generating static pages (51/51)`).
2. **"Price validation mismatch (form vs DB CHECK 999–2499)"** — refuted. `supabase/migrations/20260921_products_storage.sql:58-59` drops that constraint; API (`route.ts:76`) and form (`AddProductForm.tsx:133`) both require > 0.
3. **"Client prices trusted in checkout"** — not present. `place_order` recomputes from locked rows (`20260920_place_order_rpc.sql:134-165`); the payload carries no prices (`app/api/orders/route.ts:21-63`).
4. **"Province enum mismatch client vs DB"** — not present. `province TEXT NOT NULL`; client list and zod enum match.
5. **"Delivery fee mismatch"** — no mismatch today (200 == 200 == 200); the remaining risk is duplication → tracked as F-62.
6. **"Cart stock rules wrong"** — reducer clamps correctly (`lib/cart.ts:16-18,20-32,42,87`); the RPC's `FOR UPDATE` check covers the variant edge.
7. **"All live products render placeholder images"** — refined: only rows without a valid `image_url` (coordinator note #12). Seed/static paths do 404; live admin-uploaded products may be fine → F-16, test below.

### Unverified but plausible — exact owner-run tests

| Finding | Test | Safe outcome | Bad outcome |
|---|---|---|---|
| F-01 fail-open live state | `curl -i -H "Cookie: thriv_admin_token=probe" https://thriv-five.vercel.app/api/admin/orders` (read-only) | `401` → config OK today; still fix the fail-open | `200` + orders → treat as an incident (PII readable, mutations writable): rotate keys, audit `order_events`, check Supabase logs |
| F-02 password reuse | One login attempt with `thriv2026` + admin email (owner-authorised), or check Supabase Auth users; `git log -p --all -S thriv2026` | login rejected → still rotate, password is public | login accepted → full compromise; rotate + review sessions |
| F-03 deployed RLS | On a scratch project (or with owner sign-off): run `schema.sql`, then `curl "<url>/rest/v1/orders?select=order_number,customer_name,customer_phone&limit=1" -H "apikey: <anon>"` | `permission denied`/42501 → migration policies live | rows returned → drop the five policies, re-apply migration, rotate anon key |
| F-08 signups | Supabase Dashboard → Authentication → Providers → "Allow new users to sign up" | disabled → precondition removed | enabled → disable + rotate keys |
| F-09 email replay | Stage: `POST /api/orders` once with a test email + key, repeat the identical body 5×, count emails | 1 email (or 0 if unset) | 5 emails → add `if (!result.idempotent)` guard + rate limit |
| F-16 live image scope | Open `/shop` and one PDP; count flat placeholder tiles; check a product with no `image_url` | real photos → cosmetic gap only | placeholders → upload photo set, fix seed (F-16) |
| F-37 admin header | DevTools 375×812 on `/admin`; assert `document.documentElement.scrollWidth <= 375` | fits | horizontal scroll → add `flex-wrap`/`overflow-x-auto` |
| F-74 FAB overlap | 375×812 on `/checkout`, scroll to bottom, `document.elementFromPoint(btnRight-20, btnCenterY)` | button | FAB → safe-area + icon-only FAB |
| F-50 concurrency | Two parallel `POST /api/orders` with the same key | two 201s, same order number | 1×201 + 1×500 raw duplicate-key error → fix RPC |
| F-07 runtime | Add an item, open `/checkout`, hit F5 | stays on checkout | lands on `/cart` → expose `isHydrated` |

Coordinator note #13 remains open only for the email-replay sub-claim of F-09; everything else above was either verified statically (F-01, F-03, F-07, F-08, F-12, F-14, F-15, F-16, F-42, F-43) or is a live-state question by nature.

## 7. Suggested fix batches (in order)

**B1 — Security P0s (fail-open auth variants, rotation, RLS/schema.sql).** Closes: F-01, F-02, F-03, F-08, F-42, F-43. Fail closed + one env helper + unit test; rotate the Auth password (and anon/service keys if F-01/F-03 tests were bad); delete/relocate `schema.sql` + fix the handover; drop the token echo; migrate `middleware.ts`→`proxy.ts` while touching the guard. **Effort: M (~1 day with verification).**

**B2 — Data-integrity P0s (stock zeroing, transition guards).** Closes: F-04, F-11, F-12, F-54. Remove stock writes from the status route; one SQL function as the only stock writer; transition state machine server-side + UI; 1-of-1 CHECK + PATCH validation; per-slug aggregation in the RPC. **Effort: M (half-day to a day, needs a scratch DB to test transitions).**

**B3 — Purchase-path P1s.** Closes: F-05, F-07, F-09, F-13, F-14, F-17, F-18, F-19, F-20, F-28, F-29, F-58. Fail loudly instead of fake success (F-05) and when the DB/API is unhealthy (F-13/F-14); fix the hydration gate (F-07); PDP freshness + `is_active` filter (F-17/F-18); email timeout + key persistence + no-replay-send + rate limit (F-19/F-09); size picker + server-side size validation (F-20); checkout a11y + phone normalization (F-28/F-29); server-sourced confirmation (F-58). **Effort: M–L (~2–3 days).**

**B4 — Dead-code / data-truth cleanup.** Closes: F-10, F-15, F-16, F-21, F-59, F-60, F-61, F-62, F-63, F-64, F-65, F-84, F-85. Delete the dead dashboard + legacy writer; forward migrations for `subcategory`/`is_featured` + balloon-jeans row; ship real photos/placeholder + normalize image storage; single-source constants/labels/mappers; docs pass; lint script + CI; `graphify-out/` → `.gitignore` only. **Effort: M (1–2 days, mostly mechanical + one migration).**

**B5 — UX / a11y pass.** Closes: F-22, F-23, F-24, F-25, F-26, F-27, F-30, F-31, F-32, F-33, F-34, F-35, F-36, F-37, F-38, F-39, F-40, and P2/P3 UX: F-66 … F-81, F-86 (F-28/F-29 close in B3). Fix the two contrast failures, reduced-motion, focus rings, dropdown semantics, labels, not-found/error pages, take `/styleguide` down + robots/sitemap, inventory Edit, fabricated-default removal, OG images, touch targets, admin feedback polish. **Effort: L (~1 week, can be split into two sprints).**

**B6 — Remaining security/DB hardening.** Closes: F-41, F-44, F-45, F-46, F-47, F-48, F-49, F-50, F-51, F-52, F-53, F-55, F-56, F-57, F-82, F-83. Error mapping by SQLSTATE, throttling/MFA, headers/CSP, logging, revocation, checkout caps, Zod on admin endpoints, idempotent upsert, `search_path`, storage cleanup, upload gate, index cleanup, re-runnable migrations, realtime fixes, P3 bundles. **Effort: L (~3–5 days).** *(F-57 could ride with B4 instead; listed here for its runtime fix.)*

## 8. Appendix

**Tool results (consolidation runs, read-only):**
- `npx --no-install eslint .` → 70 problems (41 errors, 29 warnings). Breakdown: 28 `@typescript-eslint/no-explicit-any`, 25 `no-unused-vars`, 7 set-state-in-effect errors, 5 `react-hooks/rules-of-hooks`, 2 `react-hooks/exhaustive-deps`, 1 `@next/next/no-img-element`, 1 `no-unused-expressions`, 1 refs-during-render error. Full output: `audit/eslint-full.txt`.
- `tsc` — clean (reviewer #2 also reports TypeScript clean from `next build`).
- `npx next build` — succeeds; 51 routes; `● /product/[slug]` SSG with 31 prerendered paths (per reviewer #2's captured output; not re-run during consolidation to avoid touching the working tree).
- Reference/export scans: `audit/refscan-report.txt` (+ `refscan.mjs`, `exportscan.mjs`, `symscan.mjs`, `importscan.mjs`); DB inspection helper `inspect_db.py`; live feed logs `live-feed.log` / `live_feed.py` (from the original review sessions).

**Raw report paths:**
- Reviewer 1 (dead code): `C:/Users/InaequoSolutions-PC/AppData/Local/Temp/opencode/audit/1-dead-code.md`
- Reviewer 2 (runtime): `.../2-runtime-bugs.md`
- Reviewer 3 (database): `.../3-database.md`
- Reviewer 4 (security): `.../4-security.md`
- Reviewer 5 (UX): `.../5-ux.md`

**Coverage note:** every UXR/DB/RT/DC/SEC raw finding appears in this document — either as a merged F-### entry (section 4) or, for refuted candidates, in section 6. If a fix is scheduled, read the raw report entry for that lens ID for the full evidence trail; this file is the ranked, deduplicated, actionable layer.

