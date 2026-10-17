'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle, MessageCircle, ShoppingBag } from 'lucide-react';
import { formatPrice } from '@/lib/formatPrice';
import type { CartItem } from '@/types';

const PAYMENT_LABELS: Record<string, string> = {
  'cash-on-delivery': 'Cash on Delivery',
  'bank-transfer': 'Bank Transfer',
  'easypaisa': 'EasyPaisa',
  'jazzcash': 'JazzCash',
  'card': 'Card',
};

// DB enum values → the client-side ids the UI already speaks.
const ENUM_TO_CLIENT: Record<string, string> = {
  cod: 'cash-on-delivery',
  bank_transfer: 'bank-transfer',
  easypaisa: 'easypaisa',
  jazzcash: 'jazzcash',
  card: 'card',
};

const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;

interface OrderData {
  orderNumber: string;
  customerName: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  province: string;
  paymentMethod: string;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  savedAt?: string;
  notes?: string;
}

interface ServerOrderItem {
  name: string;
  brand: string | null;
  size: string | null;
  quantity: number;
  unit_price_pkr: number;
}

interface ServerOrder {
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  subtotal_pkr: number;
  delivery_fee_pkr: number;
  total_pkr: number;
  created_at: string;
  items: ServerOrderItem[];
}

/** Unified view model. PII fields exist only when the local snapshot does. */
interface ViewOrder {
  items: { name: string; brand?: string | null; size?: string | null; quantity: number; unitPrice: number }[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  customerName?: string;
  email?: string;
  whatsapp?: string;
  address?: string;
  city?: string;
  province?: string;
  notes?: string;
}

function snapshotToView(snap: OrderData): ViewOrder {
  return {
    customerName: snap.customerName,
    email: snap.email,
    whatsapp: snap.whatsapp,
    address: snap.address,
    city: snap.city,
    province: snap.province,
    notes: snap.notes,
    paymentMethod: snap.paymentMethod,
    subtotal: snap.subtotal,
    deliveryFee: snap.deliveryFee,
    total: snap.total,
    items: (snap.items ?? []).map((item) => ({
      name: item.product?.name ?? 'Item',
      brand: item.product?.brand ?? null,
      size: item.selectedSize ?? null,
      quantity: item.quantity,
      unitPrice: item.product?.price ?? 0,
    })),
  };
}

function serverToView(server: ServerOrder): ViewOrder {
  return {
    paymentMethod: ENUM_TO_CLIENT[server.payment_method] ?? server.payment_method,
    subtotal: server.subtotal_pkr,
    deliveryFee: server.delivery_fee_pkr,
    total: server.total_pkr,
    items: (server.items ?? []).map((item) => ({
      name: item.name,
      brand: item.brand,
      size: item.size,
      quantity: item.quantity,
      unitPrice: item.unit_price_pkr,
    })),
  };
}

interface OrderConfirmationClientProps {
  orderNumber: string;
}

export function OrderConfirmationClient({ orderNumber }: OrderConfirmationClientProps) {
  const [snapshotView, setSnapshotView] = useState<ViewOrder | null>(null);
  const [serverView, setServerView] = useState<ViewOrder | null>(null);
  const [serverDone, setServerDone] = useState(false);

  // The page can render as soon as either source lands: the snapshot
  // immediately (when present), otherwise the server lookup.
  const loading = !serverDone && snapshotView === null;

  useEffect(() => {
    let cancelled = false;

    // 1. Local snapshot (fast path) — ignored when older than the TTL so a
    //    shared device doesn't leak stale order details (audit F-58).
    try {
      const key = `thriv_order_${orderNumber}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed: OrderData = JSON.parse(stored);
        const savedAt = parsed?.savedAt ? Date.parse(parsed.savedAt) : NaN;
        if (Number.isFinite(savedAt) && Date.now() - savedAt <= SNAPSHOT_TTL_MS) {
          setSnapshotView(snapshotToView(parsed));
        } else {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // Silently ignore — the server lookup below still covers the page.
    }

    // 2. Server truth — authoritative items/totals, works cross-device.
    fetch(`/api/orders/${encodeURIComponent(orderNumber)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.order) {
          setServerView(serverToView(data.order as ServerOrder));
        }
      })
      .catch(() => {
        // Network hiccup: snapshot (if any) keeps the page useful.
      })
      .finally(() => {
        if (!cancelled) setServerDone(true);
      });

    return () => {
      cancelled = true;
    };
  }, [orderNumber]);

