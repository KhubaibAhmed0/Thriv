import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { CartItem } from '@/types';

// ── Zod Validation Schema ─────────────────────────────────────────────
const OrderRequestSchema = z.object({
  customerName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  whatsapp: z
    .string()
    .regex(
      /^(\+92|0092|0)[0-9]{10}$/,
      'Enter a valid Pakistani number (e.g. 0300-1234567 or +923001234567)'
    ),
  email: z.string().email('Enter a valid email address'),
  address: z.string().min(10, 'Please enter your full street address').max(300),
  city: z.string().min(2, 'Please enter your city').max(100),
  province: z.enum([
    'Punjab',
    'Sindh',
    'Khyber Pakhtunkhwa',
    'Balochistan',
    'Gilgit-Baltistan',
    'Azad Jammu & Kashmir',
    'Islamabad Capital Territory',
  ]),
  notes: z.string().max(500).optional(),
  paymentMethod: z.enum([
    'cash-on-delivery',
    'bank-transfer',
    'easypaisa',
    'jazzcash',
    'card',
  ]),
  items: z
    .array(
      z.object({
        product: z.object({
          id: z.string(),
          slug: z.string(),
          name: z.string(),
          brand: z.string(),
          price: z.number().int().min(999).max(2499),
          isMerch: z.boolean(),
          stock: z.number().int().min(0),
          size: z.string().nullable(),
          condition: z.enum(['Premium', 'Excellent', 'Very Good']),
          category: z.string(),
          subcategory: z.string(),
          gender: z.string().optional(),
          sizes: z.array(z.string()).nullable(),
          images: z.array(z.string()),
          description: z.string(),
          measurements: z.record(z.string(), z.string()).optional(),
          colors: z.array(z.string()).optional(),
          isFeatured: z.boolean().optional(),
        }),
        quantity: z.number().int().min(1).max(40),
        selectedSize: z.string().optional(),
      })
    )
    .min(1, 'Cart is empty'),
  agreedToFinalSale: z
    .boolean({ message: 'You must agree to the final sale policy' })
    .refine((val) => val === true, { message: 'You must agree to the final sale policy' }),
});

// ── Order Number Generator ────────────────────────────────────────────
function generateOrderNumber(): string {
  const now = new Date();
  const date = now
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');
  const random = Math.floor(100000 + Math.random() * 900000).toString();
  return `THR-${date}-${random}`;
}

// ── Price Calculation ─────────────────────────────────────────────────
function calculateTotals(items: CartItem[]) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const deliveryFee = items.length > 0 ? 200 : 0;
  return { subtotal, deliveryFee, total: subtotal + deliveryFee };
}

// ── POST /api/orders ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Zod validation
    const parsed = OrderRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const { subtotal, deliveryFee, total } = calculateTotals(
      data.items as CartItem[]
    );
    const orderNumber = generateOrderNumber();
    const createdAt = new Date().toISOString();

    const order = {
      orderNumber,
      customerName: data.customerName,
      whatsapp: data.whatsapp,
      email: data.email,
      address: data.address,
      city: data.city,
      province: data.province,
      notes: data.notes,
      paymentMethod: data.paymentMethod,
      items: data.items,
      subtotal,
      deliveryFee,
      total,
      createdAt,
    };

    // ── TODO: Send order confirmation email ─────────────────────────
    // Stub: integrate with a transactional email provider (e.g. Resend, SendGrid)
    // await sendOrderConfirmationEmail({ to: order.email, order });

    // ── TODO: Send WhatsApp confirmation message ────────────────────
    // Stub: integrate with WhatsApp Business API or Twilio for WhatsApp
    // await sendWhatsAppConfirmation({ to: order.whatsapp, order });

    // ── TODO: Persist order to database ────────────────────────────
    // Stub: e.g. Supabase, PlanetScale, or Google Sheets via API
    // await db.orders.create({ data: order });

    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    console.error('[/api/orders] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error. Please try again or contact us on WhatsApp.' },
      { status: 500 }
    );
  }
}
