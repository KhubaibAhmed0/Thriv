import { NextRequest, NextResponse } from 'next/server';
import { updateOrderStatusInSupabase, isSupabaseConfigured } from '@/lib/supabase';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'thriv2026';

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const adminKey = req.headers.get('x-admin-key');
  if (adminKey === ADMIN_PASSWORD) return true;
  if (authHeader && authHeader.replace(/^Bearer\s+/i, '') === ADMIN_PASSWORD) return true;
  return false;
}

const VALID_STATUSES = ['pending', 'confirmed', 'dispatched', 'delivered', 'cancelled'] as const;
type Status = typeof VALID_STATUSES[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Supabase is not configured yet' },
        { status: 503 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await updateOrderStatusInSupabase(id, status as Status);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to update order status' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id, status });
  } catch (err: any) {
    console.error('[/api/admin/orders/[id]] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
