'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AdminNavHeader } from '@/components/admin/AdminNavHeader';
import { STATUS_CONFIG, paymentLabel } from '@/lib/orderLabels';
import {
  Search,
  RefreshCw,
  ChevronRight,
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

// Status badge styling and payment labels now live in lib/orderLabels.ts
// (audit F-60 — they used to be duplicated across four files).

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
        // Mount-time external-store read (localStorage) — hydration-safe in an
        // effect; not a cascading-render pattern.
        // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Initial `loading` state covers the first fetch; refresh callers set the
  // spinner themselves so poll ticks stay silent and the mount effect body
  // performs no synchronous setState (react-hooks/set-state-in-effect).
  const fetchOrders = useCallback(async () => {
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
        setError(null);
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
  }, [router]);

  useEffect(() => {
    // Initial fetch on mount: state updates land after the network await; the
    // lint rule's interprocedural heuristic treats the call as synchronous.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOrders();
  }, [fetchOrders]);

  // New-order polling: refresh the list every 30s so fresh orders appear and
  // raise a toast without a manual refresh.
  //
  // Replaces the previous Supabase Realtime subscription, which required the
  // server to echo the raw session token to the browser (audit F-42 — the
  // token is now deliberately never exposed to JS; see /api/admin/auth/me).
  useEffect(() => {
    const POLL_MS = 30000;
    let isMounted = true;

    const poll = async () => {
      try {
        const res = await fetch('/api/admin/orders', { cache: 'no-store' });
        if (!isMounted) return;
        if (res.status === 401 || res.status === 403) {
          router.replace('/admin/login');
          return;
        }
        if (!res.ok) return;

        const data = await res.json();
        const fetched: OrderListItem[] = data.orders || [];

        let latestNew: OrderListItem | null = null;
        let added = 0;
        for (const o of fetched) {
          if (!seenOrderNumbersRef.current.has(o.order_number)) {
            seenOrderNumbersRef.current.add(o.order_number);
            added += 1;
            if (!latestNew) latestNew = o;
          }
        }

        setOrders(fetched);

        if (added > 0 && latestNew) {
          setNewOrdersCount((c) => c + added);
          setRealtimeToast({
            orderNumber: latestNew.order_number,
            customerName: latestNew.customer_name,
            totalPkr: latestNew.total_pkr,
          });
        }
      } catch {
        // Network hiccup — retry on the next tick.
      }
    };

    const id = setInterval(poll, POLL_MS);
    return () => {
      isMounted = false;
      clearInterval(id);
    };
  }, [router]);

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
    <div data-admin className="min-h-screen bg-black text-white">
      {/* Shared Admin Navigation Header with Orders & Inventory Tabs */}
      <AdminNavHeader
        onRefresh={() => {
          setNewOrdersCount(0);
          setLoading(true);
          fetchOrders();
        }}
        loading={loading}
      />

      {/* Subheader Title */}
      <div className="bg-admin-bg border-b border-admin-raised px-4 py-3 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
              Customer Orders
            </h1>
            <span className="text-xs bg-admin-raised text-neutral-400 font-mono px-2 py-0.5 rounded-full">
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
      </div>

      {/* Realtime Toast Notification */}
      {realtimeToast && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 max-w-sm w-[calc(100%-2rem)] bg-admin-field border border-amber-500/40 rounded-[14px] p-4 shadow-2xl flex items-start gap-3"
        >
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
                aria-label="Dismiss new order notification"
                className="text-neutral-400 hover:text-neutral-300 p-2 -mr-1.5 -mt-1 cursor-pointer"
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
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by order #, customer name, phone, or city..."
            className="w-full bg-admin-bg border border-admin-line rounded-[12px] pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder:text-neutral-400 outline-none focus:border-neutral-500 transition-colors"
          />
        </div>

        {/* Filter Chips (Horizontally scrollable on mobile) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {FILTER_CHIPS.map((chip) => {
            const isActive = activeFilter === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => setActiveFilter(chip.id)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap border transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-white text-black border-white'
                    : 'bg-admin-field text-neutral-400 border-admin-line hover:border-neutral-600 hover:text-neutral-200'
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
          <div className="text-center py-16 bg-admin-bg border border-admin-raised rounded-[16px] p-6">
            <Package className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-neutral-300">No orders found</p>
            <p className="text-xs text-neutral-400 mt-1">
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
                  className="block bg-admin-bg hover:bg-admin-field active:bg-admin-field border border-admin-raised hover:border-admin-line-strong rounded-[14px] p-4 transition-colors relative"
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

                    <span className="text-[11px] text-neutral-400 shrink-0">
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
                  <div className="mt-3 pt-3 border-t border-admin-raised flex items-center justify-between gap-2">
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
                        {paymentLabel(order.payment_method, 'list') || order.payment_method}
                      </span>
                    </div>

                    <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
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
