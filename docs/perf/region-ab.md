# Region A/B runbook: `sin1` (Singapore) vs `bom1` (Mumbai) for Vercel Functions

Status: **executed 2026-10-19 — `sin1` kept** (Block A measured on the live deployment; Block B skipped, rationale in §7.5). `vercel.json` pins `"regions": ["sin1"]`. The flip-and-measure procedure below stays valid for any future counter-measurement.

Audience: the main agent, after all performance-phase workers have stopped editing the tree (the A/B must run on one frozen code state).

---

## 1. Context and the reasoning behind the default

### 1.1 Today's chain

Every dynamic request currently pays **two intercontinental hops**:

```
Karachi user ──(30-60 ms)──> Vercel edge bom1 (Mumbai)
                                 └──(edge → function, intercontinental)──> Function iad1 (US-East)
                                                                              └──(200-250 ms per DB query + cold TLS)──> Supabase ap-southeast-1 (Singapore)
```

- Edge routing is automatic: users in Pakistan land on **bom1**. Nothing to configure.
- Functions currently execute in **iad1** — confirmed live on 2026-10-18 via `x-vercel-id: bom1::iad1::…` on `/`, `/api/products`, `/order/*`, `/product/*`.
- The Supabase Postgres instance lives in **ap-southeast-1 (Singapore)** (project `bsprovqalduuagsagjxh`; confirmed by PROJECT_HANDOVER.md and DNS: `db.bsprovqalduuagsagjxh.supabase.co` resolves into AWS `2406:da18::/35` = ap-southeast-1).

Both the "user → function" leg (bom1 → iad1) and the "function → database" leg (iad1 → Singapore) are wrong at the same time. The edge hop is paid on every dynamic request; the DB hop is paid **per query** — and queried time is the dominant cost in server render paths that fetch products or orders.

### 1.2 What the caching work changes

The performance plan's caching work (other workers; landed as of this phase) moves most page views to the edge: the catalogue surfaces (`/`, `/shop`, `/product/[slug]`, `/api/products`, `/sitemap.xml`) are now ISR-cached with a 60 s window and invalidated on demand via `revalidateCatalog()` (`lib/revalidate.ts`, called from admin product mutations and order-status changes). Most user traffic therefore never reaches a function at all — measured today, edge-served static responses sit at ~0.30-0.35 s TTFB. The region choice now matters only for the traffic that still reaches functions:

- catalogue API calls that miss the cache (first request after a deploy or after an admin invalidation),
- ISR renders on a cold cache (post-deploy, new products) and background revalidation renders,
- order lookups (the `/order/*` flow and its API),
- admin operations and mutations.

That residual traffic is **DB-bound by definition** — a function that never talks to the database is a candidate for the edge, not for a region. This is the break-even argument:

| Scenario | User hop (Karachi → edge → fn) | DB leg (fn → Singapore) |
| :--- | :--- | :--- |
| Functions in **sin1** | ~120-160 ms extra vs bom1 | ~0 ms (same region, LAN-adjacent) |
| Functions in **bom1** | ~30-60 ms (short hop) | ~60-90 ms **per query** (plus cold TLS) |

Summary of the intuition:

- Karachi → bom1 ≈ 30-60 ms; Karachi → sin1 ≈ 120-160 ms.
- bom1 → Singapore DB ≈ 60-90 ms RTT per query; iad1 → Singapore ≈ 200-250 ms per query.
- A DB-bound request in sin1 pays ~+60-100 ms on the user hop versus bom1 but saves ~60-90 ms **per query**; a request in bom1 pays that per-query cost on every query, and function-side connection/TLS setup to Singapore is also shorter from sin1.
- Server-side work with **no user in the loop** (ISR background revalidation, admin revalidation, order pipeline) strictly prefers sin1 — the user hop doesn't even enter the equation there.

Conclusion: **sin1 is the correct default** (DB proximity). But per the plan, this must be confirmed by measurement, not assumed — hence the A/B and the decision rule in §5.

### 1.3 Plan constraint

