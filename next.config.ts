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
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseHttps}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseHttps} ${supabaseWss}`,
  "media-src 'self'",
  // Same-origin frames only (internal tooling); cross-origin framing is
  // the clickjacking vector and stays blocked.
  "frame-src 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // SAMEORIGIN (not DENY) so same-origin embedding keeps working; external
  // sites cannot frame the storefront. Mirrors frame-ancestors 'self'.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
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
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
