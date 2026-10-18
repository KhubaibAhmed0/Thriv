/**
 * lib/email.ts
 *
 * Transactional order confirmation email via Resend.
 * Server-side only. Uses RESEND_API_KEY (non-public env var).
 * If RESEND_API_KEY is unset, the send is reported as NOT successful and a
 * clearly marked stub log is emitted — callers and UI copy must never claim
 * an email was sent when it was not (audit F-26).
 */

import { errorMessage } from '@/lib/errors';
import { log } from '@/lib/log';
import { SITE_URL } from '@/lib/site-url';

interface SendOrderEmailParams {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  totalPkr: number;
  deliveryAddress: string;
  items: Array<{
    name?: string;
    product_slug?: string;
    quantity: number;
    unit_price_pkr?: number;
  }>;
}

/** True when the Resend API key is present and looks real (audit F-26). */
export function isEmailConfigured(): boolean {
  const apiKey = process.env.RESEND_API_KEY;
  return Boolean(apiKey && apiKey !== '<resend_api_key>');
}

/**
 * Audit F-82: the confirmation email is plain text, so HTML escaping is
 * not the concern — newline/control-character spoofing is. Customer-supplied
 * strings (name, address) and catalogue strings are flattened to a single
 * line and length-capped before interpolation.
 */
function sanitizeEmailLine(value: string, maxLen = 160): string {
  return value
    .replace(/[\r\n\t\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export async function sendOrderConfirmationEmail(params: SendOrderEmailParams): Promise<{
  success: boolean;
  stub?: boolean;
  error?: string;
}> {
  const apiKey = process.env.RESEND_API_KEY;
  // If RESEND_FROM_EMAIL is set (e.g. 'orders@thriv.pk' after domain verification in Resend), use it.
  // Otherwise default to 'onboarding@resend.dev' which works out-of-the-box on Resend free tier.
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  if (!isEmailConfigured()) {
    // Order number only — never the customer's email address (Phase 6f).
    log.warn(
      `[email] Resend stub: confirmation for ${params.orderNumber} skipped (RESEND_API_KEY not set).`
    );
    return { success: false, stub: true };
  }

  const safeName = sanitizeEmailLine(params.customerName, 80);
  const safeAddress = sanitizeEmailLine(params.deliveryAddress, 240);

  const itemsList = params.items
    .map(
      (item) =>
        `- ${sanitizeEmailLine(item.name || item.product_slug || 'Item', 120)} x${item.quantity}`
    )
    .join('\n');

  const textBody = `
Assalam o Alaikum ${safeName},

Thank you for your order with Thriv (@thriv.pk).

Order Number: ${params.orderNumber}
Total: Rs ${params.totalPkr.toLocaleString()}
Delivery Address: ${safeAddress}

Items:
${itemsList}

Please note: As stated during checkout, all sales are final for curated vintage denim (no returns or exchanges).

If you chose Bank Transfer, EasyPaisa, or JazzCash, please share your payment screenshot on WhatsApp to 0324-8188616 referencing your order number.

Thriv Karachi
${SITE_URL}
`.trim();

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail.includes('<') ? fromEmail : `Thriv <${fromEmail}>`,
        to: [params.customerEmail],
        subject: `Order Confirmation: ${params.orderNumber}`,
        text: textBody,
      }),
      // Never let a stalled email provider hold the request open (F-19).
      signal: AbortSignal.timeout(5000),
    });

    const resData = await res.json().catch(() => ({}));

    if (!res.ok) {
      log.error('[email] Resend rejected the send:', resData?.message ?? 'unknown');
      return {
        success: false,
        error: resData?.message || 'Resend API rejected the email request',
      };
    }

    log.info(`[email] Confirmation sent for order ${params.orderNumber} (id: ${resData?.id})`);
    return { success: true };
  } catch (err) {
    log.error('[email] Network error sending email:', err);
    return { success: false, error: errorMessage(err, 'Network error sending email') };
  }
}