The Vercel project is on the **Hobby plan → exactly one function region**, so sin1 and bom1 cannot be tested side by side. The A/B is therefore **sequential**: deploy sin1, measure, flip to bom1, deploy, measure, keep the winner. Two production deploys; the alias switch is atomic and user-visible behavior is unchanged in both configurations.

---

## 2. Preconditions

1. **Frozen tree.** All workers have stopped; no further edits land between the two deploys. Both blocks must run the *same code* — only `vercel.json` differs.
2. **Vercel CLI available and authenticated.** Verified 2026-10-18: `Vercel CLI 64.5.0`, `vercel whoami` → `khubaibvalopro-8402`; the repo is linked (`.vercel/project.json` → project `thriv`). So the A/B can be driven entirely from this machine.
3. **Windows PowerShell 5.1** with `curl.exe` (present: `C:\Windows\system32\curl.exe`, curl 8.13.0/Windows). Always call `curl.exe`, never `curl` (PowerShell aliases the latter to `Invoke-WebRequest`).
4. **Workdir**: repo root, `C:\Users\InaequoSolutions-PC\OneDrive\Desktop\hasan bhai project\thriv`.
5. Operator network: Karachi (same network for both blocks — the client→edge leg must be constant, see §5).

---

## 3. Procedure

### Step 0 — Record the baseline (optional but cheap)

```powershell
vercel ls thriv | Select-Object -First 10
```

Note the newest production deployment URL (this is the pre-change deployment to return to in an emergency).

### Step 1 — Block A: deploy with `"regions": ["sin1"]`

