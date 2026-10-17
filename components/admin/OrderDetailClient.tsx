'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { STATUS_CONFIG, paymentLabel } from '@/lib/orderLabels';
import { AdminNavHeader } from '@/components/admin/AdminNavHeader';
import { AdminToast, ConfirmDialog, type AdminToastState } from '@/components/admin/AdminFeedback';
import {
  ArrowLeft,
  Phone,
  MessageCircle,
  Copy,
  Check,
  CheckCircle2,
  RefreshCw,
  FileText,
  CreditCard,
  User,
  MapPin,
  Package,
  Truck,
} from 'lucide-react';

interface OrderItemSnapshot {
  id: string;
  product_id?: string | null;
  product_slug: string;
  name: string;
  brand: string;
  category: string;
  size?: string | null;
  condition?: string | null;
  unit_price_pkr: number;
  quantity: number;
  image_path?: string | null;
}

interface OrderEvent {
  id: string;
  from_status?: string | null;
  to_status: string;
  note?: string | null;
  created_at: string;
}

interface OrderDetail {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  address_line: string;
  city: string;
  province: string;
  notes?: string | null;
  payment_method: string;
  payment_status: 'unpaid' | 'paid' | 'refunded';
  status: 'new' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  subtotal_pkr: number;
  delivery_fee_pkr: number;
  total_pkr: number;
  created_at: string;
  delivered_at?: string | null;
  courier?: string | null;
  tracking_number?: string | null;
  items?: OrderItemSnapshot[];
  events?: OrderEvent[];
}

// Fulfillment pipeline (audit F-78): the server state machine is forward-only,
// so the UI shows exactly one primary next step plus sub-actions.
const ORDER_STAGES = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const FULFILMENT_STEPS = [
  { key: 'confirmed', label: 'Confirmed', stage: 1 },
  { key: 'shipped', label: 'Shipped', stage: 2 },
  { key: 'delivered', label: 'Delivered', stage: 3 },
];
const NEXT_ACTION: Partial<
  Record<OrderDetail['status'], { status: 'confirmed' | 'shipped' | 'delivered'; label: string }>
> = {
  new: { status: 'confirmed', label: 'Confirm Order' },
  confirmed: { status: 'shipped', label: 'Mark Shipped' },
  shipped: { status: 'delivered', label: 'Mark Delivered' },
};

// Status badge styling and payment labels now live in lib/orderLabels.ts
// (audit F-60).

