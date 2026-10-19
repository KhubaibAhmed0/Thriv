/**
 * lib/revalidate.ts
 *
 * Catalogue cache invalidation (audit F-17).
 *
 * The catalogue surfaces — `/`, `/shop`, `/product/[slug]`, the public
 * catalogue API and the sitemap — are ISR-cached with a short revalidate
 * window (60s; hourly for the sitemap). This helper is called after every
 * catalogue-affecting mutation: admin product create/update/delete, order
 * placement (place_order decrements stock) and order-status changes
 * (cancellation restores stock). Price, stock and visibility changes are
 * therefore visible on the next request instead of waiting out the window.
 *
 * The revalidate window stays as the backstop for edits that bypass this
 * app (Supabase Studio / psql), where there is no mutation hook to call:
 * the DB remains the single source of truth (lib/products-db.ts) and
 * checkout still validates price + stock server-side inside place_order.
 *
 * Path mechanics (verified against the installed next version):
 * - `revalidatePath(path, 'page')` invalidates the implicit `_N_T_<path>/page`
 *   tag, which every dynamic-segment page carries for its route — so
 *   `/product/[slug]` + 'page' covers all product pages at once.
 * - `revalidatePath(path)` invalidates the `_N_T_<path>` tag carried by the
 *   concrete pathname of pages (`/shop`) and route handlers
 *   (`/api/products`, `/sitemap.xml`).
 *
 * Failures are logged, never thrown: a mutation that already committed
 * must not turn into a 500 because cache invalidation hiccuped — the
 * revalidate window heals the cache within 60s.
 *
 * Server-side only.
 */

import 'server-only';
import { revalidatePath } from 'next/cache';
import { log } from '@/lib/log';

/** [path, type] of every surface that renders catalogue data. */
const CATALOGUE_PATHS: ReadonlyArray<readonly [string, 'page' | undefined]> = [
  ['/', 'page'],
  ['/shop', undefined],
  ['/api/products', undefined],
  ['/product/[slug]', 'page'],
  ['/sitemap.xml', undefined],
];

/**
 * Invalidate every cached catalogue surface after a confirmed mutation.
 * Safe to call from any server context; never throws.
 */
export function revalidateCatalog(): void {
  for (const [path, type] of CATALOGUE_PATHS) {
    try {
      revalidatePath(path, type);
    } catch (err) {
      // The mutation has already committed — log and let the 60s cap heal.
      log.warn(`[revalidate] revalidatePath(${path}) failed:`, err);
    }
  }
}
