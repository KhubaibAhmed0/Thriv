'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Package,
  Search,
  RefreshCw,
  Phone,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Lock,
  DollarSign,
  TrendingUp,
  Boxes,
  Copy,
  Check,
} from 'lucide-react';
import type { DbOrder } from '@/lib/supabase';

// Sample mock orders for immediate testing if Supabase is not yet populated
const MOCK_ORDERS: DbOrder[] = [
  {
    id: 'mock-1',
    order_number: 'THR-20260919-847291',
    customer_name: 'Zeeshan Tariq',
    whatsapp: '03001234567',
    email: 'zeeshan.tariq@gmail.com',
    address: 'House 42, Street 7, Phase 5, DHA',
    city: 'Karachi',
    province: 'Sindh',
    notes: 'Please call before arriving.',
    payment_method: 'bank-transfer',
    subtotal: 3998,
    delivery_fee: 200,
    total: 4198,
    status: 'pending',
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    items: [
      {
        product_id: 'zara-vintage-denim-01',
        product_name: 'Zara Vintage Baggy Denim',
        brand: 'Zara',
        price: 2499,
        quantity: 1,
        selected_size: '32x30',
        is_merch: false,
        image_url: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&auto=format&fit=crop&q=80',
      },
      {
        product_id: 'tee-berserk',
        product_name: 'Berserk "Brand of Sacrifice" Heavyweight Tee',
        brand: 'Thriv Merch',
        price: 1499,
        quantity: 1,
        selected_size: 'L',
        is_merch: true,
        image_url: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 'mock-2',
    order_number: 'THR-20260919-629104',
    customer_name: 'Hamza Khan',
    whatsapp: '03219876543',
    email: 'hamza.k@yahoo.com',
    address: 'Flat 3B, Silver Sands Apartments, Clifton Block 2',
    city: 'Karachi',
    province: 'Sindh',
    notes: '',
    payment_method: 'cash-on-delivery',
    subtotal: 1499,
    delivery_fee: 200,
    total: 1699,
    status: 'confirmed',
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    items: [
      {
        product_id: 'tee-evangelion',
        product_name: 'Neon Genesis Evangelion Unit-01 Tee',
        brand: 'Thriv Merch',
        price: 1499,
        quantity: 1,
        selected_size: 'XL',
        is_merch: true,
        image_url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80',
      },
    ],
  },
];

const STATUS_BADGES: Record<
  string,
  { label: string; bg: string; text: string; border: string; icon: any }
> = {
  pending: {
    label: 'Pending',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    icon: Clock,
  },
  confirmed: {
    label: 'Confirmed',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
    icon: CheckCircle2,
  },
  dispatched: {
    label: 'Dispatched',
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/20',
    icon: Truck,
  },
  delivered: {
    label: 'Delivered',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    icon: CheckCircle2,
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/20',
    icon: XCircle,
  },
};

const PAYMENT_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  'cash-on-delivery': { label: 'Cash on Delivery', bg: 'bg-neutral-800', text: 'text-neutral-300' },
  'bank-transfer': { label: 'Faysal Bank Transfer', bg: 'bg-indigo-950/80', text: 'text-indigo-300' },
  easypaisa: { label: 'EasyPaisa', bg: 'bg-emerald-950/80', text: 'text-emerald-300' },
  jazzcash: { label: 'JazzCash', bg: 'bg-amber-950/80', text: 'text-amber-300' },
  card: { label: 'Debit/Credit Card', bg: 'bg-sky-950/80', text: 'text-sky-300' },
};

export default function AdminDashboardClient() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [adminToken, setAdminToken] = useState('');

  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Check existing session
  useEffect(() => {
    const saved = sessionStorage.getItem('thriv_admin_token');
    if (saved) {
      setAdminToken(saved);
      setIsAuthenticated(true);
    }
  }, []);

  // Fetch orders when authenticated
  const fetchOrders = async (token: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/orders', {
        headers: {
          'x-admin-key': token,
        },
      });

      if (res.status === 401) {
        setIsAuthenticated(false);
        sessionStorage.removeItem('thriv_admin_token');
        setAuthError('Incorrect admin password');
        setLoading(false);
        return;
      }

      const data = await res.json();
      setIsConfigured(data.configured);

      if (data.configured && Array.isArray(data.orders)) {
        setOrders(data.orders);
      } else {
        // Fallback to mock orders for interactive demonstration if Supabase is empty
        setOrders(MOCK_ORDERS);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      setOrders(MOCK_ORDERS);
      setIsConfigured(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && adminToken) {
      fetchOrders(adminToken);
    }
  }, [isAuthenticated, adminToken]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (passwordInput.trim() === 'thriv2026') {
      sessionStorage.setItem('thriv_admin_token', passwordInput.trim());
      setAdminToken(passwordInput.trim());
      setIsAuthenticated(true);
    } else {
      setAuthError('Incorrect password. Default: thriv2026');
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      if (isConfigured) {
        const res = await fetch(`/api/admin/orders/${orderId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': adminToken,
          },
          body: JSON.stringify({ status: newStatus }),
        });

        if (!res.ok) {
          throw new Error('Failed to update status');
        }
      }

      // Optimistic / Local update
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus as any } : o))
      );
    } catch (err) {
      console.error('Update status error:', err);
      alert('Could not update status. Please try again.');
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedOrders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Generate WhatsApp Message Link for Hasan Bhai
  const getWhatsAppLink = (order: DbOrder) => {
    const rawNumber = order.whatsapp.replace(/[^0-9]/g, '');
    const cleanNumber = rawNumber.startsWith('0')
      ? `92${rawNumber.slice(1)}`
      : rawNumber.startsWith('92')
      ? rawNumber
      : `92${rawNumber}`;

    const itemsSummary =
      order.items
        ?.map(
          (i) =>
            `• ${i.product_name} (${i.selected_size || 'One Size'}) x${i.quantity} - Rs ${i.price.toLocaleString()}`
        )
        .join('\n') || 'Your ordered items';

    const msg = `Assalam o Alaikum ${order.customer_name}! 👋\n\nThank you for ordering with *Thriv* (@thriv.pk)!\n\n*Order #:* ${order.order_number}\n*Total:* Rs ${order.total.toLocaleString()} (${PAYMENT_LABELS[order.payment_method]?.label || order.payment_method})\n\n*Items:*\n${itemsSummary}\n\n*Delivery Address:*\n${order.address}, ${order.city}, ${order.province}\n\nPlease reply with *CONFIRM* so we can dispatch your parcel immediately! 🚀`;

    return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(msg)}`;
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        o.order_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.whatsapp.toLowerCase().includes(q) ||
        o.city.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [orders, statusFilter, searchQuery]);

  // Metrics
  const metrics = useMemo(() => {
    const totalRev = orders.reduce((sum, o) => sum + (o.status !== 'cancelled' ? o.total : 0), 0);
    const pendingCount = orders.filter((o) => o.status === 'pending').length;
    const confirmedCount = orders.filter((o) => o.status === 'confirmed').length;
    const dispatchedCount = orders.filter((o) => o.status === 'dispatched').length;
    return {
      revenue: totalRev,
      totalCount: orders.length,
      pending: pendingCount,
      confirmed: confirmedCount,
      dispatched: dispatchedCount,
    };
  }, [orders]);

  // ── Password Gate ─────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] text-neutral-100 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-[#141414] border border-neutral-800 p-8 rounded-2xl shadow-2xl">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto mb-6">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-center text-white mb-2">
            Thriv Admin Portal
          </h1>
          <p className="text-sm text-neutral-400 text-center mb-6">
            Enter the admin password to access live orders, inventory management, and customer WhatsApp dispatch.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                Admin Password
              </label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter password (default: thriv2026)"
                className="w-full px-4 py-3 bg-[#1e1e1e] border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition-colors"
                autoFocus
              />
            </div>

            {authError && (
              <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded">
                {authError}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
            >
              Unlock Dashboard
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-neutral-800/80 text-center">
            <Link
              href="/"
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              ← Back to Thriv Store
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Dashboard ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-100 font-sans pb-20">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#111111]/90 backdrop-blur-md border-b border-neutral-800 px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-wider uppercase text-white">
                  Thriv Admin
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-widest bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded">
                  v1.0
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Karachi, PK • WhatsApp: 0324-8188616
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={() => fetchOrders(adminToken)}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg border border-neutral-700 transition-colors cursor-pointer"
              title="Refresh Orders"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold uppercase tracking-wider bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded-lg border border-neutral-800 transition-colors"
            >
              <span>View Store</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            <button
              onClick={() => {
                sessionStorage.removeItem('thriv_admin_token');
                setIsAuthenticated(false);
              }}
              className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-neutral-400 hover:text-white transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 space-y-8">
        {/* Supabase Connection Status Banner */}
        {isConfigured === false && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 sm:p-5 text-amber-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs sm:text-sm">
                <p className="font-semibold text-amber-300">
                  Supabase Database Setup Required for Live Cloud Sync
                </p>
                <p className="text-amber-200/80 leading-relaxed">
                  Currently displaying simulated demo orders. To connect your free live database:
                  run the migration script in <code className="bg-black/40 px-1.5 py-0.5 rounded text-amber-100 font-mono">supabase/schema.sql</code> in your Supabase SQL editor, then add <code className="bg-black/40 px-1.5 py-0.5 rounded text-amber-100 font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="bg-black/40 px-1.5 py-0.5 rounded text-amber-100 font-mono">SUPABASE_SERVICE_ROLE_KEY</code> to your Vercel Project Settings.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#141414] border border-neutral-800 p-5 rounded-xl">
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <span className="text-xs uppercase font-semibold tracking-wider">Total Sales</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black text-white">
              Rs {metrics.revenue.toLocaleString()}
            </p>
            <p className="text-[11px] text-neutral-500 mt-1">Across all active orders</p>
          </div>

          <div className="bg-[#141414] border border-neutral-800 p-5 rounded-xl">
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <span className="text-xs uppercase font-semibold tracking-wider">Total Orders</span>
              <Boxes className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-black text-white">{metrics.totalCount}</p>
            <p className="text-[11px] text-neutral-500 mt-1">
              {metrics.confirmed} confirmed • {metrics.dispatched} in transit
            </p>
          </div>

          <div className="bg-[#141414] border border-neutral-800 p-5 rounded-xl">
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <span className="text-xs uppercase font-semibold tracking-wider">Pending Action</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black text-amber-400">{metrics.pending}</p>
            <p className="text-[11px] text-neutral-500 mt-1">Needs WhatsApp confirmation</p>
          </div>

          <div className="bg-[#141414] border border-neutral-800 p-5 rounded-xl">
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <span className="text-xs uppercase font-semibold tracking-wider">Dispatched</span>
              <Truck className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-black text-white">{metrics.dispatched}</p>
            <p className="text-[11px] text-neutral-500 mt-1">Couriers out for delivery</p>
          </div>
        </section>

        {/* Filters & Search */}
        <section className="bg-[#141414] border border-neutral-800 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by order #, name, phone..."
              className="w-full pl-10 pr-4 py-2 bg-[#1e1e1e] border border-neutral-700 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {['all', 'pending', 'confirmed', 'dispatched', 'delivered', 'cancelled'].map(
              (status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors capitalize shrink-0 cursor-pointer ${
                    statusFilter === status
                      ? 'bg-amber-500 text-neutral-950 font-bold'
                      : 'bg-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  {status}
                </button>
              )
            )}
          </div>
        </section>

        {/* Orders Table / List */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400">
              Orders ({filteredOrders.length})
            </h2>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="bg-[#141414] border border-neutral-800 rounded-xl p-12 text-center">
              <Package className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
              <p className="text-base font-semibold text-neutral-300">No orders found</p>
              <p className="text-xs text-neutral-500 mt-1">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try clearing your search filters'
                  : 'New customer orders will appear here automatically.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const isExpanded = expandedOrders[order.id] || false;
                const badge = STATUS_BADGES[order.status] || STATUS_BADGES.pending;
                const StatusIcon = badge.icon;
                const paymentInfo =
                  PAYMENT_LABELS[order.payment_method] || {
                    label: order.payment_method,
                    bg: 'bg-neutral-800',
                    text: 'text-neutral-300',
                  };

                return (
                  <div
                    key={order.id}
                    className="bg-[#141414] border border-neutral-800 rounded-xl overflow-hidden hover:border-neutral-700 transition-colors"
                  >
                    {/* Header Row */}
                    <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Order # & Customer info */}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => copyToClipboard(order.order_number, order.id)}
                            className="inline-flex items-center gap-1.5 font-mono text-sm font-bold text-white hover:text-amber-400 transition-colors cursor-pointer"
                            title="Click to copy Order #"
                          >
                            <span>{order.order_number}</span>
                            {copiedId === order.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-neutral-500" />
                            )}
                          </button>

                          {/* Status Badge */}
                          <div
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${badge.bg} ${badge.text} ${badge.border}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            <span>{badge.label}</span>
                          </div>

                          {/* Payment Method Badge */}
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${paymentInfo.bg} ${paymentInfo.text}`}
                          >
                            {paymentInfo.label}
                          </span>
                        </div>

                        <div className="text-xs text-neutral-400 flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
                          <span className="font-semibold text-neutral-200">
                            {order.customer_name}
                          </span>
                          <span>•</span>
                          <span>{order.city}, {order.province}</span>
                          <span>•</span>
                          <span>
                            {new Date(order.created_at).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Right: Actions & Total */}
                      <div className="flex flex-wrap items-center gap-3 justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-neutral-800">
                        <div className="text-left lg:text-right">
                          <p className="text-xs text-neutral-500 uppercase font-semibold">
                            Total
                          </p>
                          <p className="text-base font-black text-amber-400">
                            Rs {order.total.toLocaleString()}
                          </p>
                        </div>

                        {/* WhatsApp 1-Click Link */}
                        <a
                          href={getWhatsAppLink(order)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-lg shadow-emerald-950/40"
                          title="Open WhatsApp chat with prefilled order details"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>

                        {/* Status Dropdown */}
                        <select
                          value={order.status}
                          disabled={updatingId === order.id}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          className="px-3 py-2 bg-[#1e1e1e] border border-neutral-700 rounded-lg text-xs font-semibold text-white focus:outline-none focus:border-amber-500 transition-colors cursor-pointer capitalize"
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="dispatched">Dispatched</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>

                        {/* Expand Details Button */}
                        <button
                          onClick={() => toggleExpand(order.id)}
                          className="p-2 text-neutral-400 hover:text-white bg-neutral-800/60 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                          title="Toggle order details"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Order Details Panel */}
                    {isExpanded && (
                      <div className="bg-[#111111] border-t border-neutral-800/80 p-5 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          {/* Customer Details */}
                          <div className="space-y-1.5 bg-[#161616] p-4 rounded-lg border border-neutral-800">
                            <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
                              Customer & Delivery Details
                            </p>
                            <p className="text-white font-medium">
                              Name: <span className="text-neutral-300">{order.customer_name}</span>
                            </p>
                            <p className="text-white font-medium">
                              WhatsApp:{' '}
                              <a
                                href={`https://wa.me/${order.whatsapp.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-400 underline font-mono"
                              >
                                {order.whatsapp}
                              </a>
                            </p>
                            <p className="text-white font-medium">
                              Email: <span className="text-neutral-300">{order.email}</span>
                            </p>
                            <p className="text-white font-medium">
                              Address: <span className="text-neutral-300">{order.address}</span>
                            </p>
                            <p className="text-white font-medium">
                              City / Province:{' '}
                              <span className="text-neutral-300">
                                {order.city}, {order.province}
                              </span>
                            </p>
                            {order.notes && (
                              <p className="text-amber-300/90 pt-1 italic">
                                Note: &ldquo;{order.notes}&rdquo;
                              </p>
                            )}
                          </div>

                          {/* Financial Summary */}
                          <div className="space-y-1.5 bg-[#161616] p-4 rounded-lg border border-neutral-800">
                            <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
                              Payment Breakdown
                            </p>
                            <div className="flex justify-between text-neutral-400">
                              <span>Subtotal:</span>
                              <span className="text-white font-medium">
                                Rs {order.subtotal.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between text-neutral-400">
                              <span>Nationwide Delivery:</span>
                              <span className="text-white font-medium">
                                Rs {order.delivery_fee.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between text-white font-bold pt-2 border-t border-neutral-800 text-sm">
                              <span>Total Payable:</span>
                              <span className="text-amber-400">
                                Rs {order.total.toLocaleString()}
                              </span>
                            </div>
                            <div className="pt-2">
                              <p className="text-[11px] text-neutral-400">
                                Method: <strong className="text-neutral-200">{paymentInfo.label}</strong>
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Order Line Items */}
                        <div className="space-y-2 pt-2">
                          <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
                            Purchased Items ({order.items?.length || 0})
                          </p>
                          <div className="divide-y divide-neutral-800/80 border border-neutral-800 rounded-lg overflow-hidden">
                            {order.items?.map((item, idx) => (
                              <div
                                key={idx}
                                className="p-3 bg-[#161616] flex items-center justify-between gap-4 text-xs"
                              >
                                <div className="flex items-center gap-3">
                                  {item.image_url ? (
                                    <img
                                      src={item.image_url}
                                      alt={item.product_name}
                                      className="w-10 h-10 object-cover rounded bg-neutral-800"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded bg-neutral-800 flex items-center justify-center text-neutral-600">
                                      <Package className="w-5 h-5" />
                                    </div>
                                  )}
                                  <div>
                                    <p className="font-semibold text-white">
                                      {item.product_name}
                                    </p>
                                    <p className="text-neutral-400 text-[11px]">
                                      Brand: {item.brand} • Size:{' '}
                                      <span className="text-amber-400 font-semibold">
                                        {item.selected_size || 'N/A'}
                                      </span>
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-white">
                                    Rs {item.price.toLocaleString()}
                                  </p>
                                  <p className="text-[11px] text-neutral-500">
                                    Qty: {item.quantity}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