export default function OrderDetailClient({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [copiedAddress, setCopiedAddress] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [toast, setToast] = useState<AdminToastState | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [courier, setCourier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [savingDispatch, setSavingDispatch] = useState(false);

  // Initial `loading` state covers the first fetch; retry callers set the
  // spinner themselves so the effect body performs no synchronous setState
  // (react-hooks/set-state-in-effect).
  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/orders/${orderNumber}`);
      if (res.status === 401 || res.status === 403) {
        router.replace('/admin/login');
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to fetch order details');
      } else {
        setError(null);
        setOrder(data.order);
        setCourier(data.order.courier ?? '');
        setTrackingNumber(data.order.tracking_number ?? '');
      }
    } catch {
      setError('Network error loading order.');
    } finally {
      setLoading(false);
    }
  }, [orderNumber, router]);

  useEffect(() => {
    // Initial fetch on mount: state updates land after the network await; the
    // lint rule's interprocedural heuristic treats the call as synchronous.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOrder();
  }, [fetchOrder]);

  // Copy full address for courier form
  const handleCopyAddress = () => {
    if (!order) return;
    const fullAddress = `${order.address_line}, ${order.city}, ${order.province}\nRecipient: ${order.customer_name} (${order.customer_phone})`;
    navigator.clipboard.writeText(fullAddress);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  // WhatsApp wa.me deep link with order number pre-filled
  const getWhatsAppUrl = () => {
    if (!order) return '#';
    let cleanPhone = order.customer_phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '92' + cleanPhone.slice(1);
    } else if (!cleanPhone.startsWith('92')) {
      cleanPhone = '92' + cleanPhone;
    }
    const text = encodeURIComponent(
      `Assalam o Alaikum ${order.customer_name}! This is Thriv (@thriv.pk) regarding your order ${order.order_number}.`
    );
    return `https://wa.me/${cleanPhone}?text=${text}`;
  };

  // Status mutation
  const handleStatusChange = async (newStatus: string) => {
    if (!order) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.order_number}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        setToast({ kind: 'error', message: data.error || 'Failed to update status' });
      } else {
        await fetchOrder();
        setToast({ kind: 'success', message: 'Order status updated' });
      }
    } catch {
      setToast({ kind: 'error', message: 'Network error updating status' });
    } finally {
      setUpdatingStatus(false);
      setDeliverOpen(false);
      setCancelOpen(false);
    }
  };

  // Payment status toggle
  const handlePaymentStatusToggle = async () => {
    if (!order) return;
    const nextPaymentStatus = order.payment_status === 'paid' ? 'unpaid' : 'paid';
    setUpdatingPayment(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.order_number}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status: nextPaymentStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        setToast({ kind: 'error', message: data.error || 'Failed to update payment status' });
      } else {
        setOrder((prev) => (prev ? { ...prev, payment_status: nextPaymentStatus } : null));
        setToast({
          kind: 'success',
          message: `Payment marked ${nextPaymentStatus}`,
        });
      }
    } catch {
      setToast({ kind: 'error', message: 'Network error updating payment status' });
    } finally {
      setUpdatingPayment(false);
    }
  };

  // Dispatch details save (audit F-79)
  const handleSaveDispatch = async () => {
    if (!order) return;
    setSavingDispatch(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.order_number}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courier: courier.trim(),
          tracking_number: trackingNumber.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ kind: 'error', message: data.error || 'Failed to save dispatch details' });
      } else {
        await fetchOrder();
        setToast({ kind: 'success', message: 'Dispatch details saved' });
      }
    } catch {
      setToast({ kind: 'error', message: 'Network error saving dispatch details' });
    } finally {
      setSavingDispatch(false);
    }
  };

  if (loading) {
    return (
      <div data-admin className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-6 h-6 text-neutral-400 animate-spin mx-auto mb-2" />
          <p className="text-xs text-neutral-400">Loading order {orderNumber}...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div data-admin className="min-h-screen bg-black text-white p-4 sm:p-6">
        <div className="max-w-xl mx-auto space-y-4">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" /> Back to orders
          </Link>
          <div className="p-4 bg-rose-950/40 border border-rose-800/40 rounded-[14px] text-rose-300 text-xs">
            {error || 'Order not found'}
          </div>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.new;
  const stageIndex = ORDER_STAGES.indexOf(order.status);
  const nextAction = NEXT_ACTION[order.status];
  const isBankOrWallet = ['bank-transfer', 'bank_transfer', 'easypaisa', 'jazzcash'].includes(
    order.payment_method
  );

  return (
    <div data-admin className="min-h-screen bg-black text-white pb-16">
      {/* Shared admin nav — tabs, refresh, sign out (audit F-38) */}
      <AdminNavHeader
        onRefresh={() => {
          setLoading(true);
          fetchOrder();
        }}
        loading={loading}
      />

      {/* Main Container — Mobile-First (375px) */}
      <main className="max-w-xl mx-auto px-4 py-4 sm:px-6 space-y-4">
        {/* Order Title & Status */}
        <div className="bg-admin-bg border border-admin-raised rounded-[16px] p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] text-neutral-400 uppercase tracking-wider font-mono">
                Order Number
              </p>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white font-mono mt-0.5">
                {order.order_number}
              </h1>
            </div>
            <div className="flex flex-col items-end gap-1.5 pt-0.5">
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
              >
                {statusCfg.label}
              </span>
              <span className="text-[11px] text-neutral-400">
                {new Date(order.created_at).toLocaleString('en-GB', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </div>
          </div>
        </div>

        {/* ── Customer Block ── */}
        <div className="bg-admin-bg border border-admin-raised rounded-[16px] p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2 text-neutral-400 border-b border-admin-raised pb-2.5">
            <User className="w-4 h-4 text-neutral-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Customer Information
            </h2>
          </div>

          <div>
            <p className="text-base font-bold text-white">{order.customer_name}</p>
            <p className="text-xs text-neutral-400 mt-0.5">{order.customer_email}</p>
          </div>

          {/* Phone Actions: Tap-to-Call & WhatsApp Deep Link */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <a
              href={`tel:${order.customer_phone}`}
              className="flex items-center justify-center gap-2 bg-admin-field hover:bg-admin-raised active:bg-admin-line-strong min-h-11 text-neutral-200 text-xs font-semibold py-2.5 px-3 rounded-[10px] border border-admin-line-strong transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-neutral-400" />
              <span>Call ({order.customer_phone})</span>
            </a>

            <a
              href={getWhatsAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-emerald-950/40 hover:bg-emerald-900/50 active:bg-emerald-900/60 min-h-11 text-emerald-400 text-xs font-semibold py-2.5 px-3 rounded-[10px] border border-emerald-800/40 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>
          </div>

          {/* Delivery Address & Copy-to-Clipboard */}
          <div className="pt-2 border-t border-admin-raised">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5 text-xs">
                <div className="flex items-center gap-1.5 text-neutral-400 mb-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="font-semibold text-neutral-300">Delivery Address</span>
                </div>
                <p className="text-neutral-200 font-medium leading-relaxed">{order.address_line}</p>
                <p className="text-neutral-400">
                  {order.city}, {order.province}
                </p>
              </div>

              <button
                onClick={handleCopyAddress}
                className="flex items-center gap-1 text-[11px] font-semibold text-neutral-300 hover:text-white bg-admin-field hover:bg-admin-raised border border-admin-line-strong px-3 py-2 min-h-9 rounded-[8px] transition-colors shrink-0 cursor-pointer"
              >
                {copiedAddress ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-neutral-400" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Order Instructions (Notes) ── */}
        <div className="bg-admin-bg border border-admin-raised rounded-[16px] p-4 sm:p-5 space-y-2">
          <div className="flex items-center gap-2 text-neutral-400">
            <FileText className="w-4 h-4 text-neutral-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Order Instructions
            </h2>
          </div>

          {order.notes && order.notes.trim() ? (
            <div className="p-3 bg-admin-field border border-admin-line rounded-[10px] text-xs text-neutral-200 leading-relaxed">
              {order.notes}
            </div>
          ) : (
            <p className="text-xs text-neutral-400 italic">No instructions</p>
          )}
        </div>

        {/* ── Items List (Snapshot Only) ── */}
        <div className="bg-admin-bg border border-admin-raised rounded-[16px] p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2 text-neutral-400 border-b border-admin-raised pb-2.5">
            <Package className="w-4 h-4 text-neutral-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Order Items ({order.items?.length || 0})
            </h2>
          </div>

          <div className="divide-y divide-admin-raised">
            {(order.items || []).map((item) => (
              <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                {/* Thumbnail */}
                <div className="w-12 h-14 bg-admin-field rounded-[8px] overflow-hidden shrink-0 border border-admin-line-strong relative flex items-center justify-center">
                  {item.image_path ? (
                    <Image
                      src={item.image_path}
                      alt={item.name}
                      fill
                      className="object-cover"
                      sizes="48px"
                      unoptimized
                    />
                  ) : (
                    <Package className="w-5 h-5 text-neutral-600" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{item.name}</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    {item.brand} · {item.size ? `Size ${item.size}` : 'One Size'}
                    {item.condition ? ` · ${item.condition}` : ''}
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Rs {item.unit_price_pkr.toLocaleString()} × {item.quantity}
                  </p>
                </div>

                {/* Line Total */}
                <span className="text-xs font-bold text-white font-mono shrink-0">
                  Rs {(item.unit_price_pkr * item.quantity).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {/* Totals Breakdown */}
          <div className="pt-3 border-t border-admin-raised space-y-1.5 text-xs text-neutral-400">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="text-neutral-200">Rs {order.subtotal_pkr.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Delivery (Nationwide)</span>
              <span className="text-neutral-200">Rs {order.delivery_fee_pkr.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm font-extrabold text-white pt-2 border-t border-admin-raised">
              <span>Total</span>
              <span>Rs {order.total_pkr.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* ── Payment Block ── */}
        <div className="bg-admin-bg border border-admin-raised rounded-[16px] p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2 text-neutral-400 border-b border-admin-raised pb-2.5">
            <CreditCard className="w-4 h-4 text-neutral-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Payment Details
            </h2>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-neutral-400">Payment Method</p>
              <p className="text-sm font-bold text-white mt-0.5">
                {paymentLabel(order.payment_method, 'detail') || order.payment_method}
              </p>
            </div>

            {/* Payment Status Toggle */}
            <button
              onClick={handlePaymentStatusToggle}
              disabled={updatingPayment}
              className={`text-xs font-bold px-3 py-1.5 rounded-[10px] border transition-colors cursor-pointer disabled:opacity-50 ${
                order.payment_status === 'paid'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
              }`}
            >
              {updatingPayment
                ? 'Updating...'
                : order.payment_status === 'paid'
                ? 'Paid (Click to set Unpaid)'
                : 'Unpaid (Click to set Paid)'}
            </button>
          </div>

          {/* Payment screenshot reminder */}
          {isBankOrWallet && (
            <div className="p-3 bg-admin-field border border-admin-line rounded-[10px] text-xs text-neutral-300 leading-relaxed">
              Confirm payment screenshot on WhatsApp before dispatching this parcel.
            </div>
          )}
        </div>

        {/* ── Dispatch Details (audit F-79) ── */}
        {order.status !== 'new' && order.status !== 'cancelled' && (
          <div className="bg-admin-bg border border-admin-raised rounded-[16px] p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2 text-neutral-400 border-b border-admin-raised pb-2.5">
              <Truck className="w-4 h-4 text-neutral-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Dispatch Details
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="dispatch-courier" className="block text-[11px] font-semibold text-neutral-400 mb-1">
                  Courier
                </label>
                <input
                  id="dispatch-courier"
                  type="text"
                  value={courier}
                  onChange={(e) => setCourier(e.target.value)}
                  placeholder="e.g. TCS / Leopards"
                  className="w-full bg-admin-field border border-admin-line-strong rounded-[10px] px-3 py-2.5 text-xs text-white placeholder:text-neutral-400 outline-none focus:border-neutral-400"
                />
              </div>
              <div>
                <label htmlFor="dispatch-tracking" className="block text-[11px] font-semibold text-neutral-400 mb-1">
                  Tracking Number
                </label>
                <input
                  id="dispatch-tracking"
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="e.g. TCS-123456789"
                  className="w-full bg-admin-field border border-admin-line-strong rounded-[10px] px-3 py-2.5 text-xs text-white placeholder:text-neutral-400 outline-none focus:border-neutral-400 font-mono"
                />
              </div>
            </div>

            <button
              onClick={handleSaveDispatch}
              disabled={savingDispatch}
              className="w-full sm:w-auto min-h-11 px-5 bg-white text-black hover:bg-neutral-200 font-bold text-xs rounded-full transition-colors disabled:opacity-50 cursor-pointer"
            >
              {savingDispatch ? 'Saving…' : 'Save tracking'}
            </button>

            <p className="text-[11px] text-neutral-400">
              Customers see these details on their order confirmation page once shipped.
            </p>
          </div>
        )}

        {/* ── Fulfillment Actions — one clear next step (audit F-78) ── */}
        <div className="bg-admin-bg border border-admin-raised rounded-[16px] p-4 sm:p-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Fulfillment
          </h2>

          {/* Progress stepper */}
          {order.status === 'cancelled' ? (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-400 bg-rose-950/40 border border-rose-800/40 rounded-full px-3 py-2 text-center">
              Order cancelled — stock has been restored.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-semibold uppercase tracking-wider">
              {FULFILMENT_STEPS.map((step) => {
                const reached = stageIndex >= step.stage;
                const current = stageIndex === step.stage;
                return (
                  <div
                    key={step.key}
                    aria-current={current ? 'step' : undefined}
                    className={`py-2 rounded-full border ${
                      reached
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-admin-field border-admin-raised text-neutral-400'
                    }`}
                  >
                    {step.label}
                  </div>
                );
              })}
            </div>
          )}

          {/* PRIMARY ACTION: the single next step in the pipeline */}
          {nextAction && (
            <button
              onClick={() => {
                if (nextAction.status === 'delivered') {
                  setDeliverOpen(true);
                } else {
                  handleStatusChange(nextAction.status);
                }
              }}
              disabled={updatingStatus}
              className="w-full min-h-12 bg-white hover:bg-neutral-200 active:bg-neutral-300 text-black font-extrabold text-sm py-3.5 rounded-[14px] shadow-lg transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>{updatingStatus ? 'Updating…' : nextAction.label}</span>
            </button>
          )}

          {order.status === 'delivered' && (
            <p className="text-[11px] text-neutral-400">
              Order completed — the parcel has reached the customer.
            </p>
          )}

          {/* Secondary actions behind a disclosure (audit F-78) */}
          {nextAction && (
            <div>
              <button
                type="button"
                onClick={() => setMoreOpen((open) => !open)}
                aria-expanded={moreOpen}
                className="text-[11px] font-semibold text-neutral-400 hover:text-white underline underline-offset-2 cursor-pointer"
              >
                {moreOpen ? 'Hide extra actions' : 'More actions'}
              </button>

              {moreOpen && (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {order.status === 'new' && (
                    <button
                      onClick={() => handleStatusChange('shipped')}
                      disabled={updatingStatus}
                      className="min-h-11 bg-admin-field hover:bg-admin-raised text-sky-300 text-xs font-semibold rounded-[10px] border border-admin-line-strong transition-colors cursor-pointer"
                    >
                      Mark Shipped (skip)
                    </button>
                  )}
                  <button
                    onClick={() => setCancelOpen(true)}
                    disabled={updatingStatus}
                    className={`min-h-11 bg-admin-field hover:bg-admin-raised text-rose-400 text-xs font-semibold rounded-[10px] border border-admin-line-strong transition-colors cursor-pointer ${
                      order.status === 'new' ? '' : 'col-span-2'
                    }`}
                  >
                    Cancel Order
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Status History (from order_events) ── */}
        <div className="bg-admin-bg border border-admin-raised rounded-[16px] p-4 sm:p-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Status History
          </h2>

          {order.events && order.events.length > 0 ? (
            <div className="space-y-2.5">
              {order.events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start justify-between gap-3 text-xs border-l-2 border-neutral-700 pl-3 py-1"
                >
                  <div>
                    <p className="font-semibold text-neutral-200">
                      {event.from_status ? (
                        <>
                          <span className="capitalize">{event.from_status}</span> →{' '}
                          <span className="capitalize font-bold text-white">{event.to_status}</span>
                        </>
                      ) : (
                        <span className="capitalize font-bold text-white">{event.to_status}</span>
                      )}
                    </p>
                    {event.note && <p className="text-[11px] text-neutral-400 mt-0.5">{event.note}</p>}
                  </div>
                  <span className="text-[10px] text-neutral-400 shrink-0">
                    {new Date(event.created_at).toLocaleString('en-GB', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-neutral-400 italic">No events recorded</p>
          )}
        </div>
      </main>

      <ConfirmDialog
        open={deliverOpen}
        title="Mark as delivered?"
        message="Confirm the parcel has reached the customer. This completes the order and cannot be undone."
        confirmLabel="Yes, delivered"
        busy={updatingStatus}
        onConfirm={() => handleStatusChange('delivered')}
        onCancel={() => setDeliverOpen(false)}
      />

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel this order?"
        message="Reserved stock will be restored. The customer's order page will show the order as cancelled."
        confirmLabel="Cancel order"
        destructive
        busy={updatingStatus}
        onConfirm={() => handleStatusChange('cancelled')}
        onCancel={() => setCancelOpen(false)}
      />

      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
