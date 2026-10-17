/**
 * lib/order-errors.ts
 *
 * Audit F-41: checkout errors are mapped by SQLSTATE — never by substring
 * matching on raw Postgres text. `place_order` (B6 migration) raises
 * application-reserved TH0xx codes; this module turns them into fixed,
 * client-safe responses. Unrecognised errors become a generic 500 with
 * the WhatsApp fallback; the raw detail is logged server-side only.
 *
 * TH001 missing/invalid order fields   → 400 INVALID_ORDER
 * TH002 invalid quantity               → 400 INVALID_QUANTITY
 * TH003 product not found              → 409 PRODUCT_NOT_FOUND
 * TH004 sold out                       → 409 OUT_OF_STOCK
 * TH005 product no longer available    → 409 PRODUCT_UNAVAILABLE
 * TH006 invalid selected size          → 409 INVALID_SIZE
 * TH007 invalid payment method         → 400 INVALID_PAYMENT
 */

export interface MappedOrderError {
  status: number;
  body: { error: string; code: string };
}

/** Strip control characters / collapse whitespace / cap length. */
function sanitizeMessage(message: string): string {
  return message
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

const FALLBACKS: Record<string, { status: number; code: string; message: string }> = {
  TH001: {
    status: 400,
    code: 'INVALID_ORDER',
    message: 'Some order details were missing or invalid. Please review your cart and try again.',
  },
  TH002: {
    status: 400,
    code: 'INVALID_QUANTITY',
    message: 'One of the items had an invalid quantity. Please refresh the page and try again.',
  },
  TH003: {
    status: 409,
    code: 'PRODUCT_NOT_FOUND',
    message: 'One of the pieces in your cart is no longer available. Please remove it and try again.',
  },
  TH004: {
    status: 409,
    code: 'OUT_OF_STOCK',
    message: 'This piece has just sold out. Please remove it from your cart and try again.',
  },
  TH005: {
    status: 409,
    code: 'PRODUCT_UNAVAILABLE',
    message: 'One of the pieces in your cart is no longer available. Please remove it and try again.',
  },
  TH006: {
    status: 409,
    code: 'INVALID_SIZE',
    message: 'Please select a valid size for the item and try again.',
  },
  TH007: {
    status: 400,
    code: 'INVALID_PAYMENT',
    message: 'That payment method is not supported. Please pick another method.',
  },
};

/**
 * Map a place_order RPC error to the client response.
 *
 * For recognised TH codes the RPC's own message is echoed (it is built
 * from public catalogue data — product names, sizes, remaining stock —
 * and is what made the current UX informative). Everything else gets a
 * fixed generic response.
 */
export function mapPlaceOrderError(error: {
  code?: string | null;
  message?: string | null;
}): MappedOrderError {
  const code = (error.code ?? '').toUpperCase();
  const fallback = FALLBACKS[code];

  if (fallback) {
    const raw = sanitizeMessage(error.message ?? '');
    return {
      status: fallback.status,
      body: { error: raw || fallback.message, code: fallback.code },
    };
  }

  return {
    status: 500,
    body: {
      error:
        'We could not place your order right now. Please try again, or message us on WhatsApp (0324-8188616) to place it manually.',
      code: 'SERVER_ERROR',
    },
  };
}
