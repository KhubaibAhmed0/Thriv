/**
 * lib/supabase-env.ts
 *
 * Single source of truth for Supabase environment configuration.
 * Used by the admin auth guard, the API routes, and proxy.ts — so every
 * caller agrees on what "configured" means.
 *
 * SECURITY (audit F-01 / F-08 / F-24): when the public URL or keys are
 * missing, malformed, or still set to their .env.example placeholders,
 * callers must **fail closed** (deny) — never fall back to "allow".
 */

export interface SupabasePublicEnv {
  url: string | null;
  anonKey: string | null;
}

export interface SupabaseServiceEnv {
  url: string | null;
  serviceKey: string | null;
}

/** Normalizes and validates the Supabase project URL. Returns null when unusable. */
function cleanUrl(raw: string | undefined): string | null {
  const url = raw?.trim().replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '');
  if (!url) return null;
  if (!/^https:\/\//i.test(url)) return null;
  // Reject .env.example placeholders such as https://<project>.supabase.co
  if (url.includes('<') || url.includes('your-project')) return null;
  return url;
}

/** Trims and validates an API key. Returns null when missing or a placeholder. */
function cleanKey(raw: string | undefined): string | null {
  const key = raw?.trim();
  if (!key) return null;
  // Reject .env.example placeholders such as <anon_key> / <service_role_key>
  if (key.startsWith('<') || key.includes('your-')) return null;
  if (key.length < 20) return null;
  return key;
}

export function getSupabasePublicEnv(): SupabasePublicEnv {
  return {
    url: cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL),
    anonKey: cleanKey(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
        process.env.SUPABASE_ANON_KEY ??
        process.env.SUPABASE_KEY
    ),
  };
}

export function isSupabasePublicConfigured(): boolean {
  const { url, anonKey } = getSupabasePublicEnv();
  return Boolean(url && anonKey);
}

export function getSupabaseServiceEnv(): SupabaseServiceEnv {
  return {
    url: cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL),
    serviceKey: cleanKey(
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
    ),
  };
}

export function isSupabaseServiceConfigured(): boolean {
  const { url, serviceKey } = getSupabaseServiceEnv();
  return Boolean(url && serviceKey);
}
