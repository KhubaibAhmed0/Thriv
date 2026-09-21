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
    <header className="sticky top-0 z-40 bg-[#141414]/95 backdrop-blur-md border-b border-[#242424] px-4 py-3 sm:px-6">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
        
        {/* Left: Brand & Nav Tabs */}
        <div className="flex items-center gap-6">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="text-base font-extrabold tracking-tight text-white">thriv</span>
            <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-white/10 text-neutral-300">
              Admin
            </span>
          </Link>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-[#1e1e1e] p-1 rounded-full border border-[#2c2c2c]">
            <Link
              href="/admin"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                isOrders
                  ? 'bg-white text-[#111111] shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Orders</span>
            </Link>

            <Link
              href="/admin/products"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                isProducts
                  ? 'bg-white text-[#111111] shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Inventory</span>
            </Link>
          </nav>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {isProducts && pathname !== '/admin/products/new' && (
            <Link
              href="/admin/products/new"
              className="inline-flex items-center gap-1.5 bg-white text-[#111111] hover:bg-neutral-200 text-xs font-bold px-3.5 py-2 rounded-[10px] transition-colors shadow-sm"
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
              className="p-2 text-neutral-400 hover:text-white bg-[#202020] hover:bg-[#282828] border border-[#2e2e2e] rounded-[10px] transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}

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
  );
}
