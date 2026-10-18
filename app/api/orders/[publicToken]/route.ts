/**
 * app/api/orders/[publicToken]/route.ts
 *
 * GET /api/orders/:publicToken — minimal public order lookup.
 *
 * Phase 4 (2026-10-18 brief): the lookup key is the unguessable
 * `public_token` (UUID) issued by place_order. Sequential order numbers
 * (THR-xxxxx) no longer resolve here.
 *
 * Privacy: returns NO customer PII (no name, phone, email, address, notes) —
 * only order number, statuses, money, timestamp, payment method and item
 * snapshots. Rate-limited per IP.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';
import { canDeliverCustomerEmail } from '@/lib/email';
import { dbRateLimit, NO_STORE_HEADERS, requestId } from '@/lib/api-guard';
import { log } from '@/lib/log';
import { securityLog } from '@/lib/security-log';

export const dynamic = 'force-dynamic';

const PUBLIC_TOKEN_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFound() {
  return NextResponse.json(
    { error: 'Order not found' },
    { status: 404, headers: NO_STORE_HEADERS }
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ publicToken: string }> }
) {
  const rid = requestId();
  try {
    const { publicToken } = await params;

    // Only the token shape the store issues; anything else 404s uniformly.
    if (!PUBLIC_TOKEN_RE.test(publicToken)) {
      return notFound();
    }

    const limiter = await dbRateLimit(req, 'order-lookup', 30, 600);
    if (!limiter.ok) {
      securityLog('ratelimit.denied', { scope: 'order-lookup' });
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        {
          status: 429,
          headers: { ...NO_STORE_HEADERS, 'Retry-After': String(limiter.retryAfterSec) },
        }
      );
    }

    if (!isServiceConfigured()) {
      return NextResponse.json(
        { error: 'Order lookup unavailable' },
        { status: 503, headers: NO_STORE_HEADERS }
      );
    }

    const supabase = getServiceClient();
    const { data: order, error } = await supabase
      .from('orders')
      .select(
        'order_number, status, payment_status, payment_method, subtotal_pkr, delivery_fee_pkr, total_pkr, created_at, tracking_number, courier, order_items(name, brand, size, quantity, unit_price_pkr)'
      )
      .eq('public_token', publicToken)
      .maybeSingle();

    if (error) {
      log.error('[/api/orders/[publicToken]] DB error:', error.message);
      return NextResponse.json(
        { error: 'Order lookup failed', request_id: rid },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
    if (!order) {
      return notFound();
    }

    return NextResponse.json(
      {
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
        email_enabled: canDeliverCustomerEmail(),
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    log.error('[/api/orders/[publicToken]] Error:', err);
    return NextResponse.json(
      { error: 'Order lookup failed', request_id: rid },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
