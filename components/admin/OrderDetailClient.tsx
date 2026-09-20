'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Phone,
  MessageCircle,
  Copy,
  Check,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  AlertCircle,
  RefreshCw,
  FileText,
  CreditCard,
  User,
  MapPin,
  Package,
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
  items?: OrderItemSnapshot[];
  events?: OrderEvent[];
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }
> = {
  new: {
    label: 'New',
    bg: 'bg-amber-500/10',
    text: 'text-amber-500',
    border: 'border-amber-500/30',
    icon: Clock,
  },
  confirmed: {
    label: 'Confirmed',
    bg: 'bg-neutral-800',
    text: 'text-neutral-200',
    border: 'border-neutral-700',
    icon: CheckCircle2,
  },
  shipped: {
    label: 'Shipped',
    bg: 'bg-sky-500/10',
    text: 'text-sky-400',
    border: 'border-sky-500/30',
    icon: Truck,
  },
  delivered: {
    label: 'Delivered',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    icon: CheckCircle2,
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'bg-neutral-900',
    text: 'text-neutral-500 line-through',
    border: 'border-neutral-800',
    icon: XCircle,
  },
};

const PAYMENT_LABELS: Record<string, string> = {
  'cash-on-delivery': 'Cash on Delivery (COD)',
  cod: 'Cash on Delivery (COD)',
  'bank-transfer': 'Faysal Bank Transfer',
  bank_transfer: 'Faysal Bank Transfer',
  easypaisa: 'EasyPaisa',
  jazzcash: 'JazzCash',
  card: 'Card',
};

