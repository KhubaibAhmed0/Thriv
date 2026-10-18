'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { ArrowRight, AlertCircle, ChevronDown, MessageCircle } from 'lucide-react';
import { useCart } from '@/components/CartProvider';
import { ProductImage } from '@/components/ProductImage';
import { Badge } from '@/components/ui/Badge';
import { TurnstileWidget } from '@/components/TurnstileWidget';
import { formatPrice } from '@/lib/formatPrice';
import {
  PROVINCES,
  isProvince,
  isValidPakistaniPhone,
  normalizePakistaniPhone,
} from '@/lib/validation';
import type { PaymentMethod } from '@/types';

const IDEMPOTENCY_STORAGE_KEY = 'thriv_checkout_idem';
const WHATSAPP_NUMBER = '923248188616';

// ── Zod client schema (mirrors API; shared phone/province validators) ─
const CheckoutSchema = z.object({
  customerName: z.string().min(2, 'Full name is required'),
  whatsapp: z
    .string()
    .refine(
      isValidPakistaniPhone,
      'Enter a valid Pakistani number (e.g. 03001234567)'
    ),
  email: z.string().email('Enter a valid email address'),
  address: z.string().min(10, 'Enter your full street address'),
  city: z.string().min(2, 'Enter your city'),
  province: z
    .string()
    .min(1, 'Select a province')
    .refine(isProvince, 'Select a valid province'),
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

// Focus order for the first invalid field (audit F-28).
const FIELD_ORDER: (keyof FormData)[] = [
  'customerName',
  'whatsapp',
  'email',
  'address',
  'city',
  'province',
];

const PAYMENT_METHODS: { id: PaymentMethod; label: string; note?: string }[] = [
  { id: 'cash-on-delivery', label: 'Cash on Delivery (COD)' },
  { id: 'bank-transfer', label: 'Bank Transfer' },
  { id: 'easypaisa', label: 'EasyPaisa' },
  { id: 'jazzcash', label: 'JazzCash' },
  { id: 'card', label: 'Card (Coming Soon)', note: 'Card payments are not yet live. Please select another method.' },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function CheckoutForm() {
  const router = useRouter();
  const { cart, isHydrated, subtotal, deliveryFee, total, clearCart } = useCart();
  const { items } = cart;

  // Generated once per checkout attempt, persisted in sessionStorage so a
  // reload after a network failure reuses the same key (audit F-19) —
  // resubmitting can never create a second order.
  const [idempotencyKey] = useState<string>(() => {
    if (typeof window === 'undefined') return crypto.randomUUID();
    try {
      const stored = sessionStorage.getItem(IDEMPOTENCY_STORAGE_KEY);
      if (stored && UUID_RE.test(stored)) return stored;
      const fresh = crypto.randomUUID();
      sessionStorage.setItem(IDEMPOTENCY_STORAGE_KEY, fresh);
      return fresh;
    } catch {
      return crypto.randomUUID();
    }
  });
  const [orderPlaced, setOrderPlaced] = useState(false);
  // Audit F-50 / SEC-19: set when the API reports an idempotent replay —
  // the order existed already and the API (deliberately) returned no data.
  const [replayed, setReplayed] = useState(false);

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
  const [checkoutUnavailable, setCheckoutUnavailable] = useState(false);
  // Phase 4 (2026-10-18 brief): Turnstile + honeypot.
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [widgetKey, setWidgetKey] = useState(0);
  const [honeypot, setHoneypot] = useState('');

  const resetTurnstile = () => {
    setTurnstileToken(null);
    setTurnstileReady(false);
    setWidgetKey((k) => k + 1);
  };

  // Redirect to cart if the cart is empty — but ONLY after hydration
  // (audit F-07). Before hydration items.length === 0 is meaningless and
  // bouncing early discards a filled form on refresh/deep-link.
  useEffect(() => {
    if (isHydrated && !orderPlaced && items.length === 0) {
      router.replace('/cart');
    }
  }, [isHydrated, orderPlaced, items.length, router]);

  const setField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Validate a single field on blur (audit F-28) and normalize phone
  // formats people actually paste (audit F-29).
  const handleBlur = (field: keyof FormData) => {
    let value = formData[field];

    if (field === 'whatsapp' && value.trim()) {
      const normalized = normalizePakistaniPhone(value);
      value = normalized;
      if (normalized !== formData.whatsapp) {
        setFormData((prev) => ({ ...prev, whatsapp: normalized }));
      }
    }

    const result = CheckoutSchema.shape[field].safeParse(value);
    setErrors((prev) => ({
      ...prev,
      [field]: result.success ? undefined : result.error.issues[0]?.message,
    }));
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

      // Move focus to the first invalid field (audit F-28).
      const firstInvalid = FIELD_ORDER.find((f) => fieldErrors[f]);
      if (firstInvalid) {
        requestAnimationFrame(() => {
          document.getElementById(firstInvalid)?.focus();
        });
      }
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setCheckoutUnavailable(false);

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
      // Build the payload the API expects.
      // Client prices are intentionally excluded — the server recomputes them.
      const orderPayload = {
        idempotency_key:      idempotencyKey,
        customer_name:        formData.customerName,
        customer_phone:       normalizePakistaniPhone(formData.whatsapp),
        customer_email:       formData.email,
        address_line:         formData.address,
        city:                 formData.city,
        province:             formData.province,
        notes:                formData.notes || null,
        payment_method:       paymentMethod,
        agreed_to_final_sale: agreedToFinalSale,
        turnstile_token:      turnstileToken,
        website:              honeypot,
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

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data.issues) {
          const serverErrors: FormErrors = {};
          Object.entries(data.issues).forEach(([key, msgs]) => {
            serverErrors[key as keyof FormData] = (msgs as string[])[0];
          });
          setErrors(serverErrors);
        }
        setSubmitError(data.error ?? 'Something went wrong. Please try again.');
        setCheckoutUnavailable(
          data.code === 'CHECKOUT_UNAVAILABLE' || response.status === 503
        );
        // The Turnstile token was single-use; arm a fresh widget for retry.
        resetTurnstile();
        setIsSubmitting(false);
        return;
      }

      // Audit F-50 / SEC-19: an idempotent replay means the original
      // attempt already created this order (its response was lost). The
      // API returns no order data on replay, so show the "already
      // submitted" notice rather than a receipt we cannot back up.
      if (data.idempotent === true) {
        setReplayed(true);
        try {
          sessionStorage.removeItem(IDEMPOTENCY_STORAGE_KEY);
        } catch {
          // non-fatal
        }
        clearCart();
        return;
      }

      const orderNumber: string = data.order_number;
      const publicToken: string = data.public_token;

      // Defence in depth: a success response without a token-shaped public
      // token would break the confirmation page — surface an error instead
      // of redirecting to a dead URL.
      if (typeof publicToken !== 'string' || !UUID_RE.test(publicToken)) {
        setSubmitError('Something went wrong. Please message us on WhatsApp (0324-8188616).');
        setIsSubmitting(false);
        return;
      }

      setOrderPlaced(true);

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
        // TTL marker: the confirmation page ignores snapshots older than 24h (audit F-58).
        savedAt: new Date().toISOString(),
        notes: formData.notes || undefined,
      };

      try {
        localStorage.setItem(`thriv_order_${publicToken}`, JSON.stringify(orderData));
      } catch {
        // non-fatal
      }

      // Next checkout attempt gets a fresh idempotency key.
      try {
        sessionStorage.removeItem(IDEMPOTENCY_STORAGE_KEY);
      } catch {
        // non-fatal
      }

      clearCart();
      router.replace(`/order/${publicToken}`);
    } catch {
      setSubmitError('Network error. Please check your connection and try again.');
      setIsSubmitting(false);
    }
  };

  // Wait for hydration before deciding anything about "empty" (audit F-07).
  if (!isHydrated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    if (replayed) {
      return (
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h1 className="text-2xl font-extrabold text-black tracking-tight">
            Order already submitted
          </h1>
          <p className="mt-3 text-sm text-body leading-relaxed">
            It looks like this order was already placed a moment ago — please don&apos;t
            re-order. If you don&apos;t hear from us on WhatsApp within a few hours,
            message us at{' '}
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-black underline"
            >
              0324-8188616
            </a>{' '}
            with your name and the items you ordered.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/shop"
              className="inline-flex items-center justify-center px-6 py-3 bg-black text-white text-sm font-semibold rounded-full hover:bg-black transition-colors"
            >
              Continue shopping
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-6 py-3 border border-neutral-300 text-body text-sm font-semibold rounded-full hover:border-black hover:text-black transition-colors"
            >
              Back to home
            </Link>
          </div>
        </div>
      );
    }
    if (orderPlaced) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-body">Placing your order and generating receipt...</p>
        </div>
      );
    }
    return null;
  }

  const showAccountDetails = ['bank-transfer', 'easypaisa', 'jazzcash'].includes(paymentMethod);
  const hasFieldErrors = Object.values(errors).some(Boolean);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-muted-text mb-8">
        <Link href="/" className="hover:text-black transition-colors">Home</Link>
        <span>/</span>
        <Link href="/cart" className="hover:text-black transition-colors">Cart</Link>
        <span>/</span>
        <span className="text-black font-medium">Checkout</span>
      </nav>

      <h1 className="text-3xl sm:text-4xl font-extrabold text-black tracking-tight mb-8">Checkout</h1>

      {/* Error summary — role="alert" + placed above the fold (audit F-28) */}
      {hasFieldErrors && (
        <div role="alert" className="mb-6 p-3 bg-badge-sold-bg border border-badge-sold-border rounded-[12px] flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-badge-sold-text shrink-0 mt-0.5" />
          <p className="text-xs text-badge-sold-text font-medium leading-relaxed">
            Please fix the highlighted fields below and try again.
          </p>
        </div>
      )}

      {/* Submit error — announced, with the WhatsApp fallback when checkout
          is down (audit F-05/F-28) */}
      {submitError && (
        <div role="alert" className="mb-6 p-3 bg-badge-sold-bg border border-badge-sold-border rounded-[12px] flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-badge-sold-text shrink-0 mt-0.5" />
          <div className="space-y-2.5">
            <p className="text-xs text-badge-sold-text font-medium leading-relaxed">{submitError}</p>
            {checkoutUnavailable && (
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
                  'Hi Thriv! Checkout on the website says it is temporarily unavailable. I would like to place my order on WhatsApp instead.'
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-black text-white text-xs font-semibold px-4 py-2 rounded-full hover:bg-black transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Order on WhatsApp instead
              </a>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="relative">
        {/* Honeypot — off-screen and aria-hidden; humans never see or fill it */}
        <div className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden" aria-hidden="true">
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* ── Left: Delivery & Payment Form ── */}
          <div className="lg:col-span-7 space-y-6">

            {/* Delivery Details */}
            <div className="bg-card rounded-[20px] p-5 sm:p-6 border border-border">
              <h2 className="text-base font-extrabold text-black mb-5">Delivery Details</h2>

              <div className="space-y-4">
                {/* Full Name */}
                <FieldGroup label="Full Name" id="customerName" required error={errors.customerName}>
                  <input
                    id="customerName"
                    type="text"
                    value={formData.customerName}
                    onChange={(e) => setField('customerName', e.target.value)}
                    onBlur={() => handleBlur('customerName')}
                    aria-invalid={!!errors.customerName}
                    aria-describedby={errors.customerName ? 'customerName-error' : undefined}
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
                    inputMode="tel"
                    value={formData.whatsapp}
                    onChange={(e) => setField('whatsapp', e.target.value)}
                    onBlur={() => handleBlur('whatsapp')}
                    aria-invalid={!!errors.whatsapp}
                    aria-describedby={errors.whatsapp ? 'whatsapp-error' : undefined}
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
                    onBlur={() => handleBlur('email')}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'email-error' : undefined}
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
                    onBlur={() => handleBlur('address')}
                    aria-invalid={!!errors.address}
                    aria-describedby={errors.address ? 'address-error' : undefined}
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
                      onBlur={() => handleBlur('city')}
                      aria-invalid={!!errors.city}
                      aria-describedby={errors.city ? 'city-error' : undefined}
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
                        onBlur={() => handleBlur('province')}
                        aria-invalid={!!errors.province}
                        aria-describedby={errors.province ? 'province-error' : undefined}
                        className={inputClass(!!errors.province) + ' appearance-none pr-8 cursor-pointer'}
                      >
                        <option value="">Select province</option>
                        {PROVINCES.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-text pointer-events-none" />
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
            <div className="bg-card rounded-[20px] p-5 sm:p-6 border border-border">
              <h2 className="text-base font-extrabold text-black mb-5">Payment Method</h2>

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
                          ? 'bg-white border-black shadow-sm'
                          : 'bg-white/60 border-border hover:border-black',
                      ].join(' ')}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method.id}
                        checked={isSelected}
                        onChange={() => !isDisabled && setPaymentMethod(method.id)}
                        disabled={isDisabled}
                        className="mt-0.5 accent-black cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-black">{method.label}</span>
                        {method.note && (
                          <p className="text-xs text-muted-text mt-0.5">{method.note}</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Account details panel for bank/mobile wallets */}
              {showAccountDetails && (
                <div className="mt-4 p-4 bg-white rounded-[14px] border border-border">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-text mb-2.5">
                    Account Details: {paymentMethod === 'bank-transfer' ? 'Faysal Bank' : paymentMethod === 'easypaisa' ? 'EasyPaisa' : 'JazzCash'}
                  </p>
                  
                  {paymentMethod === 'bank-transfer' ? (
                    <div className="space-y-1.5 text-xs text-black bg-page p-3 rounded-[10px] border border-border">
                      <p><span className="text-muted-text">Bank:</span> <strong className="font-semibold">Faysal Bank</strong></p>
                      <p><span className="text-muted-text">Account Title:</span> <strong className="font-semibold">HASSAN RAZA</strong></p>
                      <p><span className="text-muted-text">IBAN:</span> <strong className="font-mono select-all">PK05FAYS3605301000003020</strong></p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-xs text-black bg-page p-3 rounded-[10px] border border-border">
                      <p><span className="text-muted-text">Provider:</span> <strong className="font-semibold">{paymentMethod === 'easypaisa' ? 'EasyPaisa' : 'JazzCash'}</strong></p>
                      <p><span className="text-muted-text">Account Title:</span> <strong className="font-semibold">HASSAN RAZA</strong></p>
                      <p><span className="text-muted-text">Account / Mobile:</span> <strong className="font-mono select-all">0324-8188616</strong></p>
                    </div>
                  )}

                  <p className="text-[11px] text-body mt-3 leading-relaxed">
                    After placing your order, send the payment screenshot on WhatsApp to <strong>0324-8188616</strong> with your order number as reference.
                  </p>
                </div>
              )}
            </div>

            {/* Final Sale Checkbox — Required */}
            <div className="bg-badge-sold-bg rounded-[16px] p-4 sm:p-5 border border-badge-sold-border">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedToFinalSale}
                  onChange={(e) => {
                    setAgreedToFinalSale(e.target.checked);
                    setSubmitError(null);
                    setCheckoutUnavailable(false);
                  }}
                  className="mt-0.5 w-4 h-4 accent-badge-sold-text cursor-pointer shrink-0"
                />
                <div>
                  <span className="text-xs font-bold text-badge-sold-text">
                    I understand all sales are final: no returns, no exchanges.
                  </span>
                  <p className="text-[10px] text-badge-sold-text/80 mt-1 leading-relaxed">
                    Thrift pieces are one-of-one with exact measurements on the listing. Please verify measurements match your size before confirming. Once this order is placed and dispatched, it cannot be reversed.
                  </p>
                </div>
              </label>
            </div>

          </div>

          {/* ── Right: Sticky Order Summary ── */}
          <div className="lg:col-span-5">
            <div className="bg-card rounded-[20px] p-5 sm:p-6 border border-border shadow-[0_2px_12px_rgba(0,0,0,0.06)] sticky top-24">
              <h2 className="text-base font-extrabold text-black mb-4">Your Order</h2>

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
                      <p className="text-xs font-semibold text-black truncate">{item.product.name}</p>
                      <p className="text-[10px] text-muted-text">
                        {item.selectedSize && `Size ${item.selectedSize} · `}
                        {item.quantity > 1 ? `×${item.quantity}` : null}
                      </p>
                      <Badge variant="condition" label={item.product.condition} />
                    </div>
                    <p className="text-sm font-black text-black shrink-0">
                      {formatPrice(item.product.price * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-4 space-y-2 text-sm">
                <div className="flex justify-between text-body">
                  <span>Subtotal</span>
                  <span className="font-semibold text-black">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-body">
                  <span>Delivery (Nationwide)</span>
                  <span className="font-semibold text-black">{formatPrice(deliveryFee)}</span>
                </div>
              </div>

              <div className="border-t border-border mt-3 pt-3 flex justify-between text-base font-extrabold text-black mb-5">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>

              {/* Turnstile widget (brief 4a) — remounts per attempt via key */}
              <TurnstileWidget
                key={widgetKey}
                theme="light"
                onToken={setTurnstileToken}
                onReady={() => setTurnstileReady(true)}
                className="flex justify-center mb-3"
              />

              {/* Place Order CTA */}
              <button
                type="submit"
                disabled={isSubmitting || (turnstileReady && !turnstileToken)}
                className="w-full inline-flex items-center justify-center gap-2 bg-black text-white font-bold text-sm py-4 rounded-full hover:bg-black disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.12)] active:scale-[0.99] cursor-pointer"
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

              <p className="text-[10px] text-center text-muted-text mt-3 leading-relaxed">
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
    'w-full text-sm text-black placeholder:text-muted-text bg-white border rounded-[10px] px-4 py-2.5 outline-none transition-all',
    hasError
      ? 'border-badge-sold-text focus:ring-2 focus:ring-badge-sold-text/20'
      : 'border-border focus:border-black focus:ring-2 focus:ring-black/8',
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
      <label htmlFor={id} className="block text-xs font-bold text-black mb-1.5">
        {label}
        {required && <span className="text-badge-sold-text ml-0.5">*</span>}
        {hint && <span className="font-normal text-muted-text ml-1">({hint})</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-badge-sold-text mt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
