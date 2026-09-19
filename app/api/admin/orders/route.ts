import { NextRequest, NextResponse } from 'next/server';
import { getOrdersFromSupabase, isSupabaseConfigured } from '@/lib/supabase';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'thriv2026';

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const adminKey = req.headers.get('x-admin-key');
  if (adminKey === ADMIN_PASSWORD) return true;
  if (authHeader && authHeader.replace(/^Bearer\s+/i, '') === ADMIN_PASSWORD) return true;
  return false;
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        configured: false,
        orders: [],
        message: 'Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your environment.',
      });
    }

    const orders = await getOrdersFromSupabase();
    return NextResponse.json({
      configured: true,
      orders,
    });
  } catch (err: any) {
    console.error('[/api/admin/orders] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}
