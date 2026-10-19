# Project Handover & Complete Context: Thriv E-Commerce Platform

This document contains the complete history, architectural decisions, credentials, live links, and business configurations for the **Thriv (`@thriv.pk`)** e-commerce platform. **Paste this file into any new AI session** (or point the session at its path) — and have it read [`FIX_LOG.md`](./FIX_LOG.md), the detailed change log, as well. Everything below is current **as of Batch B9 (2026-10-18)**; if `git log` shows newer batches, read `FIX_LOG.md` for what changed.

> **Security note (2026-10-17):** A full audit was run and the fixes are logged in [`FIX_LOG.md`](./FIX_LOG.md). The admin password that used to live in this file has been rotated and must never be committed again; Supabase env keys are set in Vercel, not in the repo.
> **Security note (2026-10-18):** Deep hardening pass (Batch B7) — admin TOTP MFA (aal2-only sessions), token-based order links, DB-backed rate limits, Turnstile, upload re-encoding, hardened headers. See `FIX_LOG.md` → Batch B7 for owner actions.
> **Security note (2026-10-18, later):** Admin MFA is **temporarily disabled** on owner request — simple password login. Everything else (Turnstile, throttles, rate limits) stays active. Re-enable by flipping `ADMIN_MFA_ENABLED` in `lib/admin-mfa-config.ts` — see `FIX_LOG.md` → Batch B8.
> **Feature note (2026-10-18, latest):** Order-confirmation emails are **live via Resend** (Batch B9) — API key installed, verified end-to-end. Customer delivery activates the moment a sending domain is verified in Resend; until then the confirmation page keeps its WhatsApp-primary copy. See `FIX_LOG.md` → Batch B9.

---

## 1. Project Overview & Business Profile

- **Brand**: Thriv (`@thriv.pk`)
- **Location**: Karachi, Pakistan
- **Client / Owner**: Hassan Raza (Hasan Bhai)
- **Niche**: Curated vintage/thrift branded denim and in-house anime graphic tees.
- **Core Product Categories**:
  1. **Curated Jeans (Thrift 1-of-1)**: Handpicked branded denim (Zara, Bershka, Calvin Klein, H&M, Old Navy). Each piece is strictly 1-of-1 (stock = 1, quantity locked to 1) with specific waist × inseam measurements, condition grades (Premium, Excellent, Very Good), and wash types.
  2. **Graphic T-Shirts (In-House Merch)**: Heavyweight anime tees (Akira, Evangelion, Berserk, Cowboy Bebop). Available in sizes S, M, L, XL with batch stock.
- **Key Business Policies**:
  - **Nationwide Delivery**: Flat Rs 200 across Pakistan.
  - **Final Sale Policy**: Strictly no returns or exchanges on vintage 1-of-1 pieces (prominently displayed on PDP, Cart, Checkout, and Confirmation).

---

## 2. Live Links, Repositories & Credentials

