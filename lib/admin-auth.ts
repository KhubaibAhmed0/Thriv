import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';
import { getSupabasePublicEnv } from '@/lib/supabase-env';

export interface AdminUser {
  id: string;
  email?: string;
}

/**
 * Verifies that a Supabase access token belongs to a registered admin.
 *
 * FAILS CLOSED (audit F-01 / F-08): if required config is missing, or the
 * `public.admins` membership check cannot be performed, access is denied.
 * There is no "allow when unconfigured" branch — the previous dev-admin
 * fallback let anyone with any token read and mutate every order whenever
 * the NEXT_PUBLIC_* env vars were unset.
 */
export async function verifyAdminToken(
  token: string | null | undefined
): Promise<{ authorized: boolean; user?: AdminUser }> {
  if (!token || !token.trim()) {
    return { authorized: false };
  }

  const { url: supabaseUrl, anonKey } = getSupabasePublicEnv();
  if (!supabaseUrl || !anonKey) {
    console.warn(
      '[admin-auth] Supabase public env vars missing — denying request (fail closed).'
    );
    return { authorized: false };
  }

  if (!isServiceConfigured()) {
    console.warn(
      '[admin-auth] Service-role key missing — cannot verify admin membership — denying request (fail closed).'
    );
    return { authorized: false };
  }

  try {
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error,
    } = await authClient.auth.getUser(token);

    if (error || !user) {
      return { authorized: false };
    }

    const serviceClient = getServiceClient();
    const { data: adminRow, error: adminError } = await serviceClient
      .from('admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (adminError) {
      console.error('[admin-auth] admins lookup failed:', adminError.message);
      return { authorized: false };
    }

    if (!adminRow) {
      return { authorized: false };
    }

    return {
      authorized: true,
      user: { id: user.id, email: user.email },
    };
  } catch (err) {
    console.error('[admin-auth] verifyAdminToken error:', err);
    return { authorized: false };
  }
}

/** Extracts the admin token from a request (cookie or Bearer header) and verifies it. */
export async function verifyAdminRequest(req: NextRequest): Promise<{
  authorized: boolean;
  user?: AdminUser;
}> {
  const token =
    req.cookies.get('thriv_admin_token')?.value ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  return verifyAdminToken(token);
}
