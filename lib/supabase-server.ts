/**
 * lib/supabase-server.ts
 *
 * Service-role Supabase client — SERVER SIDE ONLY.
 *
 * This module must NEVER be imported from any client component or any
 * file that ends up in the browser bundle. It reads SUPABASE_SERVICE_ROLE_KEY
 * which is a server-only env var (no NEXT_PUBLIC_ prefix).
 *
 * Usage: import { getServiceClient } from '@/lib/supabase-server'
 * Only inside: API route handlers, server actions, middleware.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _serviceClient: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (_serviceClient) return _serviceClient;

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error(
      '[supabase-server] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
        'Add them to .env.local and Vercel environment variables.'
    );
  }

  _serviceClient = createClient(url, key, {
    auth: {
      // Service role client never manages user sessions
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return _serviceClient;
}

/** Returns true if the service-role env vars are present. */
export function isServiceConfigured(): boolean {
  return Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)
  );
}
