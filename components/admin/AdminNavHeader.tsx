'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShoppingBag, Package, RefreshCw, LogOut, Plus } from 'lucide-react';

interface AdminNavHeaderProps {
  onRefresh?: () => void;
  loading?: boolean;
}

export function AdminNavHeader({ onRefresh, loading = false }: AdminNavHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/admin/login');
      router.refresh();
    }
  };

  const isOrders = pathname === '/admin' || pathname.startsWith('/admin/orders');
  const isProducts = pathname.startsWith('/admin/products');

  return (
    <header className="sticky top-0 z-40 bg-admin-bg/95 backdrop-blur-md border-b border-admin-raised px-4 py-3 sm:px-6">
      <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {/* Brand (first row on phones) */}
        <Link href="/admin" className="order-1 flex items-center gap-2">
          <span className="text-base font-extrabold tracking-tight text-white">thriv</span>
          <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-white/10 text-neutral-300">
            Admin
          </span>
        </Link>

        {/* Actions (first row on phones) */}
        <div className="order-2 sm:order-3 flex items-center gap-2">
          {isProducts && pathname !== '/admin/products/new' && (
            <Link
              href="/admin/products/new"
              className="inline-flex items-center gap-1.5 bg-white text-black hover:bg-neutral-200 text-xs font-bold px-3.5 py-2.5 rounded-[10px] transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">Add New Item</span>
              <span className="sm:hidden">Add</span>
            </Link>
          )}

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              title="Refresh"
              aria-label="Refresh"
              className="w-11 h-11 flex items-center justify-center text-neutral-400 hover:text-white bg-admin-field hover:bg-admin-raised border border-admin-line-strong rounded-[10px] transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}

          <button
            onClick={handleSignOut}
            title="Sign out"
            aria-label="Sign out"
            className="min-h-11 flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white bg-admin-field hover:bg-admin-raised border border-admin-line-strong px-3 py-2 rounded-[10px] transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>

        {/* Navigation tabs — own full-width row on phones (audit F-37),
            inline between brand and actions from sm up. */}
        <nav className="order-3 sm:order-2 w-full sm:w-auto flex items-center justify-center sm:justify-start gap-1 bg-admin-field p-1 rounded-full border border-admin-line-strong">
          <Link
            href="/admin"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all ${
              isOrders
                ? 'bg-white text-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Orders</span>
          </Link>

          <Link
            href="/admin/products"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all ${
              isProducts
                ? 'bg-white text-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Inventory</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
