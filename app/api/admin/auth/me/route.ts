import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('thriv_admin_token')?.value;
    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const anonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_KEY;

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ authenticated: false, error: 'Unconfigured' }, { status: 503 });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    });

    const { data: { user }, error: userError } = await authClient.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    if (isServiceConfigured()) {
      const serviceClient = getServiceClient();
      const { data: adminRow } = await serviceClient
        .from('admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!adminRow) {
        return NextResponse.json({ authenticated: false, error: 'Not an admin' }, { status: 403 });
      }
    }

    return NextResponse.json({
      authenticated: true,
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
