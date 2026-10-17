import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin-auth';
import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';
import { errorMessage } from '@/lib/errors';

interface AdminOrderRow {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  city: string;
  province: string;
  total_pkr: number;
  payment_method: string;
  payment_status: string;
  status: string;
  created_at: string;
  delivered_at: string | null;
  order_items: { id: string }[] | null;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isServiceConfigured()) {
      return NextResponse.json({
        configured: false,
        orders: [],
        message: 'Supabase service client not configured.',
      });
    }

    const supabase = getServiceClient();

    // Fetch orders with item count snapshot
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        customer_name,
        customer_phone,
        city,
        province,
        total_pkr,
        payment_method,
        payment_status,
        status,
        created_at,
        delivered_at,
        order_items ( id )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[/api/admin/orders] DB error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formattedOrders = (orders || []).map((o: AdminOrderRow) => ({
      id: o.id,
      order_number: o.order_number,
      customer_name: o.customer_name,
      customer_phone: o.customer_phone,
      city: o.city,
      province: o.province,
      total_pkr: o.total_pkr,
      payment_method: o.payment_method,
      payment_status: o.payment_status,
      status: o.status,
      created_at: o.created_at,
      delivered_at: o.delivered_at,
      item_count: Array.isArray(o.order_items) ? o.order_items.length : 0,
    }));

    return NextResponse.json({
      configured: true,
      orders: formattedOrders,
    });
  } catch (err) {
    console.error('[/api/admin/orders] Unexpected error:', err);
    return NextResponse.json(
      { error: errorMessage(err, 'Failed to fetch orders') },
      { status: 500 }
    );
  }
}