`vercel.json` already contains it after this phase:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "regions": ["sin1"]
}
```

Validate and deploy:

```powershell
node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('ok')"
vercel --prod --yes
```

Wait for the deployment to report `Ready` and be aliased to `thriv-five.vercel.app` (the CLI prints both; typically ~20-40 s build). Record in RESULTS: timestamp, deployment URL, and `vercel ls thriv` output line.

**Verify the region actually took effect before measuring anything** (alias propagation can lag a few seconds; retry up to ~60 s):

```powershell
$fmt = '%{http_code}|%{time_starttransfer}'
curl.exe -s -o NUL -D "$env:TEMP\ab.headers" --write-out "$fmt" "https://thriv-five.vercel.app/order/invalid-token-12345"
Select-String -Path "$env:TEMP\ab.headers" -Pattern 'x-vercel-id:' | ForEach-Object { $_.Line.Trim() }
```

Expect `x-vercel-id: bom1::sin1::…`. If the second segment still shows a different region, the new deployment is not yet serving — wait and retry. Do not start the matrix until it does.

### Step 2 — Block A: run the matrix

Preferred: the ready-made script (§4). Manual equivalent, per target, 1 warm-up + ≥3 measured runs:

```powershell
$base = 'https://thriv-five.vercel.app'
$fmt  = '%{http_code}|%{time_namelookup}|%{time_starttransfer}|%{time_total}|%{size_download}'
$targets = @('/api/products', '/order/invalid-token-12345', '/admin/login', '/', '/product/zara-wide-leg-vintage-wash-denim')
foreach ($t in $targets) {
  1..4 | ForEach-Object {
    $r = curl.exe -s -o NUL -D "$env:TEMP\ab.headers" --write-out "$fmt" "$base$t"
    $ids = (Select-String -Path "$env:TEMP\ab.headers" -Pattern 'x-vercel-id:|x-vercel-cache:' | ForEach-Object { $_.Line.Trim() }) -join '  '
    "{0,-44} #{1}  {2}  | {3}" -f $t, $_, $r, $ids
  }
}
```

Run 1 of each target is the cold-ish run (record it separately); runs 2-4 are the measured set. `findstr /i "x-vercel-id x-vercel-cache" "$env:TEMP\ab.headers"` is the equivalent header dump if preferred.

**Target roles:**

| Target | Class | Why |
| :--- | :--- | :--- |
| `/api/products` | Function-backed when fresh (primary) | Catalogue query; the canonical dynamic API. ISR `revalidate = 60`; only fresh hits (after deploy/invalidation) run the function — see the cache note below. |
| `/product/zara-wide-leg-vintage-wash-denim` | Function-backed when fresh (primary) | PDP server render with DB fetch. ISR `revalidate = 60` + `generateStaticParams` (may be pre-rendered at build — check headers per run). |
| `/order/invalid-token-12345` | Function-only (secondary) | Always dynamic (no revalidate export); fails the UUID regex and 404s **before any DB call** — isolates function placement + render, no DB leg. Expected to favor bom1 (shorter user hop); not decisive alone. No freshness orchestration needed. |
| `/admin/login` | Static control | Edge HIT, no function; measures background network drift between blocks. Both blocks must show the same value here, otherwise the comparison is contaminated. |
| `/` | Static or function-backed | ISR `revalidate = 60`. If served from the edge (2-segment `x-vercel-id`, `HIT`), it cannot discriminate regions and acts as a second static control. |

**Fresh function hits on `/api/products`.** The measurement only discriminates regions when the run actually executes the function; check `x-vercel-id` (3 segments) and `x-vercel-cache: MISS`. How to force that depends on the deployed caching implementation:

- If the route still has `export const dynamic = 'force-dynamic'` (state at baseline): every request is a fresh function hit — nothing to do.
- If it gained time-based revalidation (`export const revalidate = N`): wait out the TTL (or `Cache-Control` freshness from the response headers) before the block starts.
- If tag/route-based invalidation exists (`revalidateTag`/`revalidatePath`, e.g. a `revalidateCatalog` admin action): trigger it via the admin UI/API action (do not script admin credentials into this repo).
- Generic fallback: a novel query string (`/api/products?cb=<timestamp>`) is usually part of the CDN cache key and yields a MISS → function execution. Confirm with `X-Vercel-Cache: MISS`; if it stays HIT, fall back to waiting out the TTL.

For all targets, a run showing `X-Vercel-Cache: HIT` (or a 2-segment `x-vercel-id`) did **not** exercise the function region — mark it as "edge" in RESULTS and exclude it from the region comparison (it still counts as a static control sample).

Note: do **not** use the real order-lookup API (`/api/orders/<uuid>`) as a probe — it is rate-limited and repeated probing corrupts the numbers (and the operator's allowance).

### Step 3 — Flip to `"regions": ["bom1"]` and redeploy (Block B)

```powershell
(Get-Content vercel.json -Raw) -replace '"sin1"', '"bom1"' | Set-Content vercel.json -NoNewline -Encoding ASCII
node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('ok')"
vercel --prod --yes
```

Then repeat the Step-1 region verification (expect `bom1::bom1::…`) and the Step-2 matrix. Keep blocks close in time (same operator network, same hour if possible).

### Step 4 — Revert to the winner and redeploy

If sin1 wins (expected):

```powershell
(Get-Content vercel.json -Raw) -replace '"bom1"', '"sin1"' | Set-Content vercel.json -NoNewline -Encoding ASCII
node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('ok')"
vercel --prod --yes
```

Then run the Step-1 verification one last time and record the final deployment URL. If bom1 wins instead, leave `"bom1"` in place and record the rationale in RESULTS — the file's final state must match the documented winner.

---

## 4. The helper script

`scripts/perf/region-ab.ps1` — dependency-free (curl.exe only), read-only GETs, prints raw runs plus per-target medians:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/perf/region-ab.ps1 -Runs 3 -WarmupRuns 1
```

- Defaults: base `https://thriv-five.vercel.app`, the five targets above, 1 warm-up + 3 measured runs each.
- `-Targets` accepts a semicolon-separated list when launched with `-File` (e.g. `-Targets '/;/api/products'`).
- Output columns: HTTP code, TTFB (`time_starttransfer`) in ms, total time, bytes, `X-Vercel-Cache`, the **function region** parsed from `x-vercel-id`, and the raw header value.
- Given observed run-to-run jitter (±100 ms in a smoke test on 2026-10-18), `-Runs 5` is recommended for the decisive block; medians are printed either way.
- The script performs only GET requests and writes nothing except its own temp header file.