  // Server data wins for items/money/payment; PII comes only from the
  // snapshot (the API intentionally returns none).
  const view: ViewOrder | null = serverView
    ? { ...(snapshotView ?? {}), ...serverView }
    : snapshotView;

  const whatsappNumber = '923248188616';
  const whatsappMessage = encodeURIComponent(
    `Hi Thriv! I just placed an order. My order number is ${orderNumber}. Please confirm.`
  );
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

  const isNonCod =
    view && ['bank-transfer', 'easypaisa', 'jazzcash'].includes(view.paymentMethod);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#111111] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">

      {/* Success Header */}
      <div className="text-center mb-10">
        <div className="w-16 h-16 rounded-full bg-[#E8F0E0] border border-[#C5DEBB] flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-8 h-8 text-[#3A6B35]" />
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-[#3A6B35] mb-2">
          Order Placed Successfully
        </p>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#111111] leading-tight">
          Thank You{view?.customerName ? `, ${view.customerName.split(' ')[0]}` : ''}!
        </h1>
        <div className="mt-3 inline-block bg-[#EDEBE8] border border-[#E2E0DC] px-4 py-2 rounded-full">
          <p className="text-sm font-mono font-bold text-[#111111] tracking-wider">
            Order: {orderNumber}
          </p>
        </div>
        <p className="text-sm text-[#444444] mt-3 leading-relaxed">
          {view?.email
            ? `Confirmation will be sent to ${view.email} and messaged to ${view.whatsapp} shortly.`
            : 'Your order has been received. You will receive a confirmation on WhatsApp shortly.'}
        </p>
      </div>

      {/* What Happens Next */}
      <div className="bg-[#EDEBE8] rounded-[20px] p-5 sm:p-6 border border-[#E2E0DC] mb-6">
        <h2 className="text-sm font-extrabold text-[#111111] uppercase tracking-wider mb-5">
          What Happens Next
        </h2>

        <div className="space-y-4">
          <div className="flex items-start gap-3.5">
            <div className="w-7 h-7 rounded-full bg-[#111111] text-white text-xs font-bold flex items-center justify-center shrink-0">
              1
            </div>
            <div>
              <p className="text-sm font-semibold text-[#111111]">Confirm on WhatsApp</p>
              <p className="text-xs text-[#444444] mt-0.5 leading-relaxed">
                Send us a quick message with your order number. We&apos;ll acknowledge and confirm availability.
              </p>
            </div>
          </div>

          {isNonCod && (
            <div className="flex items-start gap-3.5">
              <div className="w-7 h-7 rounded-full bg-[#111111] text-white text-xs font-bold flex items-center justify-center shrink-0">
                2
              </div>
              <div>
                <p className="text-sm font-semibold text-[#111111]">
                  Send Payment Screenshot
                </p>
                <p className="text-xs text-[#444444] mt-0.5 leading-relaxed">
                  Transfer{' '}
                  <strong>{view ? formatPrice(view.total) : 'your total'}</strong> via{' '}
                  {PAYMENT_LABELS[view?.paymentMethod ?? ''] ?? 'your chosen method'} and share the screenshot on WhatsApp (<strong>0324-8188616</strong>) with your order number.
                </p>
                {view?.paymentMethod === 'bank-transfer' && (
                  <div className="mt-2 p-3 bg-white rounded-[12px] border border-[#E2E0DC] text-xs space-y-1">
                    <p className="font-bold text-[#111111]">Faysal Bank</p>
                    <p className="text-[#444444]">Title: <span className="font-semibold text-[#111111]">HASSAN RAZA</span></p>
                    <p className="font-mono text-[#111111] select-all">IBAN: PK05FAYS3605301000003020</p>
                  </div>
                )}
                {(view?.paymentMethod === 'easypaisa' || view?.paymentMethod === 'jazzcash') && (
                  <div className="mt-2 p-3 bg-white rounded-[12px] border border-[#E2E0DC] text-xs space-y-1">
                    <p className="font-bold text-[#111111]">{PAYMENT_LABELS[view.paymentMethod]}</p>
                    <p className="text-[#444444]">Title: <span className="font-semibold text-[#111111]">HASSAN RAZA</span></p>
                    <p className="font-mono text-[#111111] select-all">Account: 0324-8188616</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-start gap-3.5">
            <div className="w-7 h-7 rounded-full bg-[#111111] text-white text-xs font-bold flex items-center justify-center shrink-0">
              {isNonCod ? '3' : '2'}
            </div>
            <div>
              <p className="text-sm font-semibold text-[#111111]">Dispatch & Tracking</p>
              <p className="text-xs text-[#444444] mt-0.5 leading-relaxed">
                We dispatch from Karachi within 1–2 working days. You&apos;ll receive a courier tracking number on WhatsApp once dispatched. Estimated delivery: 3–7 working days.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Order Summary (server-sourced when available) */}
      {view && view.items.length > 0 && (
        <div className="bg-[#EDEBE8] rounded-[20px] p-5 sm:p-6 border border-[#E2E0DC] mb-6">
          <h2 className="text-sm font-extrabold text-[#111111] uppercase tracking-wider mb-4">
            Order Summary
          </h2>

          <div className="space-y-2 text-sm mb-4">
            {view.items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[#111111] font-medium truncate">{item.name}</p>
                  <p className="text-[10px] text-[#9A9A9A]">
                    {item.size && `Size ${item.size} · `}
                    {item.brand}
                    {item.quantity > 1 ? ` · ×${item.quantity}` : ''}
                  </p>
                </div>
                <p className="font-semibold text-[#111111] shrink-0">
                  {formatPrice(item.unitPrice * item.quantity)}
                </p>
              </div>
            ))}
          </div>

          <div className="border-t border-[#E2E0DC] pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-[#444444]">
              <span>Subtotal</span>
              <span>{formatPrice(view.subtotal)}</span>
            </div>
            <div className="flex justify-between text-[#444444]">
              <span>Delivery</span>
              <span>{formatPrice(view.deliveryFee)}</span>
            </div>
            <div className="flex justify-between font-extrabold text-[#111111] text-base pt-1">
              <span>Total</span>
              <span>{formatPrice(view.total)}</span>
            </div>
          </div>

          <div
            className={
              view.address
                ? 'mt-4 pt-4 border-t border-[#E2E0DC] grid grid-cols-2 gap-3 text-xs text-[#444444]'
                : 'mt-4 pt-4 border-t border-[#E2E0DC] grid grid-cols-1 gap-3 text-xs text-[#444444]'
            }
          >
            {view.address && (
              <div>
                <p className="font-bold text-[#111111] mb-0.5">Delivery To</p>
                <p>{view.address}</p>
                <p>{view.city}, {view.province}</p>
              </div>
            )}
            <div>
              <p className="font-bold text-[#111111] mb-0.5">Payment</p>
              <p>{PAYMENT_LABELS[view.paymentMethod] ?? view.paymentMethod}</p>
              {view.notes && (
                <>
                  <p className="font-bold text-[#111111] mt-2 mb-0.5">Notes</p>
                  <p className="italic">{view.notes}</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Final Sale Reminder */}
      <div className="bg-[#F5E6E6] rounded-[14px] p-4 border border-[#E2C2C2] mb-8 text-xs text-[#8B2020] leading-relaxed">
        <strong>Reminder: All sales are final.</strong> No returns or exchanges. If you have a query about your order, message us on WhatsApp before dispatch.
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-2 bg-[#111111] text-white font-bold text-sm py-4 rounded-full hover:bg-black transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
        >
          <MessageCircle className="w-4 h-4" />
          Confirm on WhatsApp
        </a>
        <Link
          href="/shop"
          className="flex-1 inline-flex items-center justify-center gap-2 bg-white text-[#111111] border border-[#E2E0DC] hover:border-[#111111] font-semibold text-sm py-4 rounded-full transition-colors"
        >
          <ShoppingBag className="w-4 h-4" />
          Continue Shopping
        </Link>
      </div>

      {/* Order number repeat for easy copy */}
      <p className="text-center text-xs text-[#9A9A9A] mt-6">
        Keep this order number:{' '}
        <span className="font-mono font-bold text-[#111111]">{orderNumber}</span>
      </p>

    </div>
  );
}
