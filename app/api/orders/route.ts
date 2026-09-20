/**
 * app/api/orders/route.ts
 *
 * POST /api/orders — validate checkout payload, call place_order RPC.
 *
 * Security notes:
 * - Uses the service-role client (server-only). No client prices trusted.
 * - Zod validates the request body before the DB call.
 * - No PII is logged at any level. Only order_number and http status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';
import { sendOrderConfirmationEmail } from '@/lib/email';

// ── Zod schema ────────────────────────────────────────────────────────
// Prices sent from the client are intentionally absent — the RPC
// recomputes them server-side from the products table.

const ItemSchema = z.object({
  product_slug: z.string().min(1),
  quantity: z.number().int().min(1).max(40),
  selected_size: z.string().optional().nullable(),
});

const OrderSchema = z.object({
  idempotency_key: z.string().uuid('idempotency_key must be a UUID'),
  customer_name: z.string().min(2).max(100),
  customer_phone: z
    .string()
    .regex(
      /^(\+92|0092|0)[0-9]{10}$/,
      'Enter a valid Pakistani number e.g. 03001234567'
    ),
  customer_email: z.string().email(),
  address_line: z.string().min(10).max(300),
  city: z.string().min(2).max(100),
  province: z.enum([
    'Punjab',
    'Sindh',
    'Khyber Pakhtunkhwa',
    'Balochistan',
    'Gilgit-Baltistan',
    'Azad Jammu & Kashmir',
    'Islamabad Capital Territory',
  ]),
  notes: z.string().max(500).optional().nullable(),
  payment_method: z.enum([
    'cash-on-delivery',
    'cod',
    'bank-transfer',
    'bank_transfer',
    'easypaisa',
    'jazzcash',
    'card',
  ]),
  items: z.array(ItemSchema).min(1, 'Cart is empty'),
  // Client must confirm final-sale policy; validated here but not sent to DB
  agreed_to_final_sale: z
    .boolean()
    .refine((v) => v === true, { message: 'You must agree to the final sale policy' }),
});

// ── POST /api/orders ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 1. Parse & validate
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = OrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // 2. Require Supabase to be configured
  if (!isServiceConfigured()) {
    // Graceful degradation: return a synthetic order number so the
    // storefront confirmation page still works during local dev
    // without Supabase. Log a warning, not the order contents.
    console.warn('[/api/orders] Supabase service key not configured — running in offline mode.');
    const fallbackNumber = `THR-LOCAL-${Date.now()}`;
    return NextResponse.json(
      { order_number: fallbackNumber, total_pkr: 0, offline: true },
      { status: 201 }
    );
  }

  // 3. Call place_order RPC via service-role client
  const supabase = getServiceClient();

  // Build the payload for the RPC — strip agreed_to_final_sale, it's
  // a UI-only field. The DB doesn't store it.
  const rpcPayload = {
    idempotency_key: data.idempotency_key,
    customer_name:   data.customer_name,
    customer_phone:  data.customer_phone,
    customer_email:  data.customer_email,
    address_line:    data.address_line,
    city:            data.city,
    province:        data.province,
    notes:           data.notes ?? null,
    payment_method:  data.payment_method,
    items:           data.items,
  };

  const { data: result, error } = await supabase.rpc('place_order', {
    payload: rpcPayload,
  });

  if (error) {
    // The RPC raises meaningful exceptions (stock, unavailable product).
    // Surface the message to the client — it's safe (no PII).
    const msg: string = error.message ?? 'Failed to place order';
    const isStockError =
      msg.includes('sold out') ||
      msg.includes('no longer available') ||
      msg.includes('Only ');

    console.error('[/api/orders] RPC error code:', error.code);

    return NextResponse.json(
      { error: msg },
      { status: isStockError ? 409 : 500 }
    );
  }

  // 4. Send confirmation email (Resend with stub fallback)
  await sendOrderConfirmationEmail({
    orderNumber: result.order_number,
    customerName: data.customer_name,
    customerEmail: data.customer_email,
    totalPkr: result.total_pkr,
    deliveryAddress: `${data.address_line}, ${data.city}, ${data.province}`,
    items: data.items,
  });

  // Log only order_number (no PII)
  console.log('[/api/orders] Order placed:', result.order_number);

  return NextResponse.json(result, { status: 201 });
}
