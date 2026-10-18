import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin-auth';
import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';
import { requestId } from '@/lib/api-guard';
import { log } from '@/lib/log';

/**
 * Explicit projection (Phase 4, 2026-10-18 brief): every `orders` column
 * EXCEPT `public_token`. The confirmation key is a bearer credential for the
 * public order page — it must never reach the admin UI or its API clients.
 * `order_items` / `order_events` carry no sensitive key, so `*` stays there.
 *
 * The select is one literal (no interpolation) — supabase-js parses the
 * string type at compile time and rejects template substitutions.
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const rid = requestId();
  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderNumber } = await params;

    if (!isServiceConfigured()) {
      return NextResponse.json(
        { error: 'Supabase service client not configured.' },
        { status: 503 }
      );
    }

    const supabase = getServiceClient();

    // Fetch order with its snapshot items and audit events.
    const { data: order, error } = await supabase
      .from('orders')
      .select(
        `
        id,
        order_number,
        customer_name,
        customer_phone,
        customer_email,
        address_line,
        city,
        province,
        notes,
        payment_method,
        payment_status,
        status,
        subtotal_pkr,
        delivery_fee_pkr,
        total_pkr,
        idempotency_key,
        created_at,
        delivered_at,
        courier,
        tracking_number,
        updated_at,
        items:order_items (*),
        events:order_events (*)
      `
      )
      .eq('order_number', orderNumber)
      .maybeSingle();

    if (error) {
      log.error('[/api/admin/orders/[orderNumber]] DB error:', error.message);
      return NextResponse.json(
        { error: 'Failed to load order.', request_id: rid },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Sort events newest first
    if (Array.isArray(order.events)) {
      order.events.sort(
        (a: { created_at: string }, b: { created_at: string }) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    return NextResponse.json({ order });
  } catch (err) {
    log.error('[/api/admin/orders/[orderNumber]] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error', request_id: rid },
      { status: 500 }
    );
  }
}