| Resource | Value / Link |
| :--- | :--- |
| **Live Storefront** | [https://thriv-five.vercel.app](https://thriv-five.vercel.app) |
| **Admin Portal** | [https://thriv-five.vercel.app/admin](https://thriv-five.vercel.app/admin) |
| **Admin Access** | Supabase Auth email + password (`admin@thriv.pk`). TOTP MFA is built and switchable (`lib/admin-mfa-config.ts`); it was **temporarily disabled** on 2026-10-18 on the owner's request, so login is currently password-only (see `FIX_LOG.md` → Batch B8). The password is **not** stored in this repo (it leaked here once and was rotated 2026-10-17); it lives with the owner. |
| **GitHub Repository** | [https://github.com/KhubaibAhmed0/Thriv](https://github.com/KhubaibAhmed0/Thriv) (Branch: `main`) |
| **GitHub User / Email** | `KhubaibAhmed0` / `khubbiahmed@gmail.com` |
| **Vercel Account** | `khubaibvalopro-8402` (`khubaibvalopro@gmail.com`) |
| **Vercel Project** | `khubaibvalopro-8402/thriv` — plan **Hobby (free)**; API: project `prj_QQiuoHK6wEVcSVrzbQWKSDvKUa9t`, team `team_IJwcF3Bw7JVwJMnMRG0EPLzs` |
| **Supabase Project** | `Thriv` (ref `bsprovqalduuagsagjxh`, region `ap-southeast-1`). Env keys live in Vercel (Production + Preview). |
| **Email (Resend)** | Account inbox `thriv.str@gmail.com`. Sending-only API key installed in Vercel (Production + Preview, encrypted); order-email sending verified live 2026-10-18. Customer delivery switches on when a sending domain is verified — see §7 / `FIX_LOG.md` → Batch B9. |
| **Domain** | **Not purchased yet** (as of 2026-10-18). Store currently runs on `thriv-five.vercel.app`. |

### Client Payment & Contact Details:
- **Bank**: Faysal Bank
- **Account Title**: `HASSAN RAZA`
- **IBAN**: `PK05FAYS3605301000003020`
- **WhatsApp**: `03248188616` (Display: `0324-8188616`, URL: `https://wa.me/923248188616`)
- **Instagram**: `@thriv.pk`

---

## 3. Technical Architecture & Tech Stack

- **Framework**: Next.js 16.4.2 (Turbopack, App Router)
- **UI & Styling**: React 19, Tailwind CSS v4, Lucide Icons
- **Form & Data Validation**: Zod (`^4.6.5`)
- **Database**: Supabase PostgreSQL (`@supabase/supabase-js`) — the database is the single source of truth for products and orders. Orders fail closed: an unconfigured or unavailable backend returns HTTP 503 instead of fabricating a confirmation (audit F-05); the static seed array only backs the local-dev catalogue.
- **Admin Auth**: Supabase Auth (email + password) plus an `admins` table membership check; TOTP MFA is switchable via `lib/admin-mfa-config.ts` (**currently disabled** — 2026-10-18 owner request; when enabled, the cookie is only issued after an `aal2` session, via a signed 5-minute login ticket between steps). All `/admin` pages are guarded by `proxy.ts`; all `/api/admin/*` routes self-guard via `lib/admin-auth.ts`. Both **fail closed**.
- **Project Directory**: `C:\Users\InaequoSolutions-PC\OneDrive\Desktop\hasan bhai project\thriv`

---

## 4. Key Files & Components Breakdown

```
thriv/                                # repo root — local path in §3; git branch `main`
├── app/                              # Next.js App Router
│   ├── page.tsx                      # Landing (Hero, Categories, Featured Drops, Trust Badges)
│   ├── shop/, product/[slug]/, cart/, checkout/, wishlist/, about/, faq/, contact/
│   ├── order/[publicToken]/          # Order confirmation (unguessable token) — WhatsApp CTA + payment steps
│   ├── admin/                        # page.tsx (orders dashboard), products/, products/new/, login/, orders/[orderNumber]/
│   ├── layout.tsx, globals.css, error.tsx, not-found.tsx, sitemap.ts, robots.ts, opengraph-image.tsx
│   └── api/
│       ├── products/route.ts         # Public catalogue
│       ├── orders/route.ts           # Order creation (Zod, Turnstile, honeypot, rate limits, place_order RPC)
│       ├── orders/[publicToken]/route.ts   # Order lookup by unguessable token (rate-limited)
│       └── admin/…                   # auth login/logout/me/mfa-verify; orders list/detail/status; products CRUD+uploads
├── components/
│   ├── Storefront: CheckoutForm, OrderConfirmationClient, CartProvider, CartPageClient, ShopCatalog,
│   │   CategoryFilterRow, ProductCard, ProductDetailClient, ProductImage, HeroCarousel, Header, Footer,
│   │   WhatsAppFAB, Wishlist*, ShopTheLook, YouMayAlsoLikeRow, BrowseShopSection, **TurnstileWidget** (submit-gating contract)
│   ├── admin/  AdminOrdersListClient, AdminProductsListClient, OrderDetailClient, AddProductForm, AdminDropdown, AdminFeedback, AdminNavHeader
│   ├── home/   HomeEditorial, HomeMedia, HomeProducts
│   └── ui/     Badge, CustomDropdown (custom pill popovers replace native <select>)
├── lib/
│   ├── Security core: api-guard.ts (Turnstile + honeypot + DB rate limits), admin-auth.ts, admin-cookie.ts,
│   │   admin-ticket.ts (signed MFA ticket), admin-mfa.ts, **admin-mfa-config.ts (MFA on/off switch)**, admin-login-throttle.ts,
│   │   security-log.ts, log.ts, audit.ts, errors.ts, order-errors.ts, validation.ts
│   ├── Data: supabase-env.ts, supabase-server.ts (service-role client, server-only), products-db.ts,
│   │   currentProduct.ts, admin-product-schema.ts
│   └── Misc: **email.ts (Resend)**, orderLabels.ts, formatPrice.ts, site-url.ts, cart.ts, useQuickAdd.ts
├── security/
│   ├── attack-tests/                 # run.mjs (39 checks), setup.mjs/teardown.mjs (fixtures), totp.mjs/totp-cli.mjs,
│   │                                 # probe-nofactor-login.mjs (MFA-path probe), last-run.md / last-run-prod.md (saved runs)
│   └── plan-phase3-4.md
├── supabase/
│   ├── migrations/                   # Authoritative SQL — apply in filename order (see §7 operational notes)
│   └── README.md
├── scripts/                          # check-admin-guard.ts, check-homepage.mjs (smoke checks)
├── data/products.ts                  # Static seed catalogue (31 products; live site reads Supabase)
├── types/index.ts                    # Shared TypeScript types
├── proxy.ts                          # Next 16 proxy (successor of middleware.ts) — fail-closed /admin page guard
├── .github/workflows/ci.yml          # CI (build/checks on push)
├── AGENTS.md / CLAUDE.md             # Agent instructions (Next.js 16 rules, harness notes)
├── AUDIT_REPORT.md                   # 2026-10-17 audit findings (historical record)
├── FIX_LOG.md                        # ← detailed change log, batches B1–B9 — READ THIS FIRST
├── PROJECT_HANDOVER.md               # ← this file
└── vercel.json, next.config.ts, tsconfig.json, eslint.config.mjs, postcss.config.mjs, package.json
```

---

## 5. Scope Changes & Resolved User Directives

During development, the following specific adjustments were made per user request:
1. **Removed "Flat Rs 200" Badge from Hero Banner**: Cleaned up the landing hero visual per request.
2. **Removed "Ghost in the Shell" Tee**: Reduced anime tees from 5 to 4 designs (Akira, Evangelion, Berserk, Cowboy Bebop).
3. **Custom Filter Dropdowns**: Replaced native browser `<select>` tags on `/shop` with custom styled pill popovers (`CustomDropdown.tsx`) with condition grade color dots (`#5A4A2F`, `#1E3A5F`, `#2E5E2E`).
4. **Real Client Credentials**: Replaced dummy payment details with Hasan Bhai's real Faysal Bank IBAN and WhatsApp.
5. **Admin Portal (`/admin`)**: Built an admin portal backed by Supabase Auth (email + password) featuring:
   - Sales & order count metrics, plus product management (add product with photo upload, activate/hide, price and stock editing).
   - Status filters (`New`, `Confirmed`, `Shipped`, `Delivered`, `Cancelled`).
   - **1-Click WhatsApp Direct Chat**: Generates a pre-filled WhatsApp message with the customer's name, order items, total, and delivery address for instant order confirmation.
6. **Supabase Database with Graceful Fallback**: Created the SQL migrations under `supabase/migrations/` (authoritative) — see §7. If Supabase keys are missing, checkout fails closed with a clear "temporarily unavailable" message (HTTP 503) — an order is never fabricated or silently lost (audit F-05). Customers can always reach the store on WhatsApp (0324-8188616). **Warning:** an older legacy `supabase/schema.sql` (it granted the public anon key read access to every order) was deleted during the 2026-10-17 security pass. Never re-add or run SQL that creates `USING (true)` policies on `orders`.

---

## 6. Critical Technical Rules for Future Development

- **Git Commit Author**:
  Vercel Hobby tier blocks deployments (`seatBlock: TEAM_ACCESS_REQUIRED`) if commits are made by any email other than the account owner. Always ensure:
  ```bash
  git config user.name "KhubaibAhmed0"
  git config user.email "khubbiahmed@gmail.com"
  ```
- **Vercel Deployments & `.vercelignore`**:
  `.vercelignore` must always exclude `.next`, `.git`, and `node_modules`. This keeps the upload size ~420KB (deploys in seconds) instead of uploading gigabytes of cache.
- **Next.js `useSearchParams()` Rule**:
  Any client component using `useSearchParams()` (e.g. `ShopCatalog.tsx`, `CategoryFilterRow.tsx`) MUST be wrapped in a `<Suspense>` boundary on its page to prevent Next.js static build failures.
- **Admin Auth Rules (2026-10-17 audit)**:
  - Never re-introduce "allow when unconfigured" fallbacks in `lib/admin-auth.ts`, `proxy.ts`, or the admin API routes — they must fail closed.
  - `/api/admin/auth/me` must never echo the raw access token; the HttpOnly cookie is the only place the browser holds it.
  - `middleware.ts` is deprecated in Next 16 — page guards live in `proxy.ts`.
  - When MFA is enabled (`lib/admin-mfa-config.ts`), admin sessions must be **`aal2`**: never set the admin cookie before TOTP verification, and never trust `aal` claims from an unverified JWT (the `admins` lookup always goes through Supabase `getUser(token)` first).
  - Turnstile and the rate limiters **fail closed**: a missing/blank secret rejects the request; never add an "allow when unconfigured" path.
- **Working rules for AI sessions on this repo**:
  - **Minimal diffs, matching existing style.** No refactors or design/copy changes unless the owner asks; customer-visible copy is tuned (e.g. the confirmation page's email/WhatsApp text) — don't touch it casually.
  - **Dependencies:** the only additions ever approved are `zod`, `sharp`, `server-only` (all already in `package.json`). Anything new: stop and ask the owner first.
  - **Secrets:** never print, log, or commit secrets — refer to them by env-var name. Operational tokens live on the operator machine at `%USERPROFILE%\.config\thriv\operator.env` (`VERCEL_TOKEN`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`) and `%USERPROFILE%\.config\thriv\supabase-keys.env` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). App secrets live in Vercel env (Production + Preview) and local `.env.local` (git-ignored).
  - **SQL:** show the exact statement before running anything against the live database; report affected row counts after.
  - **Two-strike rule:** if the same check fails twice, stop and report — don't guess-fix repeatedly. Never weaken a security control to make a feature work; that needs an explicit owner override (the MFA-off flag is the one such override, 2026-10-18).
  - **Verify before claiming:** `npm run build` (includes TypeScript) before pushing; after pushing, wait for the Vercel deployment of that exact commit to reach READY and probe production (see §7 → deploy workflow).
  - **Documentation:** add a batch entry to `FIX_LOG.md` for every change set (root cause → fix → verification table) and keep this handover's §7 current.

---

## 7. Current Project Status, What's Left & How to Work Here

- **Status (as of Batch B10, 2026-10-19):** **100% complete and production-ready.** Security-hardened in the 2026-10-17 audit and the 2026-10-18 Batch B7 pass; admin MFA temporarily off (B8, owner request); order-confirmation email **live via Resend** (B9) — customer delivery switches on when a sending domain is verified. **B10:** now performance-hardened too — ISR catalogue + on-demand revalidation, server-rendered `/shop`, WOFF2 fonts (−83%), functions in `sin1` (co-located with Supabase).
- **Live URL:** `https://thriv-five.vercel.app` (probed after every batch — see `FIX_LOG.md`).
- **Deploy workflow:** every push to `main` auto-deploys via Vercel. After pushing, wait for the deployment whose `meta.githubCommitSha` matches your commit to reach **READY**, then probe production before reporting done. (API: `GET /v6/deployments` filtered by project `prj_QQiuoHK6wEVcSVrzbQWKSDvKUa9t` + team `team_IJwcF3Bw7JVwJMnMRG0EPLzs`; the first poll may return the previous deploy.)

### Done (full detail in `FIX_LOG.md`)
1. **B1–B6** — 2026-10-17 audit remediation: auth/guards, data integrity, purchase path, dead-code/data-truth cleanup, storefront + admin UX, security hardening.
2. **B7 / B7.1 / B7.2** — 2026-10-18 deep hardening: token-based order links, DB-backed rate limits, Turnstile, admin TOTP MFA, upload re-encoding, hardened headers/CSP; then two live-reported admin-login hotfixes (MFA factor lookup; Turnstile submit gating + honeypot hardening).
3. **B8** — admin MFA temporarily disabled (single flag: `lib/admin-mfa-config.ts` → `ADMIN_MFA_ENABLED = false`); simple password login. Everything else (Turnstile, throttles, rate limits, admins check) stays active. Re-enable = flip flag + redeploy.
4. **B9** — Resend order emails: sending-only API key installed in Vercel (Production + Preview, encrypted; also local `.env.local`); verified end-to-end (real order `THR-00016` → confirmation email delivered → cancelled, stock restored). Honest-copy gate: `canDeliverCustomerEmail()` in `lib/email.ts` keeps the confirmation page's WhatsApp-primary copy until a verified domain + `RESEND_FROM_EMAIL` exist — no false "receipt on its way".
5. **B10** — 2026-10-19 performance batch (owner-requested audit + plan, phases 0–3): ISR (60 s) + on-demand `revalidateCatalog()` on every catalogue mutation (`lib/revalidate.ts`); `/shop` server-rendered — all 31 pieces in the first HTML, no fetch waterfall (`SearchParamsBridge` keeps the grid prerendered); fonts TTF → subsetted WOFF2 (−83%: 1,023 KB → 172 KB); functions `iad1` → `sin1` (co-located with Supabase). Production re-measure: catalogue TTFB 1.3–2.6 s → **0.26–0.41 s**; `/api/products` 1.38 s → ~0.29 s; 404 anomaly fixed; browser-verified (filters work, 0 console errors). Numbers + method: `FIX_LOG.md` B10; region rationale: `docs/perf/region-ab.md`.

### Remaining — owner actions
1. **Buy the domain + DNS** (e.g. `thriv.pk`) — the only required purchase (~$10–15/yr for a .com; .pk pricier). Tell the next session the domain name + where DNS is managed; it will: connect it in Vercel (set as primary), verify it in Resend (SPF/DKIM records), set `RESEND_FROM_EMAIL` (e.g. `Thriv <orders@thriv.pk>`), redeploy, and run a final end-to-end test.
2. **Add the website link to the `@thriv.pk` Instagram bio** (use the custom domain once connected).
3. **Paste real Cloudflare Turnstile keys** into Vercel (free; Cloudflare dashboard) — test keys are in place until then.
4. **Admin re-login note:** password-only right now (B8). If MFA is re-enabled, first login shows the enrolment QR; no other change needed.

### Remaining — optional / recommendations
- **Database backups:** Supabase Free has **no automatic backups**. Offer on the table: a periodic DB export (the operator machine holds `SUPABASE_DB_PASSWORD`). Recommend once real orders start flowing.
- **Vercel plan:** account is **Hobby (free)** — verified 2026-10-18. Hosting, database, email and bot-check all cost $0 at this scale (no paid hosting needed — confirmed with the owner). Caveat: Hobby is officially *non-commercial use*; a live store is technically commercial, so the strictly-compliant option is Vercel Pro ($20/mo). Nothing breaks on free — owner's call.
- **Supabase free-tier pause:** a free project pauses after 7 days of *zero* activity — an active store never hits it; if the shop ever goes quiet that long, unpause in the dashboard before sharing links (data is never lost).

### Operational notes for the next session
- **Repo:** local path in §3; git `main`; clean at the time of writing. **Read first:** `PROJECT_HANDOVER.md` (this file) + `FIX_LOG.md` (batches B1–B10: root causes, fixes, verification) + `AGENTS.md` (Next.js 16/harness notes). `AUDIT_REPORT.md` is the historical 2026-10-17 findings.
- **Build/verify:** `npm run build` (includes TypeScript). Local prod run: `npm run start -- -p 3210` (`.env.local` is configured). Smoke checks: `scripts/check-admin-guard.ts`, `scripts/check-homepage.mjs`.
- **Catalogue mutations are cache-aware (B10):** `/`, `/shop`, `/product/[slug]` (all), `/api/products` and the sitemap are ISR-cached for 60 s. Any new endpoint that writes products or stock **must** call `revalidateCatalog()` (`lib/revalidate.ts`) after success — otherwise the site can serve stale data for up to a minute. Direct DB edits (Studio/psql) heal within 60 s by design. Deploys can be done via `vercel --prod` from this machine (CLI authenticated) in addition to the push-to-`main` workflow.
- **Attack suite:** `security/attack-tests/run.mjs` (39 checks; fixtures in `setup.mjs`/`teardown.mjs`, TOTP helpers `totp.mjs`/`totp-cli.mjs`). **While MFA is off, checks #25, #27–#29, #37 and the aal1-admin assertion in #32 fail by design** (they test MFA-mandatory behavior); everything else must pass. Use a fresh `IP_OFFSET` per run; reset `admin_login_attempts`/`rate_limits` fixtures as established. `teardown.mjs` nulls `order_events.created_by` before deleting users (Supabase Auth returns 500 otherwise).
- **Email state:** `RESEND_API_KEY` installed (sending-only key). Resend account test inbox: `thriv.str@gmail.com` — the only address that can receive mail until a domain is verified. Until then, customer sends are attempted, rejected (403, logged) and orders are unaffected; the confirmation page intentionally shows WhatsApp-primary copy.
- **Fresh environment:** apply `supabase/migrations/` in filename order — `20260920_initial_schema.sql`, `20260920_place_order_rpc.sql`, `20260921_products_storage.sql`, `20261017_b2_data_integrity.sql`, `20261017_b3_place_order_v3.sql`, `20261017_b4_data_truth.sql`, `20261017_b5_order_tracking.sql`, `20261017_b6_hardening.sql`, `20261018_security_hardening.sql` — and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY` (+ `RESEND_FROM_EMAIL` after domain verification) in Vercel (Production **and** Preview). Never use or restore the deleted legacy `supabase/schema.sql`.
- **Expected test-data residue:** orders `THR-00009`–`THR-00016` exist as **cancelled** (attack/E2E tests, stock restored). Admin residue: `admin@thriv.pk` in `admins` (the only row) + one `admin_login_attempts` row from the owner's own typo. No probe users exist.
