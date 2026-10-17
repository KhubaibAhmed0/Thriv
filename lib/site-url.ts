/**
 * lib/site-url.ts
 *
 * Canonical origin for metadata, sitemap, robots and share links.
 *
 * Defaults to the live Vercel production URL so canonical/OG URLs resolve
 * today. When a custom domain is attached (e.g. https://thriv.pk), set
 * NEXT_PUBLIC_SITE_URL in the deployment environment and every canonical
 * URL follows without a code change.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') ||
  'https://thriv-five.vercel.app';
