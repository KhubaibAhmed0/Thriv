'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { ArrowRight, AlertCircle, ChevronDown } from 'lucide-react';
import { useCart } from '@/components/CartProvider';
import { ProductImage } from '@/components/ProductImage';
import { Badge } from '@/components/ui/Badge';
import { formatPrice } from '@/lib/formatPrice';
import type { Province, PaymentMethod } from '@/types';

// ── Zod client schema (mirrors API) ──────────────────────────────────
const CheckoutSchema = z.object({
  customerName: z.string().min(2, 'Full name is required'),
  whatsapp: z
    .string()
    .regex(
      /^(\+92|0092|0)[0-9]{10}$/,
      'Enter a valid Pakistani number (e.g. 03001234567)'
    ),
  email: z.string().email('Enter a valid email address'),
  address: z.string().min(10, 'Enter your full street address'),
  city: z.string().min(2, 'Enter your city'),
  province: z.string().min(1, 'Select a province'),
  notes: z.string().optional(),
});

type FormData = {
  customerName: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  province: string;
  notes: string;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

const PROVINCES: Province[] = [
  'Punjab',
  'Sindh',
  'Khyber Pakhtunkhwa',
  'Balochistan',
  'Gilgit-Baltistan',
  'Azad Jammu & Kashmir',
  'Islamabad Capital Territory',
];

const PAYMENT_METHODS: { id: PaymentMethod; label: string; note?: string }[] = [
  { id: 'cash-on-delivery', label: 'Cash on Delivery (COD)' },
  { id: 'bank-transfer', label: 'Bank Transfer' },
  { id: 'easypaisa', label: 'EasyPaisa' },
  { id: 'jazzcash', label: 'JazzCash' },
  { id: 'card', label: 'Card (Coming Soon)', note: 'Card payments are not yet live. Please select another method.' },
];

export function CheckoutForm() {
  const router = useRouter();
  const { cart, subtotal, deliveryFee, total, clearCart } = useCart();
  const { items } = cart;

  // Generated once on mount; prevents double-submit from creating two orders.
  const [idempotencyKey] = useState<string>(() => crypto.randomUUID());
  const isOrderPlacedRef = useRef(false);

  const [formData, setFormData] = useState<FormData>({
    customerName: '',
    whatsapp: '',
    email: '',
    address: '',
    city: '',
    province: '',
    notes: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash-on-delivery');
  const [agreedToFinalSale, setAgreedToFinalSale] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Redirect to cart if cart is empty and order hasn't just been placed
  useEffect(() => {
    if (!isOrderPlacedRef.current && items.length === 0) {
      router.replace('/cart');
    }
  }, [items.length, router]);

  const setField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const result = CheckoutSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: FormErrors = {};
      result.error.issues.forEach((issue) => {
        const field = String(issue.path[0]) as keyof FormData;
        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) return;

    if (!agreedToFinalSale) {
      setSubmitError('Please confirm you understand all sales are final before placing your order.');
      return;
    }

    if (paymentMethod === 'card') {
      setSubmitError('Card payments are not yet live. Please select another payment method.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Build the payload the new API expects.
      // Client prices are intentionally excluded — server recomputes them.
      const orderPayload = {
        idempotency_key:      idempotencyKey,
        customer_name:        formData.customerName,
        customer_phone:       formData.whatsapp,
        customer_email:       formData.email,
        address_line:         formData.address,
        city:                 formData.city,
        province:             formData.province,
        notes:                formData.notes || null,
        payment_method:       paymentMethod,
        agreed_to_final_sale: agreedToFinalSale,
        items: items.map((item) => ({
          product_slug:  item.product.slug,
          quantity:      item.quantity,
          selected_size: item.selectedSize ?? null,
        })),
      };

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.issues) {
          const serverErrors: FormErrors = {};
          Object.entries(data.issues).forEach(([key, msgs]) => {
            serverErrors[key as keyof FormData] = (msgs as string[])[0];
          });
          setErrors(serverErrors);
        }
        setSubmitError(data.error ?? 'Something went wrong. Please try again.');
        setIsSubmitting(false);
        return;
      }

      const orderNumber: string = data.order_number;
      isOrderPlacedRef.current = true;

      const orderData = {
        orderNumber,
        customerName: formData.customerName,
        whatsapp: formData.whatsapp,
        email: formData.email,
        address: formData.address,
        city: formData.city,
        province: formData.province,
        paymentMethod,
        items: [...items],
        subtotal,
        deliveryFee,
        total: data.total_pkr || total,
        createdAt: new Date().toISOString(),
        notes: formData.notes || undefined,
      };

      try {
        localStorage.setItem(`thriv_order_${orderNumber}`, JSON.stringify(orderData));
      } catch {
        // non-fatal
      }

      clearCart();
      router.replace(`/order/${orderNumber}`);
    } catch {
      setSubmitError('Network error. Please check your connection and try again.');
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    if (isOrderPlacedRef.current) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-[#111111] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-[#444444]">Placing your order and generating receipt...</p>
        </div>
      );
    }
    return null;
  }

  const showAccountDetails = ['bank-transfer', 'easypaisa', 'jazzcash'].includes(paymentMethod);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-[#9A9A9A] mb-8">
        <Link href="/" className="hover:text-[#111111] transition-colors">Home</Link>
        <span>/</span>
        <Link href="/cart" className="hover:text-[#111111] transition-colors">Cart</Link>
        <span>/</span>
        <span className="text-[#111111] font-medium">Checkout</span>
      </nav>

      <h1 className="text-3xl sm:text-4xl font-extrabold text-[#111111] tracking-tight mb-8">Checkout</h1>

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* ── Left: Delivery & Payment Form ── */}
          <div className="lg:col-span-7 space-y-6">

            {/* Delivery Details */}
            <div className="bg-[#EDEBE8] rounded-[20px] p-5 sm:p-6 border border-[#E2E0DC]">
              <h2 className="text-base font-extrabold text-[#111111] mb-5">Delivery Details</h2>

              <div className="space-y-4">
                {/* Full Name */}
                <FieldGroup label="Full Name" id="customerName" required error={errors.customerName}>
                  <input
                    id="customerName"
                    type="text"
                    value={formData.customerName}
                    onChange={(e) => setField('customerName', e.target.value)}
                    placeholder="Ahmed Khan"
                    autoComplete="name"
                    className={inputClass(!!errors.customerName)}
                  />
                </FieldGroup>

                {/* WhatsApp */}
                <FieldGroup label="WhatsApp Number" id="whatsapp" required error={errors.whatsapp} hint="For order confirmation: Pakistani number only">
                  <input
                    id="whatsapp"
                    type="tel"
                    value={formData.whatsapp}
                    onChange={(e) => setField('whatsapp', e.target.value)}
                    placeholder="03001234567"
                    autoComplete="tel"
                    className={inputClass(!!errors.whatsapp)}
                  />
                </FieldGroup>

                {/* Email */}
                <FieldGroup label="Email Address" id="email" required error={errors.email} hint="Order receipt will be sent here">
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setField('email', e.target.value)}
                    placeholder="ahmed@example.com"
                    autoComplete="email"
                    className={inputClass(!!errors.email)}
                  />
                </FieldGroup>

                {/* Street Address */}
                <FieldGroup label="Street Address" id="address" required error={errors.address}>
                  <textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setField('address', e.target.value)}
                    placeholder="House no. / street / area / block..."
                    rows={2}
                    className={inputClass(!!errors.address) + ' resize-none'}
                  />
                </FieldGroup>

                {/* City & Province */}
                <div className="grid grid-cols-2 gap-4">
                  <FieldGroup label="City" id="city" required error={errors.city}>
                    <input
                      id="city"
                      type="text"
                      value={formData.city}
                      onChange={(e) => setField('city', e.target.value)}
                      placeholder="Karachi"
                      autoComplete="address-level2"
                      className={inputClass(!!errors.city)}
                    />
                  </FieldGroup>

                  <FieldGroup label="Province" id="province" required error={errors.province}>
                    <div className="relative">
                      <select
                        id="province"
                        value={formData.province}
                        onChange={(e) => setField('province', e.target.value)}
                        className={inputClass(!!errors.province) + ' appearance-none pr-8 cursor-pointer'}
                      >
                        <option value="">Select province</option>
                        {PROVINCES.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9A9A9A] pointer-events-none" />
                    </div>
                  </FieldGroup>
                </div>

                {/* Notes */}
                <FieldGroup label="Order Notes" id="notes" error={undefined}>
                  <textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setField('notes', e.target.value)}
                    placeholder="Anything we should know? (Optional)"
                    rows={2}
                    className={inputClass(false) + ' resize-none'}
                  />
                </FieldGroup>
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-[#EDEBE8] rounded-[20px] p-5 sm:p-6 border border-[#E2E0DC]">
              <h2 className="text-base font-extrabold text-[#111111] mb-5">Payment Method</h2>

              <div className="space-y-2.5">
                {PAYMENT_METHODS.map((method) => {
                  const isSelected = paymentMethod === method.id;
                  const isDisabled = method.id === 'card';

                  return (
                    <label
                      key={method.id}
                      className={[
                        'flex items-start gap-3 p-4 rounded-[14px] border cursor-pointer transition-all',
                        isDisabled ? 'opacity-50 cursor-not-allowed' : '',
                        isSelected
                          ? 'bg-white border-[#111111] shadow-sm'
                          : 'bg-white/60 border-[#E2E0DC] hover:border-[#111111]',
                      ].join(' ')}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method.id}
                        checked={isSelected}
                        onChange={() => !isDisabled && setPaymentMethod(method.id)}
                        disabled={isDisabled}
                        className="mt-0.5 accent-[#111111] cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-[#111111]">{method.label}</span>
                        {method.note && (
                          <p className="text-xs text-[#9A9A9A] mt-0.5">{method.note}</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Account details panel for bank/mobile wallets */}
              {showAccountDetails && (
                <div className="mt-4 p-4 bg-white rounded-[14px] border border-[#E2E0DC]">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#9A9A9A] mb-2.5">
                    Account Details: {paymentMethod === 'bank-transfer' ? 'Faysal Bank' : paymentMethod === 'easypaisa' ? 'EasyPaisa' : 'JazzCash'}
                  </p>
                  
                  {paymentMethod === 'bank-transfer' ? (
                    <div className="space-y-1.5 text-xs text-[#111111] bg-[#F5F3F0] p-3 rounded-[10px] border border-[#E2E0DC]">
                      <p><span className="text-[#9A9A9A]">Bank:</span> <strong className="font-semibold">Faysal Bank</strong></p>
                      <p><span className="text-[#9A9A9A]">Account Title:</span> <strong className="font-semibold">HASSAN RAZA</strong></p>
                      <p><span className="text-[#9A9A9A]">IBAN:</span> <strong className="font-mono select-all">PK05FAYS3605301000003020</strong></p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-xs text-[#111111] bg-[#F5F3F0] p-3 rounded-[10px] border border-[#E2E0DC]">
                      <p><span className="text-[#9A9A9A]">Provider:</span> <strong className="font-semibold">{paymentMethod === 'easypaisa' ? 'EasyPaisa' : 'JazzCash'}</strong></p>
                      <p><span className="text-[#9A9A9A]">Account Title:</span> <strong className="font-semibold">HASSAN RAZA</strong></p>
                      <p><span className="text-[#9A9A9A]">Account / Mobile:</span> <strong className="font-mono select-all">0324-8188616</strong></p>
                    </div>
                  )}

                  <p className="text-[11px] text-[#444444] mt-3 leading-relaxed">
                    After placing your order, send the payment screenshot on WhatsApp to <strong>0324-8188616</strong> with your order number as reference.
                  </p>
                </div>
              )}
            </div>

            {/* Final Sale Checkbox — Required */}
            <div className="bg-[#F5E6E6] rounded-[16px] p-4 sm:p-5 border border-[#E2C2C2]">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedToFinalSale}
                  onChange={(e) => {
                    setAgreedToFinalSale(e.target.checked);
                    setSubmitError(null);
                  }}
                  className="mt-0.5 w-4 h-4 accent-[#8B2020] cursor-pointer shrink-0"
                />
                <div>
                  <span className="text-xs font-bold text-[#8B2020]">
                    I understand all sales are final: no returns, no exchanges.
                  </span>
                  <p className="text-[10px] text-[#8B2020]/80 mt-1 leading-relaxed">
                    Thrift pieces are one-of-one with exact measurements on the listing. Please verify measurements match your size before confirming. Once this order is placed and dispatched, it cannot be reversed.
                  </p>
                </div>
              </label>
            </div>

          </div>

          {/* ── Right: Sticky Order Summary ── */}
          <div className="lg:col-span-5">
            <div className="bg-[#EDEBE8] rounded-[20px] p-5 sm:p-6 border border-[#E2E0DC] shadow-[0_2px_12px_rgba(0,0,0,0.06)] sticky top-24">
              <h2 className="text-base font-extrabold text-[#111111] mb-4">Your Order</h2>

              {/* Items compact list */}
              <div className="space-y-3 mb-4">
                {items.map((item) => (
                  <div
                    key={`${item.product.id}-${item.selectedSize}`}
                    className="flex items-center gap-3"
                  >
                    <div className="w-12 h-14 rounded-[10px] overflow-hidden shrink-0">
                      <ProductImage
                        slug={item.product.slug}
                        brand={item.product.brand}
                        subcategory={item.product.subcategory}
                        aspectRatio="4:5"
                        alt={item.product.name}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#111111] truncate">{item.product.name}</p>
                      <p className="text-[10px] text-[#9A9A9A]">
                        {item.selectedSize && `Size ${item.selectedSize} · `}
                        {item.quantity > 1 ? `×${item.quantity}` : null}
                      </p>
                      <Badge variant="condition" label={item.product.condition} />
                    </div>
                    <p className="text-sm font-black text-[#111111] shrink-0">
                      {formatPrice(item.product.price * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="border-t border-[#E2E0DC] pt-4 space-y-2 text-sm">
                <div className="flex justify-between text-[#444444]">
                  <span>Subtotal</span>
                  <span className="font-semibold text-[#111111]">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-[#444444]">
                  <span>Delivery (Nationwide)</span>
                  <span className="font-semibold text-[#111111]">{formatPrice(deliveryFee)}</span>
                </div>
              </div>

              <div className="border-t border-[#E2E0DC] mt-3 pt-3 flex justify-between text-base font-extrabold text-[#111111] mb-5">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>

              {/* Submit Error Banner */}
              {submitError && (
                <div className="mb-4 p-3 bg-[#F5E6E6] border border-[#E2C2C2] rounded-[12px] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-[#8B2020] shrink-0 mt-0.5" />
                  <p className="text-xs text-[#8B2020] font-medium leading-relaxed">{submitError}</p>
                </div>
              )}

              {/* Place Order CTA */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full inline-flex items-center justify-center gap-2 bg-[#111111] text-white font-bold text-sm py-4 rounded-full hover:bg-black disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.12)] active:scale-[0.99] cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Placing Order...
                  </>
                ) : (
                  <>
                    Place Order · {formatPrice(total)}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="text-[10px] text-center text-[#9A9A9A] mt-3 leading-relaxed">
                By placing this order, you agree to Thriv&apos;s final sale policy. No returns or exchanges.
              </p>
            </div>
          </div>

        </div>
      </form>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────
function inputClass(hasError: boolean) {
  return [
    'w-full text-sm text-[#111111] placeholder:text-[#9A9A9A] bg-white border rounded-[10px] px-4 py-2.5 outline-none transition-all',
    hasError
      ? 'border-[#8B2020] focus:ring-2 focus:ring-[#8B2020]/20'
      : 'border-[#E2E0DC] focus:border-[#111111] focus:ring-2 focus:ring-[#111111]/8',
  ].join(' ');
}

function FieldGroup({
  label,
  id,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  id: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-[#111111] mb-1.5">
        {label}
        {required && <span className="text-[#8B2020] ml-0.5">*</span>}
        {hint && <span className="font-normal text-[#9A9A9A] ml-1">({hint})</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-[#8B2020] mt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
