import type { NextConfig } from "next";

/**
 * Trusted Supabase host, derived from NEXT_PUBLIC_SUPABASE_URL (available
 * at build time) with the known project ref as fallback. Audit F-82: the
 * image allowlist used to be `**.supabase.co` — any project's storage could
 * be rendered. Keep it exact.
 */
const supabaseHost = (() => {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    if (url.hostname) return url.hostname;
  } catch {
    // Fall through to the known project host.
  }
  return "bsprovqalduuagsagjxh.supabase.co";
})();

const supabaseHttps = `https://${supabaseHost}`;
const supabaseWss = `wss://${supabaseHost}`;

const isDev = process.env.NODE_ENV !== "production";

/**
 * Audit F-45: no security headers were sent at all (no CSP, no
 * frame-ancestors/X-Frame-Options, no nosniff, no Referrer-Policy, no
 * Permissions-Policy, X-Powered-By exposed). Next injects inline
 * bootstrap scripts, hence 'unsafe-inline' in script-src — the directive
 * still pins script origins to self (no third-party JS can run).
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  // Turnstile's loader script runs from Cloudflare (brief 4a) — pinned to
  // that exact origin; 'unsafe-inline' is Next's bootstrap requirement.
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseHttps}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseHttps} ${supabaseWss}`,
  "media-src 'self'",
  // Same-origin frames + the Turnstile challenge iframe (Cloudflare).
  "frame-src 'self' https://challenges.cloudflare.com",
  // Brief 6: nothing may frame this app — storefront or admin.
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // DENY mirrors frame-ancestors 'none' (brief 6): no page in this app is
  // ever framed, and legacy browsers without CSP support get the same
  // guarantee.
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), browsing-topics=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Audit F-45: stop advertising the framework version.
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHost,
      },
    ],
    // B11 (2026-10-19 perf): catalogue photos are stored as immutable
    // UUID-named objects (see app/api/admin/products/route.ts), so a
    // transformed variant can never go stale — cache it for a year instead
    // of Next's 4-hour default, and serve AVIF where the browser supports
    // it (~20-30% smaller than WebP at the same quality).
    minimumCacheTTL: 31536000,
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Admin surfaces are never indexed (brief 6).
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/api/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        // Order-confirmation URLs carry the bearer token — never indexable,
        // including for non-HTML clients that ignore <meta robots>.
        source: "/order/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
