/**
 * app/api/orders/route.ts
 *
 * POST /api/orders — validate checkout payload, call place_order RPC.
 *
 * Security notes:
 * - Uses the service-role client (server-only). No client prices trusted.
 * - Zod validates the request body before the DB call (bounded cart, F-48).
 * - No PII is logged at any level. Only order_number and http status.
 * - Per-IP rate limit (in-memory) and confirmation email only for orders the
 *   RPC actually created (audit F-09); email is never awaited (audit F-19).
 * - Unconfigured/failed backend returns 503 "unavailable" — never a
 *   fabricated "order placed" success (audit F-05).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';
import { sendOrderConfirmationEmail, isEmailConfigured } from '@/lib/email';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import {
  normalizePakistaniPhone,
  isValidPakistaniPhone,
  isProvince,
} from '@/lib/validation';

// ── Zod schema ────────────────────────────────────────────────────────
// Prices sent from the client are intentionally absent — the RPC
// recomputes them server-side from the products table.

const ItemSchema = z.object({
  product_slug: z.string().min(1).max(120),
  quantity: z.number().int().min(1).max(40),
  selected_size: z.string().max(20).optional().nullable(),
});

const OrderSchema = z.object({
  idempotency_key: z.string().uuid('idempotency_key must be a UUID'),
  customer_name: z.string().min(2).max(100),
  customer_phone: z
    .string()
    .max(20)
    .transform(normalizePakistaniPhone)
    .refine(isValidPakistaniPhone, 'Enter a valid Pakistani number e.g. 03001234567'),
  customer_email: z.string().email(),
  address_line: z.string().min(10).max(300),
  city: z.string().min(2).max(100),
  province: z.string().max(40).refine(isProvince, 'Enter a valid province'),
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
  // Cap the cart: unbounded arrays allow lock starvation / oversized
  // transactions (audit F-48).
  items: z
    .array(ItemSchema)
    .min(1, 'Cart is empty')
    .max(25, 'Too many items in one order — please split it.'),
  // Client must confirm final-sale policy; validated here but not sent to DB
  agreed_to_final_sale: z
    .boolean()
    .refine((v) => v === true, { message: 'You must agree to the final sale policy' }),
});

const UNAVAILABLE_BODY = {
  error:
    'Checkout is temporarily unavailable. Please message us on WhatsApp (0324-8188616) to place your order.',
  code: 'CHECKOUT_UNAVAILABLE',
} as const;

// ── POST /api/orders ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 0. Per-IP rate limit (audit F-09): bounds scripted stock depletion and
  //    email/DB abuse. Ordering is low-frequency — six attempts per ten
  //    minutes is generous for a household and hostile to a script.
  const limiter = rateLimit(`orders:${clientIp(req)}`, 6, 10 * 60 * 1000);
  if (!limiter.ok) {
    return NextResponse.json(
      {
        error:
          'Too many order attempts. Please wait a few minutes, or message us on WhatsApp (0324-8188616).',
      },
      { status: 429, headers: { 'Retry-After': String(limiter.retryAfterSec) } }
    );
  }

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

  // 2. Checkout REQUIRES the backend. Fail loudly (audit F-05): a fabricated
  //    success takes a customer's money for an order nobody ever records.
  //    503 tells the storefront to surface the WhatsApp fallback instead.
  if (!isServiceConfigured()) {
    console.error('[/api/orders] Checkout unavailable: Supabase service is not configured.');
    return NextResponse.json(UNAVAILABLE_BODY, { status: 503 });
  }

  // 3. Call place_order RPC via service-role client. Client construction and
  //    transport failures degrade to the same "unavailable" state (F-14).
  let result: {
    order_number: string;
    total_pkr: number;
    idempotent?: boolean;
  } | null = null;

  try {
    const supabase = getServiceClient();

    // Build the payload for the RPC — strip agreed_to_final_sale, it's
    // a UI-only field. The DB doesn't store it.
    const rpcPayload = {
      idempotency_key: data.idempotency_key,
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      customer_email: data.customer_email,
      address_line: data.address_line,
      city: data.city,
      province: data.province,
      notes: data.notes ?? null,
      payment_method: data.payment_method,
      items: data.items,
    };

    const { data: rpcResult, error } = await supabase.rpc('place_order', {
      payload: rpcPayload,
    });

    if (error) {
      // The RPC raises meaningful exceptions (stock, unavailable product,
      // invalid size). Surface the message — it contains no PII.
      const msg: string = error.message ?? 'Failed to place order';
      const isClientFixable =
        msg.includes('sold out') ||
        msg.includes('no longer available') ||
        msg.includes('Product not found') ||
        msg.includes('Only ') ||
        msg.includes('valid size') ||
        msg.includes('Invalid quantity');

      console.error('[/api/orders] RPC error code:', error.code);

      return NextResponse.json(
        { error: msg },
        { status: isClientFixable ? 409 : 500 }
      );
    }

    result = rpcResult;
  } catch (e) {
    console.error('[/api/orders] RPC transport failure:', e instanceof Error ? e.message : e);
    return NextResponse.json(UNAVAILABLE_BODY, { status: 503 });
  }

  if (!result) {
    return NextResponse.json(UNAVAILABLE_BODY, { status: 503 });
  }

  // 4. Confirmation email — ONLY for freshly created orders (never on an
  //    idempotent replay, audit F-09) and NEVER awaited (audit F-19): a
  //    stalled provider must not delay the response carrying the order
  //    number, or the customer retries and creates a second order.
  if (!result.idempotent) {
    void sendOrderConfirmationEmail({
      orderNumber: result.order_number,
      customerName: data.customer_name,
      customerEmail: data.customer_email,
      totalPkr: result.total_pkr,
      deliveryAddress: `${data.address_line}, ${data.city}, ${data.province}`,
      items: data.items,
    }).catch((e) =>
      console.error('[/api/orders] Confirmation email failed:', e instanceof Error ? e.message : e)
    );
  }

  // Log only order_number (no PII)
  console.log(
    '[/api/orders] Order placed:',
    result.order_number,
    result.idempotent ? '(idempotent replay)' : ''
  );

  // email_enabled lets the confirmation page phrase email copy honestly
  // (audit F-26) instead of promising a receipt that was never sent.
  return NextResponse.json(
    { ...result, email_enabled: isEmailConfigured() },
    { status: 201 }
  );
}
