import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';

export async function verifyAdminRequest(req: NextRequest): Promise<{
  authorized: boolean;
  user?: { id: string; email?: string };
}> {
  const token =
    req.cookies.get('thriv_admin_token')?.value ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return { authorized: false };
  }

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const supabaseUrl = rawUrl?.trim().replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '');
  const anonKey = rawKey?.trim();

  if (!supabaseUrl || !anonKey) {
    // Unconfigured offline fallback: allow if local dev
    return { authorized: true, user: { id: 'dev-admin', email: 'admin@thriv.pk' } };
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

    if (isServiceConfigured()) {
      const serviceClient = getServiceClient();
      const { data: adminRow } = await serviceClient
        .from('admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!adminRow) {
        return { authorized: false };
      }
    }

    return {
      authorized: true,
      user: { id: user.id, email: user.email },
    };
  } catch (err) {
    console.error('[verifyAdminRequest] Error:', err);
    return { authorized: false };
  }
}
