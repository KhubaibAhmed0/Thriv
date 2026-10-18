# Project Handover & Complete Context: Thriv E-Commerce Platform

This document contains the complete history, architectural decisions, credentials, live links, and business configurations for the **Thriv (`@thriv.pk`)** e-commerce platform. Paste this into any new AI session to give it full, immediate context.

> **Security note (2026-10-17):** A full audit was run and the fixes are logged in [`FIX_LOG.md`](./FIX_LOG.md). The admin password that used to live in this file has been rotated and must never be committed again; Supabase env keys are set in Vercel, not in the repo.
> **Security note (2026-10-18):** Deep hardening pass (Batch B7) — admin TOTP MFA (aal2-only sessions), token-based order links, DB-backed rate limits, Turnstile, upload re-encoding, hardened headers. See `FIX_LOG.md` → Batch B7 for owner actions.
> **Security note (2026-10-18, later):** Admin MFA is **temporarily disabled** on owner request — simple password login. Everything else (Turnstile, throttles, rate limits) stays active. Re-enable by flipping `ADMIN_MFA_ENABLED` in `lib/admin-mfa-config.ts` — see `FIX_LOG.md` → Batch B8.

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
| **Vercel Project** | `khubaibvalopro-8402/thriv` |
| **Supabase Project** | `Thriv` (ref `bsprovqalduuagsagjxh`, region `ap-southeast-1`). Env keys live in Vercel (Production + Preview). |

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
thriv/
├── app/
│   ├── page.tsx                    # Landing page (Hero, Categories, Featured Drops, Trust Badges)
│   ├── shop/page.tsx               # Product Catalog with category pills & custom dropdown filters
│   ├── product/[slug]/page.tsx     # PDP with condition badge, measurements, size selector, final sale note
│   ├── cart/page.tsx               # Cart view with live calculation and checkout redirect
│   ├── checkout/page.tsx           # Full checkout with Faysal Bank & wallet details, Rs 200 delivery
│   ├── order/[publicToken]/page.tsx# Order confirmation (unguessable token) with WhatsApp button & payment instructions
│   ├── admin/page.tsx              # Admin orders portal (guarded by proxy.ts)
│   ├── api/
│   │   ├── orders/route.ts         # Handles order creation, Zod validation, Supabase saving
│   │   └── admin/…                 # Admin API routes (all self-guard via lib/admin-auth.ts)
│   ├── about/page.tsx              # Brand story & curation ethos
│   └── faq/page.tsx                # FAQs on delivery, payment, sizing, and final sale policy
├── components/
│   ├── ui/CustomDropdown.tsx       # Custom popover dropdowns for filters (replaces native <select>)
│   ├── CheckoutForm.tsx            # Checkout form, Pakistani provinces, payment tabs, final sale checkbox
│   ├── OrderConfirmationClient.tsx # Order summary, step-by-step Faysal Bank transfer, WhatsApp CTA
│   ├── WhatsAppFAB.tsx             # Floating WhatsApp button wired to 0324-8188616
│   └── Header.tsx & Footer.tsx     # Branded header with cart counter and footer with admin link
├── data/
│   └── products.ts                 # Static seed catalogue: 31 products (27 vintage jeans + 4 anime tees). The live site reads from Supabase.
├── lib/
│   ├── admin-auth.ts               # Fail-closed admin token verification (cookie or Bearer header)
│   ├── orderLabels.ts              # Single source for order status/payment labels (audit F-60)
│   ├── supabase-env.ts             # Single source of truth for Supabase env config + placeholder guards
│   └── supabase-server.ts          # Service-role Supabase client (server only)
├── proxy.ts                        # Next.js 16 proxy (successor of middleware.ts) — protects /admin/*
└── supabase/
    └── migrations/                 # Authoritative SQL migrations — apply in filename order (see §7)
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

---

## 7. Current Project Status & What's Left

- **Development Status**: **100% Complete and Production-Ready** (security-hardened 2026-10-17 and 2026-10-18 — see `FIX_LOG.md`).
- **Live URL**: `https://thriv-five.vercel.app` (all public routes re-verified after each fix batch — see `FIX_LOG.md`).
- **Optional Next Steps for Hasan Bhai**:
  1. Add `https://thriv-five.vercel.app` to the `@thriv.pk` Instagram bio.
  2. Connect a custom domain (e.g. `thriv.pk`) in Vercel Settings → Domains (optional).
  3. Supabase is already configured and live (project `Thriv`). For a *fresh* environment, apply `supabase/migrations/` in filename order (`20260920_initial_schema.sql` → `20260920_place_order_rpc.sql` → `20260921_products_storage.sql` → the 2026-10-17 audit migrations `20261017_b2_data_integrity.sql`, `20261017_b3_place_order_v3.sql`, `20261017_b4_data_truth.sql` → the 2026-10-18 hardening migration `20261018_security_hardening.sql`) and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in Vercel (Production **and** Preview). Never use or restore the deleted legacy `schema.sql`.
  4. **Re-login to the admin portal** — currently password-only (MFA temporarily disabled, see `FIX_LOG.md` → Batch B8). When MFA is re-enabled, the first login shows the enrollment QR.
  5. **Paste real Cloudflare Turnstile keys** into Vercel to activate the bot check (test keys are in place until then).
  6. Read `FIX_LOG.md` for the full 2026-10 audit remediation log (what was fixed, live probes, and remaining recommendations).
