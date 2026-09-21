'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Package,
  Plus,
  Search,
  RefreshCw,
  ExternalLink,
  Trash2,
  Eye,
  EyeOff,
  AlertCircle,
  Tag,
  CheckCircle2,
} from 'lucide-react';
import { AdminNavHeader } from '@/components/admin/AdminNavHeader';
import { formatPrice } from '@/lib/formatPrice';

interface DbProduct {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  price_pkr: number;
  condition?: string | null;
  is_merch: boolean;
  size?: string | null;
  sizes?: string[] | null;
  stock: number;
  images: string[];
  description: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminProductsListClient() {
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'jeans' | 'merch' | 'sold-out'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/products');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch inventory');
      }
      const data = await res.json();
      setProducts(data.products || []);
    } catch (err: any) {
      setError(err?.message || 'Network error loading products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Toggle active status
  const handleToggleActive = async (product: DbProduct) => {
    setActionLoadingId(product.id);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !product.is_active }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to update product status');
      } else {
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, is_active: !p.is_active } : p))
        );
      }
    } catch {
      alert('Network error updating product');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete product
  const handleDelete = async (product: DbProduct) => {
    if (!window.confirm(`Are you sure you want to delete "${product.name}"? This action cannot be undone.`)) {
      return;
    }

    setActionLoadingId(product.id);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to delete product');
      } else {
        setProducts((prev) => prev.filter((p) => p.id !== product.id));
      }
    } catch {
      alert('Network error deleting product');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter products
  const filteredProducts = products.filter((p) => {
    // Search query
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const matchName = p.name.toLowerCase().includes(q);
      const matchBrand = p.brand.toLowerCase().includes(q);
      const matchSize = p.size?.toLowerCase().includes(q);
      if (!matchName && !matchBrand && !matchSize) return false;
    }

    // Filter tabs
    if (activeFilter === 'jeans') return !p.is_merch;
    if (activeFilter === 'merch') return p.is_merch;
    if (activeFilter === 'sold-out') return p.stock === 0;

    return true;
  });

  const totalItems = products.length;
  const activeItems = products.filter((p) => p.is_active && p.stock > 0).length;
  const soldOutItems = products.filter((p) => p.stock === 0).length;

  return (
    <div className="min-h-screen bg-[#111111] text-white pb-20">
      <AdminNavHeader onRefresh={fetchProducts} loading={loading} />

      <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6 space-y-6">
        
        {/* Top Header & Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Inventory
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">
              Manage product listings, photos, prices, and stock availability.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/products/new"
              className="inline-flex items-center gap-2 bg-white text-[#111111] hover:bg-neutral-200 text-xs sm:text-sm font-bold px-4 py-2.5 rounded-full transition-colors shadow-lg"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Add New Item
            </Link>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#181818] border border-[#262626] rounded-[16px] p-3.5 sm:p-4">
            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Total Items</p>
            <p className="text-xl sm:text-2xl font-black text-white mt-1 font-mono">{totalItems}</p>
          </div>
          <div className="bg-[#181818] border border-[#262626] rounded-[16px] p-3.5 sm:p-4">
            <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Active & In Stock</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-1 font-mono">{activeItems}</p>
          </div>
          <div className="bg-[#181818] border border-[#262626] rounded-[16px] p-3.5 sm:p-4">
            <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Sold Out</p>
            <p className="text-xl sm:text-2xl font-black text-neutral-400 mt-1 font-mono">{soldOutItems}</p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, brand, or size..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#181818] border border-[#282828] rounded-[12px] pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder:text-neutral-500 outline-none focus:border-neutral-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'all', label: `All (${products.length})` },
              { id: 'jeans', label: `Jeans (${products.filter((p) => !p.is_merch).length})` },
              { id: 'merch', label: `Graphic Tees (${products.filter((p) => p.is_merch).length})` },
              { id: 'sold-out', label: `Sold Out (${soldOutItems})` },
            ].map((chip) => {
              const active = activeFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  onClick={() => setActiveFilter(chip.id as any)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap border transition-colors cursor-pointer ${
                    active
                      ? 'bg-white text-[#111111] border-white'
                      : 'bg-[#1a1a1a] text-neutral-400 border-[#2a2a2a] hover:border-neutral-600 hover:text-neutral-200'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-rose-950/40 border border-rose-800/40 rounded-[14px] flex items-center gap-2 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Product Cards Grid / List */}
        {loading && products.length === 0 ? (
          <div className="text-center py-20">
            <RefreshCw className="w-6 h-6 text-neutral-600 animate-spin mx-auto mb-3" />
            <p className="text-xs text-neutral-400">Loading inventory...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16 bg-[#161616] border border-[#242424] rounded-[20px] p-8">
            <Package className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
            <p className="text-base font-bold text-neutral-300">No items found</p>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
              {searchQuery ? 'Try clearing your search query.' : 'Click "Add New Item" to create your first product listing.'}
            </p>
            <Link
              href="/admin/products/new"
              className="inline-flex items-center gap-1.5 bg-white text-[#111111] text-xs font-bold px-4 py-2 rounded-full mt-4 hover:bg-neutral-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Item Now
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product) => {
              const coverImage = product.images?.[0] || '/placeholder.png';
              const isSoldOut = product.stock === 0;
              const isActionLoading = actionLoadingId === product.id;

              return (
                <div
                  key={product.id}
                  className={`bg-[#181818] border rounded-[20px] overflow-hidden flex flex-col justify-between transition-all ${
                    product.is_active
                      ? 'border-[#262626] hover:border-[#3a3a3a]'
                      : 'border-[#222222] opacity-60'
                  }`}
                >
                  {/* Top: Image & Badges */}
                  <div className="relative aspect-[4/3] bg-[#222222] overflow-hidden">
                    {coverImage && coverImage !== '/placeholder.png' ? (
                      <Image
                        src={coverImage}
                        alt={product.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-600">
                        <Package className="w-10 h-10" />
                      </div>
                    )}

                    {/* Top Badges */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-full text-white">
                        {product.brand}
                      </span>
                      {product.condition && (
                        <span className="text-[10px] font-semibold bg-white/90 backdrop-blur-md px-2 py-0.5 rounded-full text-[#111111]">
                          {product.condition}
                        </span>
                      )}
                    </div>

                    {/* Stock Status Badge */}
                    <div className="absolute top-2.5 right-2.5">
                      {isSoldOut ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-500/90 text-white px-2 py-0.5 rounded-full">
                          Sold Out
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/90 text-white px-2 py-0.5 rounded-full">
                          {product.is_merch ? `Stock: ${product.stock}` : '1-of-1'}
                        </span>
                      )}
                    </div>

                    {!product.is_active && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
                        <span className="text-xs font-bold uppercase tracking-widest text-neutral-300 bg-black/80 px-3 py-1 rounded-full border border-neutral-700">
                          Hidden from Store
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Middle: Details */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white line-clamp-1">
                        {product.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-neutral-400">
                        <span>
                          {product.is_merch
                            ? product.sizes?.join(', ') || 'All Sizes'
                            : `Size ${product.size || 'Free'}`}
                        </span>
                        <span>·</span>
                        <span className="capitalize">{product.category.replace('-', ' ')}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#242424]">
                      <span className="text-base font-extrabold text-white font-mono">
                        {formatPrice(product.price_pkr)}
                      </span>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/product/${product.slug}`}
                          target="_blank"
                          title="View on live store"
                          className="p-2 text-neutral-400 hover:text-white hover:bg-[#262626] rounded-[8px] transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>

                        <button
                          onClick={() => handleToggleActive(product)}
                          disabled={isActionLoading}
                          title={product.is_active ? 'Hide item from store' : 'Publish item to store'}
                          className="p-2 text-neutral-400 hover:text-white hover:bg-[#262626] rounded-[8px] transition-colors cursor-pointer"
                        >
                          {product.is_active ? (
                            <Eye className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5 text-neutral-500" />
                          )}
                        </button>

                        <button
                          onClick={() => handleDelete(product)}
                          disabled={isActionLoading}
                          title="Delete item"
                          className="p-2 text-neutral-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-[8px] transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>
    </div>
  );
}