export default function OrderDetailClient({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [copiedAddress, setCopiedAddress] = useState(false);
  const [confirmingDelivered, setConfirmingDelivered] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);

  const fetchOrder = async () => {
    setLoading(true);
    setError(null);
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
        setOrder(data.order);
      }
    } catch {
      setError('Network error loading order.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [orderNumber]);

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
        alert(data.error || 'Failed to update status');
      } else {
        await fetchOrder();
        setConfirmingDelivered(false);
      }
    } catch {
      alert('Network error updating status');
    } finally {
      setUpdatingStatus(false);
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
        alert(data.error || 'Failed to update payment status');
      } else {
        setOrder((prev) => (prev ? { ...prev, payment_status: nextPaymentStatus } : null));
      }
    } catch {
      alert('Network error updating payment status');
    } finally {
      setUpdatingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111111] text-white flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-6 h-6 text-neutral-500 animate-spin mx-auto mb-2" />
          <p className="text-xs text-neutral-400">Loading order {orderNumber}...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#111111] text-white p-4 sm:p-6">
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
  const isBankOrWallet = ['bank-transfer', 'bank_transfer', 'easypaisa', 'jazzcash'].includes(
    order.payment_method
  );

  return (
    <div className="min-h-screen bg-[#111111] text-white pb-16">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-[#161616] border-b border-[#242424] px-4 py-3 sm:px-6">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-white font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Orders</span>
          </Link>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
            >
              {statusCfg.label}
            </span>
          </div>
        </div>
      </header>

      {/* Main Container — Mobile-First (375px) */}
      <main className="max-w-xl mx-auto px-4 py-4 sm:px-6 space-y-4">
        {/* Order Title & Time */}
        <div className="bg-[#161616] border border-[#242424] rounded-[16px] p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] text-neutral-500 uppercase tracking-wider font-mono">
                Order Number
              </p>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white font-mono mt-0.5">
                {order.order_number}
              </h1>
            </div>
            <span className="text-xs text-neutral-500 pt-1">
              {new Date(order.created_at).toLocaleString('en-GB', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
          </div>
        </div>

        {/* ── Customer Block ── */}
        <div className="bg-[#161616] border border-[#242424] rounded-[16px] p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2 text-neutral-400 border-b border-[#222222] pb-2.5">
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
              className="flex items-center justify-center gap-2 bg-[#222222] hover:bg-[#282828] active:bg-[#303030] text-neutral-200 text-xs font-semibold py-2.5 px-3 rounded-[10px] border border-[#2e2e2e] transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-neutral-400" />
              <span>Call ({order.customer_phone})</span>
            </a>

            <a
              href={getWhatsAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-emerald-950/40 hover:bg-emerald-900/50 active:bg-emerald-900/60 text-emerald-400 text-xs font-semibold py-2.5 px-3 rounded-[10px] border border-emerald-800/40 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>
          </div>

          {/* Delivery Address & Copy-to-Clipboard */}
          <div className="pt-2 border-t border-[#222222]">
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
                className="flex items-center gap-1 text-[11px] font-semibold text-neutral-300 hover:text-white bg-[#222222] hover:bg-[#282828] border border-[#2e2e2e] px-2.5 py-1.5 rounded-[8px] transition-colors shrink-0 cursor-pointer"
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
        <div className="bg-[#161616] border border-[#242424] rounded-[16px] p-4 sm:p-5 space-y-2">
          <div className="flex items-center gap-2 text-neutral-400">
            <FileText className="w-4 h-4 text-neutral-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Order Instructions
            </h2>
          </div>

          {order.notes && order.notes.trim() ? (
            <div className="p-3 bg-[#1d1d1d] border border-[#2a2a2a] rounded-[10px] text-xs text-neutral-200 leading-relaxed">
              {order.notes}
            </div>
          ) : (
            <p className="text-xs text-neutral-500 italic">No instructions</p>
          )}
        </div>

        {/* ── Items List (Snapshot Only) ── */}
        <div className="bg-[#161616] border border-[#242424] rounded-[16px] p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2 text-neutral-400 border-b border-[#222222] pb-2.5">
            <Package className="w-4 h-4 text-neutral-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Order Items ({order.items?.length || 0})
            </h2>
          </div>

          <div className="divide-y divide-[#222222]">
            {(order.items || []).map((item) => (
              <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                {/* Thumbnail */}
                <div className="w-12 h-14 bg-[#202020] rounded-[8px] overflow-hidden shrink-0 border border-[#2e2e2e] relative flex items-center justify-center">
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
                  <p className="text-[11px] text-neutral-500 mt-1">
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
          <div className="pt-3 border-t border-[#222222] space-y-1.5 text-xs text-neutral-400">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="text-neutral-200">Rs {order.subtotal_pkr.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Delivery (Nationwide)</span>
              <span className="text-neutral-200">Rs {order.delivery_fee_pkr.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm font-extrabold text-white pt-2 border-t border-[#222222]">
              <span>Total</span>
              <span>Rs {order.total_pkr.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* ── Payment Block ── */}
        <div className="bg-[#161616] border border-[#242424] rounded-[16px] p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2 text-neutral-400 border-b border-[#222222] pb-2.5">
            <CreditCard className="w-4 h-4 text-neutral-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Payment Details
            </h2>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-neutral-400">Payment Method</p>
              <p className="text-sm font-bold text-white mt-0.5">
                {PAYMENT_LABELS[order.payment_method] || order.payment_method}
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
            <div className="p-3 bg-[#1d1d1d] border border-[#2a2a2a] rounded-[10px] text-xs text-neutral-300 leading-relaxed">
              Confirm payment screenshot on WhatsApp before dispatching this parcel.
            </div>
          )}
        </div>

        {/* ── Primary & Secondary Status Actions (Thumb-Reachable) ── */}
        <div className="bg-[#161616] border border-[#242424] rounded-[16px] p-4 sm:p-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Fulfillment Actions
          </h2>

          {/* PRIMARY ACTION: Large Full-Width "Mark Delivered" Button */}
          {order.status !== 'delivered' && order.status !== 'cancelled' && (
            <div>
              {!confirmingDelivered ? (
                <button
                  onClick={() => setConfirmingDelivered(true)}
                  disabled={updatingStatus}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-extrabold text-sm py-4 rounded-[14px] shadow-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Mark Delivered</span>
                </button>
              ) : (
                <div className="p-3.5 bg-emerald-950/60 border border-emerald-700/60 rounded-[14px] space-y-2.5">
                  <p className="text-xs font-bold text-emerald-300 text-center">
                    Confirm parcel delivered to customer?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleStatusChange('delivered')}
                      disabled={updatingStatus}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 rounded-[10px] cursor-pointer"
                    >
                      {updatingStatus ? 'Updating...' : 'Yes, Confirm'}
                    </button>
                    <button
                      onClick={() => setConfirmingDelivered(false)}
                      disabled={updatingStatus}
                      className="bg-[#242424] hover:bg-[#2e2e2e] text-neutral-300 text-xs font-bold py-2.5 rounded-[10px] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Secondary Actions (Smaller, Visually Subordinate) */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {order.status !== 'confirmed' && order.status !== 'delivered' && (
              <button
                onClick={() => handleStatusChange('confirmed')}
                disabled={updatingStatus}
                className="bg-[#222222] hover:bg-[#282828] text-neutral-200 text-xs font-semibold py-2 px-2 rounded-[10px] border border-[#2e2e2e] transition-colors cursor-pointer"
              >
                Confirm
              </button>
            )}

            {order.status !== 'shipped' && order.status !== 'delivered' && (
              <button
                onClick={() => handleStatusChange('shipped')}
                disabled={updatingStatus}
                className="bg-[#222222] hover:bg-[#282828] text-sky-300 text-xs font-semibold py-2 px-2 rounded-[10px] border border-[#2e2e2e] transition-colors cursor-pointer"
              >
                Mark Shipped
              </button>
            )}

            {order.status !== 'cancelled' && (
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to cancel this order?')) {
                    handleStatusChange('cancelled');
                  }
                }}
                disabled={updatingStatus}
                className="bg-[#222222] hover:bg-[#282828] text-rose-400 text-xs font-semibold py-2 px-2 rounded-[10px] border border-[#2e2e2e] transition-colors cursor-pointer"
              >
                Cancel Order
              </button>
            )}
          </div>
        </div>

        {/* ── Status History (from order_events) ── */}
        <div className="bg-[#161616] border border-[#242424] rounded-[16px] p-4 sm:p-5 space-y-3">
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
                  <span className="text-[10px] text-neutral-500 shrink-0">
                    {new Date(event.created_at).toLocaleString('en-GB', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-neutral-500 italic">No events recorded</p>
          )}
        </div>
      </main>
    </div>
  );
}
