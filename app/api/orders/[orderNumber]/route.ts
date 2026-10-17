/**
 * app/api/orders/[orderNumber]/route.ts
 *
 * GET /api/orders/:orderNumber — minimal public order lookup.
 *
 * Powers the confirmation page cross-device (audit F-58) without localStorage.
 * Privacy: returns NO customer PII (no name, phone, email, address, notes) —
 * only order number, statuses, money, timestamp, payment method and item
 * snapshots. Rate-limited because order numbers are sequential.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';
import { isEmailConfigured } from '@/lib/email';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;

    // Tolerate only the order-number shape the store issues (THR-xxxxx).
    if (!/^THR-[A-Za-z0-9-]{3,24}$/.test(orderNumber)) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const limiter = rateLimit(`order-lookup:${clientIp(req)}`, 30, 10 * 60 * 1000);
    if (!limiter.ok) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        { status: 429, headers: { 'Retry-After': String(limiter.retryAfterSec) } }
      );
    }

    if (!isServiceConfigured()) {
      return NextResponse.json({ error: 'Order lookup unavailable' }, { status: 503 });
    }

    const supabase = getServiceClient();
    const { data: order, error } = await supabase
      .from('orders')
      .select(
        'order_number, status, payment_status, payment_method, subtotal_pkr, delivery_fee_pkr, total_pkr, created_at, tracking_number, courier, order_items(name, brand, size, quantity, unit_price_pkr)'
      )
      .eq('order_number', orderNumber)
      .maybeSingle();

    if (error) {
      console.error('[/api/orders/[orderNumber]] DB error:', error.message);
      return NextResponse.json({ error: 'Order lookup failed' }, { status: 500 });
    }
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({
      order: {
        order_number: order.order_number,
        status: order.status,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        subtotal_pkr: order.subtotal_pkr,
        delivery_fee_pkr: order.delivery_fee_pkr,
        total_pkr: order.total_pkr,
        created_at: order.created_at,
        tracking_number: order.tracking_number ?? null,
        courier: order.courier ?? null,
        items: (order.order_items ?? []).map(
          (item: {
            name: string;
            brand: string | null;
            size: string | null;
            quantity: number;
            unit_price_pkr: number;
          }) => ({
            name: item.name,
            brand: item.brand,
            size: item.size,
            quantity: item.quantity,
            unit_price_pkr: item.unit_price_pkr,
          })
        ),
      },
      // Lets the confirmation page phrase email claims honestly (F-26).
      email_enabled: isEmailConfigured(),
    });
  } catch (err) {
    console.error('[/api/orders/[orderNumber]] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Order lookup failed' }, { status: 500 });
  }
}
