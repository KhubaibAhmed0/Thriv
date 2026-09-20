'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  Search,
  RefreshCw,
  LogOut,
  ChevronRight,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  AlertCircle,
  Package,
  Bell,
  X,
} from 'lucide-react';

export type OrderListItem = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  city: string;
  province: string;
  total_pkr: number;
  payment_method: string;
  payment_status: 'unpaid' | 'paid' | 'refunded';
  status: 'new' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  created_at: string;
  delivered_at?: string | null;
  item_count: number;
};

// Filter options per section 5
const FILTER_CHIPS = [
  { id: 'active', label: 'Active (New & Confirmed)' },
  { id: 'new', label: 'New' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'all', label: 'All' },
] as const;

type FilterType = (typeof FILTER_CHIPS)[number]['id'];

// Status badge styling per section 6
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
  'cash-on-delivery': 'COD',
  cod: 'COD',
  'bank-transfer': 'Bank Transfer',
  bank_transfer: 'Bank Transfer',
  easypaisa: 'EasyPaisa',
  jazzcash: 'JazzCash',
  card: 'Card',
};

function formatRelativeTime(dateString: string): string {
  const diffSec = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function AdminOrdersListClient() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('active');
  const [openedOrders, setOpenedOrders] = useState<Set<string>>(new Set());

  // Realtime state
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [realtimeToast, setRealtimeToast] = useState<{
    orderNumber: string;
    customerName: string;
    totalPkr: number;
  } | null>(null);
  const seenOrderNumbersRef = useRef<Set<string>>(new Set());

  // Auto-dismiss realtime toast after 6 seconds
  useEffect(() => {
    if (!realtimeToast) return;
    const timer = setTimeout(() => setRealtimeToast(null), 6000);
    return () => clearTimeout(timer);
  }, [realtimeToast]);

  // Load opened orders from localStorage for unread indicator
  useEffect(() => {
    try {
      const stored = localStorage.getItem('thriv_opened_orders');
      if (stored) {
        setOpenedOrders(new Set(JSON.parse(stored)));
      }
    } catch {
      // Non-fatal
    }
  }, []);

  const markOrderOpened = (orderNumber: string) => {
    setOpenedOrders((prev) => {
      const updated = new Set(prev).add(orderNumber);
      try {
        localStorage.setItem('thriv_opened_orders', JSON.stringify(Array.from(updated)));
      } catch {
        // Non-fatal
      }
      return updated;
    });
  };

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/orders');
      if (res.status === 401 || res.status === 403) {
        router.replace('/admin/login');
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to fetch orders');
        setOrders([]);
      } else {
        const fetched = data.orders || [];
        setOrders(fetched);
        // Seed seen orders ref to prevent re-toast on existing orders
        fetched.forEach((o: OrderListItem) => seenOrderNumbersRef.current.add(o.order_number));
      }
    } catch {
      setError('Network error fetching orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Supabase Realtime subscription
  useEffect(() => {
    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const supabaseUrl = rawUrl?.trim().replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '');
    const anonKey = rawKey?.trim();

    if (!supabaseUrl || !anonKey || !supabaseUrl.startsWith('https://')) {
      return;
    }

    let isMounted = true;
    let channel: any = null;
    let supabase: any = null;

    const setupRealtime = async () => {
      try {
        // Retrieve session token to authenticate Realtime connection under RLS
        const authRes = await fetch('/api/admin/auth/me');
        if (!authRes.ok) return;
        const authData = await authRes.json();
        if (!authData.token || !isMounted) return;

        supabase = createClient(supabaseUrl, anonKey, {
          auth: { persistSession: false },
        });

        // Set token for RLS
        supabase.realtime.setAuth(authData.token);

        channel = supabase
          .channel('thriv-orders-realtime')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'orders',
            },
            (payload: any) => {
              if (!isMounted) return;
              const newRow = payload.new;
              if (!newRow || !newRow.order_number) return;

              // Prevent duplicate toasts for the same order
              if (seenOrderNumbersRef.current.has(newRow.order_number)) {
                return;
              }
              seenOrderNumbersRef.current.add(newRow.order_number);

              const formattedOrder: OrderListItem = {
                id: newRow.id,
                order_number: newRow.order_number,
                customer_name: newRow.customer_name,
                customer_phone: newRow.customer_phone,
                city: newRow.city,
                province: newRow.province,
                total_pkr: newRow.total_pkr,
                payment_method: newRow.payment_method,
                payment_status: newRow.payment_status,
                status: newRow.status,
                created_at: newRow.created_at,
                delivered_at: newRow.delivered_at,
                item_count: 1,
              };

              // Prepend new order to list
              setOrders((prev) => [formattedOrder, ...prev]);

              // Trigger toast and increment new orders badge
              setRealtimeToast({
                orderNumber: newRow.order_number,
                customerName: newRow.customer_name,
                totalPkr: newRow.total_pkr,
              });
              setNewOrdersCount((c) => c + 1);
            }
          )
          .subscribe();
      } catch (err) {
        console.error('[Realtime] Subscription error:', err);
      }
    };

    setupRealtime();

    return () => {
      isMounted = false;
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/admin/login');
    }
  };

  // Filter & Search logic
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Status filter
      let matchesFilter = true;
      if (activeFilter === 'active') {
        matchesFilter = o.status === 'new' || o.status === 'confirmed';
      } else if (activeFilter !== 'all') {
        matchesFilter = o.status === activeFilter;
      }

      // Search query
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        o.order_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_phone.toLowerCase().includes(q) ||
        o.city.toLowerCase().includes(q);

      return matchesFilter && matchesSearch;
    });
  }, [orders, activeFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[#161616] border-b border-[#242424] px-4 py-3 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
                Orders
              </h1>
              <span className="text-xs bg-[#242424] text-neutral-400 font-mono px-2 py-0.5 rounded-full">
                {filteredOrders.length}
              </span>
              {newOrdersCount > 0 && (
                <span className="text-[11px] bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold px-2 py-0.5 rounded-full animate-pulse">
                  +{newOrdersCount} new
                </span>
              )}
            </div>
            <p className="text-[11px] text-neutral-400">Thriv Karachi Dispatch</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setNewOrdersCount(0);
                fetchOrders();
              }}
              disabled={loading}
              title="Refresh orders"
              aria-label="Refresh orders"
              className="p-2 text-neutral-400 hover:text-white bg-[#202020] hover:bg-[#282828] border border-[#2e2e2e] rounded-[10px] transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleSignOut}
              title="Sign out"
              aria-label="Sign out"
              className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white bg-[#202020] hover:bg-[#282828] border border-[#2e2e2e] px-3 py-2 rounded-[10px] transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Realtime Toast Notification */}
      {realtimeToast && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm w-[calc(100%-2rem)] bg-[#1e1e1e] border border-amber-500/40 rounded-[14px] p-4 shadow-2xl flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
            <Bell className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <p className="text-xs font-bold text-white font-mono">
                New Order {realtimeToast.orderNumber}
              </p>
              <button
                onClick={() => setRealtimeToast(null)}
                className="text-neutral-500 hover:text-neutral-300 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-neutral-300 mt-0.5 truncate">
              {realtimeToast.customerName} · Rs {realtimeToast.totalPkr.toLocaleString()}
            </p>
            <Link
              href={`/admin/orders/${realtimeToast.orderNumber}`}
              onClick={() => {
                markOrderOpened(realtimeToast.orderNumber);
                setRealtimeToast(null);
              }}
              className="inline-block text-[11px] font-bold text-amber-400 hover:underline mt-1.5"
            >
              Open Order →
            </Link>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-4 sm:px-6 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by order #, customer name, phone, or city..."
            className="w-full bg-[#181818] border border-[#282828] rounded-[12px] pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder:text-neutral-500 outline-none focus:border-neutral-500 transition-colors"
          />
        </div>

        {/* Filter Chips (Horizontally scrollable on mobile) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {FILTER_CHIPS.map((chip) => {
            const isActive = activeFilter === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => setActiveFilter(chip.id)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap border transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-white text-[#111111] border-white'
                    : 'bg-[#1a1a1a] text-neutral-400 border-[#2a2a2a] hover:border-neutral-600 hover:text-neutral-200'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/40 rounded-[12px] flex items-center gap-2 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Orders Stacked Card List (Mobile-First) */}
        {loading && orders.length === 0 ? (
          <div className="text-center py-16">
            <RefreshCw className="w-6 h-6 text-neutral-600 animate-spin mx-auto mb-3" />
            <p className="text-xs text-neutral-400">Loading orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-16 bg-[#161616] border border-[#242424] rounded-[16px] p-6">
            <Package className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-neutral-300">No orders found</p>
            <p className="text-xs text-neutral-500 mt-1">
              {searchQuery ? 'Try clearing your search query' : 'No orders matching current filter'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.new;
              const StatusIcon = statusCfg.icon;
              const isUnread = order.status === 'new' && !openedOrders.has(order.order_number);

              return (
                <Link
                  key={order.id}
                  href={`/admin/orders/${order.order_number}`}
                  onClick={() => markOrderOpened(order.order_number)}
                  className="block bg-[#161616] hover:bg-[#1c1c1c] active:bg-[#202020] border border-[#242424] hover:border-[#333333] rounded-[14px] p-4 transition-colors relative"
                >
                  {/* Unread indicator */}
                  {isUnread && (
                    <span
                      className="absolute top-4 right-4 w-2 h-2 rounded-full bg-amber-400 ring-4 ring-amber-400/20"
                      title="Unopened new order"
                    />
                  )}

                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-3 pr-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs sm:text-sm font-bold text-white tracking-wide">
                          {order.order_number}
                        </span>
                        {isUnread && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                            Unread
                          </span>
                        )}
                      </div>
                      <h2 className="text-sm font-semibold text-neutral-200 mt-1">
                        {order.customer_name}
                      </h2>
                    </div>

                    <span className="text-[11px] text-neutral-500 shrink-0">
                      {formatRelativeTime(order.created_at)}
                    </span>
                  </div>

                  {/* Metadata Row */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400">
                    <span>{order.city}</span>
                    <span>·</span>
                    <span>
                      {order.item_count} {order.item_count === 1 ? 'item' : 'items'}
                    </span>
                    <span>·</span>
                    <span className="font-semibold text-white">
                      Rs {order.total_pkr.toLocaleString()}
                    </span>
                  </div>

                  {/* Badges Row */}
                  <div className="mt-3 pt-3 border-t border-[#222222] flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Order Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {statusCfg.label}
                      </span>

                      {/* Payment Status Badge */}
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                          order.payment_status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                        }`}
                      >
                        {order.payment_status}
                      </span>

                      {/* Payment Method */}
                      <span className="text-[10px] text-neutral-400">
                        {PAYMENT_LABELS[order.payment_method] || order.payment_method}
                      </span>
                    </div>

                    <ChevronRight className="w-4 h-4 text-neutral-500 shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
