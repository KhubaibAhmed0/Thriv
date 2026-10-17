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

### Deploy verification

Recorded in the follow-up commit after the preview and production rollouts (live login flow, token-echo absence, forged-token denial, homepage health).

---

## Batches B2–B6 — pending

Applying in report order: B2 (data integrity, F-04…), B3 (purchase path, F-05…), B4 (dead code & data truth), B5 (UX/a11y), B6 (hardening). Each will get its own section here with the same evidence format.