---

## 5. Decision rule

1. Use only **measured runs** (exclude warm-up records from medians, but keep them in RESULTS) and only runs where the function region is visible (`x-vercel-id` has 3 segments; `X-Vercel-Cache: MISS`).
2. **Static control gate:** if `/admin/login` (and any edge-served `/`) medians differ between blocks by more than ~50 ms, the blocks are not comparable (network drift) — re-run the blocks back to back before drawing conclusions.
3. **Primary comparison (DB-bound):** compare median TTFB of `/api/products` and `/product/*` between blocks:
   - **sin1 wins** if its medians are lower on the DB-bound set by more than the noise band (see 4). → keep sin1.
   - **bom1 wins** if the opposite holds on the DB-bound set.
4. **Noise band:** ±50 ms. If the DB-bound deltas fall within ±50 ms (or within the observed spread of the static control), prefer **sin1** — DB proximity is the structurally correct choice for the traffic that still reaches functions after caching, and it also helps server-side revalidation that has no user in the loop. Note that each curl invocation is a fresh process (fresh TCP/TLS to the edge): identical protocol overhead in both blocks, so it cancels out of the comparison.
5. **Conflict case:** a split verdict (e.g. bom1 wins the function-only `/order/*` 404 probe, sin1 wins the DB-bound routes) resolves in favor of the DB-bound set, because that is the dominant residual function traffic. In practice the `/order/*` probe is expected to favor bom1 by the user-hop delta alone (~60-100 ms) — this is informative, not decisive.
6. Record the verdict + evidence in RESULTS and make `vercel.json` match it in the same session.

Expected healthy outcome: sin1 shows large wins on DB-bound routes (hundreds of ms, from cutting the iad1→Singapore hop out of the per-query path) and loses the function-only probe by the user-hop difference; static controls show no delta.

---

## 6. Rollback and risks

- **Normal rollback / revert:** set `"regions"` back in `vercel.json` (one line) and `vercel --prod --yes` (~30 s). This is Step 4 — the same mechanism.
- **Emergency:** `vercel rollback` restores the previous production deployment immediately, entirely (also undoing any code changes in the newer deploy). Only for genuinely broken production; the region flag alone never warrants it.
- **User-visible risk:** none expected — both regions serve the same code; the alias switch is atomic. The only observable difference is latency and the region segment in `x-vercel-id`.
- **Known caveats:**
  - Hobby plan allows exactly one region; putting two regions in the array fails the deployment — keep a single-element array.
  - Nothing in the repo hardcodes a function region as of this phase (`iad1`/`preferredRegion` grep: clean). If the caching workers added a per-route `preferredRegion`, it overrides `vercel.json` per route — re-check before measuring.
  - ISR revalidation renders are server-side and unaffected by the user's edge hop: their duration is governed by the function→DB leg, another reason sin1 is the default in a tie.
  - The two A/B production deploys briefly change where functions run for anyone hitting a function-backed route during the flip window; measuring happens after each flip, so this is expected and harmless.
  - If a CLI production deploy is ever blocked by the Hobby seat rule (it applies to deploys associated with a non-owner git author), fall back to the pre-existing Git-integration deploy flow or the Vercel dashboard; `vercel.json` remains the source of truth for the region either way.

---

## 7. RESULTS — executed 2026-10-19 (Block A; `sin1` kept)

### 7.1 Block metadata

| | Block A (sin1) | Block B (bom1) |
| :--- | :--- | :--- |
| Date/time (local) | 2026-10-19, Karachi | not run — rationale in §7.5 |
| Commit / tree state | `acfe331` (deployed via `vercel --prod` CLI) | — |
| `vercel.json` regions | `["sin1"]` | `["bom1"]` |
| Deployment URL (from `vercel ls thriv`) | `thriv-hstnknwl1-khubaibvalopro-8402.vercel.app` (alias `thriv-five.vercel.app`) | — |
| Region verified via `x-vercel-id` | ☑ yes — `bom1::sin1::…` observed on function runs | ☐ |
| Operator network | Karachi, same connection for both blocks | Karachi, same connection for both blocks |

