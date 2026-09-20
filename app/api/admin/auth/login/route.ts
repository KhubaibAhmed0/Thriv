import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';

// Version 1.0.2 - updated supabase project url

const LoginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const rawUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const rawKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_KEY;

    const supabaseUrl = rawUrl?.trim().replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '');
    const anonKey = rawKey?.trim();

    if (!supabaseUrl || !anonKey) {
      const missing: string[] = [];
      if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
      if (!anonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
      return NextResponse.json(
        {
          error: `Supabase credentials are not configured on the server. Missing: ${missing.join(', ')}`,
        },
        { status: 503 }
      );
    }

    // 1. Authenticate with Supabase Auth using the anon client
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user || !authData.session) {
      return NextResponse.json(
        { error: authError?.message || 'Invalid email or password' },
        { status: 401 }
      );
    }

    const userId = authData.user.id;

    // 2. Verify admin role in admins table using server service client
    if (isServiceConfigured()) {
      const serviceClient = getServiceClient();
      const { data: adminRow, error: adminError } = await serviceClient
        .from('admins')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (adminError || !adminRow) {
        // Sign out / reject access
        return NextResponse.json(
          { error: 'Not authorised: This account does not have admin privileges.' },
          { status: 403 }
        );
      }
    }

    // 3. Set HttpOnly session cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
    });

    response.cookies.set({
      name: 'thriv_admin_token',
      value: authData.session.access_token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: authData.session.expires_in || 60 * 60 * 24 * 7, // default 7 days
    });

    return response;
  } catch (err) {
    console.error('[/api/admin/auth/login] Unexpected error');
    return NextResponse.json(
      { error: 'Internal server error during authentication.' },
      { status: 500 }
    );
  }
}
