/**
 * app/api/orders/route.ts
 *
 * POST /api/orders — validate checkout payload, call place_order RPC.
 *
 * Phase 4 hardening (2026-10-18 brief), stage order:
 *   Origin → body (size-capped) → honeypot → DB rate limit → Turnstile
 *   (fail closed) → zod (strict) → service-role RPC → email.
 *
 * Security notes:
 * - Uses the service-role client (server-only). No client prices trusted.
 * - The response carries `public_token` — the unguessable confirmation key.
 *   Order numbers (THR-xxxxx) are sequential and must never be the lookup key.
 * - No PII is logged at any level.
 * - Unconfigured/failed backend returns 503 "unavailable" — never a
 *   fabricated "order placed" success (audit F-05).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';
import { sendOrderConfirmationEmail, canDeliverCustomerEmail } from '@/lib/email';
import {
  clientIp,
  dbRateLimit,
  honeypotTripped,
  NO_STORE_HEADERS,
  originAllowed,
  requestId,
  verifyTurnstile,
} from '@/lib/api-guard';
import { mapPlaceOrderError } from '@/lib/order-errors';
import { securityLog } from '@/lib/security-log';
import { log } from '@/lib/log';
import {
  normalizePakistaniPhone,
  isValidPakistaniPhone,
  isProvince,
} from '@/lib/validation';

const MAX_BODY_BYTES = 20 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Zod schema ────────────────────────────────────────────────────────
// Prices sent from the client are intentionally absent — the RPC
// recomputes them server-side from the products table. `.strict()` rejects
// unknown keys outright.

const ItemSchema = z
  .object({
    product_slug: z.string().min(1).max(120),
    // Cart bounds (brief 4d): quantity stays at the storefront's own cap —
    // the UI clamps to product.stock (up to 40 for merch), so a lower cap
    // here would reject legitimate orders.
    quantity: z.number().int().min(1).max(40),
    selected_size: z.string().max(20).optional().nullable(),
  })
  .strict();

const OrderSchema = z
  .object({
    idempotency_key: z.string().uuid('idempotency_key must be a UUID'),
    customer_name: z.string().min(2).max(100),
    customer_phone: z
      .string()
      .max(20)
      .transform(normalizePakistaniPhone)
      .refine(isValidPakistaniPhone, 'Enter a valid Pakistani number e.g. 03001234567'),
    customer_email: z.string().email().max(254),
    address_line: z.string().min(5).max(300),
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
    // transactions (audit F-48; brief cap 20).
    items: z
      .array(ItemSchema)
      .min(1, 'Cart is empty')
      .max(20, 'Too many items in one order — please split it.'),
    // Client must confirm final-sale policy; validated here but not sent to DB.
    agreed_to_final_sale: z
      .boolean()
      .refine((v) => v === true, { message: 'You must agree to the final sale policy' }),
    turnstile_token: z.string().max(4096).nullish(),
    website: z.string().max(200).optional().default(''),
  })
  .strict();

function unavailableBody(rid: string) {
  return {
    error:
      'Checkout is temporarily unavailable. Please message us on WhatsApp (0324-8188616) to place your order.',
    code: 'CHECKOUT_UNAVAILABLE',
    request_id: rid,
  };
}

// ── POST /api/orders ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const rid = requestId();

  // 0a. CSRF mitigation: browser Origin must match the request host.
  if (!originAllowed(req)) {
    securityLog('checkout.origin_blocked', {});
    return NextResponse.json(
      { error: 'Request blocked.' },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  // 0b. Body, size-capped.
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  // 0c. Honeypot — invisible `website` field.
  if (honeypotTripped(body)) {
    securityLog('checkout.honeypot', {});
    return NextResponse.json(
      { error: 'Could not process this request. Please reload the page and try again.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  // 0d. Per-IP rate limit (audit F-09 + brief 4a): bounds scripted stock
  //     depletion and email/DB abuse. Six attempts per ten minutes.
  const limiter = await dbRateLimit(req, 'orders', 6, 600);
  if (!limiter.ok) {
    securityLog('ratelimit.denied', { scope: 'orders' });
    return NextResponse.json(
      {
        error:
          'Too many order attempts. Please wait a few minutes, or message us on WhatsApp (0324-8188616).',
      },
      { status: 429, headers: { ...NO_STORE_HEADERS, 'Retry-After': String(limiter.retryAfterSec) } }
    );
  }

  // 0e. Turnstile — fail closed (brief 4a). Infrastructure failures map to
  //     the same 503 the storefront already knows how to handle.
  const turnstile = await verifyTurnstile(
    typeof body === 'object' && body !== null
      ? ((body as Record<string, unknown>).turnstile_token as string | null | undefined)
      : null,
    clientIp(req),
    req.headers.get('host')
  );
  if (!turnstile.ok) {
    securityLog('checkout.turnstile.fail', { infra: turnstile.infra });
    if (turnstile.infra) {
      return NextResponse.json(unavailableBody(rid), { status: 503, headers: NO_STORE_HEADERS });
    }
    return NextResponse.json(
      { error: 'Could not process this request. Please reload the page and try again.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  // 1. Parse & validate
  const parsed = OrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const data = parsed.data;

  // 2. Checkout REQUIRES the backend. Fail loudly (audit F-05): a fabricated
  //    success takes a customer's money for an order nobody ever records.
  if (!isServiceConfigured()) {
    log.error('[/api/orders] Checkout unavailable: Supabase service is not configured.');
    return NextResponse.json(unavailableBody(rid), { status: 503, headers: NO_STORE_HEADERS });
  }

  // 3. Call place_order RPC via service-role client. Client construction and
  //    transport failures degrade to the same "unavailable" state (F-14).
  let result: {
    order_number?: string;
    public_token?: string;
    total_pkr?: number;
    idempotent?: boolean;
  } | null = null;

  try {
    const supabase = getServiceClient();

    // Build the payload for the RPC — strip UI-only fields
    // (agreed_to_final_sale, turnstile_token, website).
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
      // Audit F-41: map by SQLSTATE (TH0xx raised by place_order) — never
      // substring-match on raw Postgres text.
      const mapped = mapPlaceOrderError(error);
      if (mapped.status >= 500) {
        log.error('[/api/orders] RPC error:', error.code ?? '(no code)');
      } else {
        log.warn('[/api/orders] RPC rejected order:', error.code ?? '(no code)');
      }
      const responseBody =
        mapped.status >= 500 ? { ...mapped.body, request_id: rid } : mapped.body;
      return NextResponse.json(responseBody, { status: mapped.status, headers: NO_STORE_HEADERS });
    }

    result = rpcResult;
  } catch (err) {
    log.error('[/api/orders] RPC transport failure:', err);
    return NextResponse.json(unavailableBody(rid), { status: 503, headers: NO_STORE_HEADERS });
  }

  if (!result) {
    return NextResponse.json(unavailableBody(rid), { status: 503, headers: NO_STORE_HEADERS });
  }

  // 3a. Idempotent replay (audit F-50 / SEC-19): the RPC returns ONLY
  //     { idempotent: true } on replay — no order number or total.
  if (result.idempotent === true) {
    securityLog('order.replay', { ip: clientIp(req) });
    return NextResponse.json(
      { idempotent: true, email_enabled: canDeliverCustomerEmail() },
      { status: 201, headers: NO_STORE_HEADERS }
    );
  }

  // 3b. Defence in depth: a fresh order must carry a number, a total, and a
  //     UUID public token (the confirmation key).
  if (
    !result.order_number ||
    typeof result.total_pkr !== 'number' ||
    typeof result.public_token !== 'string' ||
    !UUID_RE.test(result.public_token)
  ) {
    log.error('[/api/orders] RPC returned an unexpected shape');
    return NextResponse.json(unavailableBody(rid), { status: 503, headers: NO_STORE_HEADERS });
  }

  const orderNumber = result.order_number;
  const publicToken = result.public_token;
  const orderTotal = result.total_pkr;

  // 4. Confirmation email — ONLY for freshly created orders and NEVER awaited
  //    (audit F-09/F-19).
  void sendOrderConfirmationEmail({
    orderNumber,
    customerName: data.customer_name,
    customerEmail: data.customer_email,
    totalPkr: orderTotal,
    deliveryAddress: `${data.address_line}, ${data.city}, ${data.province}`,
    items: data.items,
  }).catch((e) => log.error('[/api/orders] Confirmation email failed:', e));

  // Log only the order number (no PII).
  log.info('[/api/orders] Order placed:', orderNumber);

  return NextResponse.json(
    {
      order_number: orderNumber,
      public_token: publicToken,
      total_pkr: orderTotal,
      idempotent: false,
      email_enabled: canDeliverCustomerEmail(),
    },
    { status: 201, headers: NO_STORE_HEADERS }
  );
}