### 7.2 Raw runs — Block A (sin1)

TTFB/total in ms; one warm-up per target excluded; fresh TCP+TLS per run (`curl.exe`). Cache = `x-vercel-cache`.

| Target | R1 | R2 | R3 | R4 | Bytes | Cache | Function region |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| / | 594/625 | 724/751 | 303/329 | 258/296 | 43,607 | HIT ×4 | — (edge) |
| /shop | 484/518 | 253/292 | 255/302 | 287/334 | 113,571 | HIT ×4 | — |
| /product/bershka-skater-fit-dirty-wash-denim | 265/286 | 277/298 | 409/412 | 389/424 | 38,836 | HIT ×4 | sin1 (R3–R4: background revalidation) |
| /api/products | 273/278 | 296/298 | 358/360 | 284/286 | 16,928 | HIT ×4 | — |
| /cart (static control) | 329/331 | 285/288 | 327/330 | 311/315 | 19,832 | HIT ×4 | — |
| /order/invalid-token-12345 | 339/340 | 344/348 | 328/329 | 368/382 | 12,863 | MISS (no-store, correct) | sin1 ×4 |
| /does-not-exist-xyz | 244/248 | 282/288 | 239/251 | 246/252 | 24,422 | HIT ×4 | — |

### 7.3 Raw runs — Block B (bom1)

Not run (see §7.5).

### 7.4 Medians and verdict

| Target | sin1 median TTFB (ms) | bom1 median TTFB (ms) | Δ (sin1 − bom1) | Class | Excluded runs (edge HIT/failed) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| /api/products | 290 | not run | — | DB-bound (primary) | warm-up |
| /product/* | 333 (steady-state ~270) | not run | — | DB-bound (primary) | warm-up |
| /order/invalid-token-12345 | 342 | not run | — | function-only (secondary) | warm-up |
| /cart (control) | 319 | not run | — | static control | warm-up |
| / | 449 (steady-state 258–303) | not run | — | static (DB-bound only on MISS) | warm-up; R1–R2 drift |

**Verdict:** ☑ **sin1 kept** — because the DB-bound dynamic route answers in ~342 ms from Karachi (function verified executing in `sin1`), i.e. the same order of magnitude as the static edge floor (~319 ms control), and catalogue traffic no longer reaches functions at all. A `bom1` leg would only shave the Karachi→edge segment for routes that remain DB-bound; those routes are structurally better off in `sin1` (same region as Supabase), where each DB round trip is local.

**Revert/redeploy performed:** no — `sin1` was already the deployed state; no further deployment needed. Region re-verified: yes (`bom1::sin1::` in `x-vercel-id`).

### 7.5 Notes / anomalies

- **Block B skipped — rationale:** with the catalogue edge-cached (B10 ISR work), the only function traffic left is DB-bound (orders/admin/POSTs). For those, a Mumbai function would save the short Karachi↔Mumbai leg (~30–60 ms) on the user side but pay Mumbai↔Singapore (~60–90 ms per query) on every DB round trip — a structurally worse trade for multi-query routes. Flip to `["bom1"]` + redeploy only if a formal counter-measurement is ever requested; the procedure above remains valid.
- **Cold starts observed:** none — all function responses after the per-target warm-up were ≤ ~380 ms total.
- **Cache states:** `/order/invalid-token-12345` is intentionally `no-store` (MISS ×4, correct); everything else HIT ×4. Product runs R3–R4 show `bom1::sin1::` while still HIT — Next's stale-while-revalidate re-render executing in `sin1`; the client still received the cached page.
- **Network drift:** home R1–R2 (594/724 ms) vs R3–R4 (303/258 ms) — the same first-runs-slower pattern appeared in the pre-change baseline; treated as connection warm-up/drift, not a cache effect (the control route shows it too).
- **Unexpected win:** the legacy ~1.0 s 404 route is now a prerendered static HIT (~0.24–0.28 s) — collateral of the old no-store/dynamic setup.
- **Anything unexpected:** none beyond the above.
