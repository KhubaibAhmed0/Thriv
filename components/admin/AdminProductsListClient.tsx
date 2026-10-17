'use client';

import { useState, useEffect, useCallback, useId } from 'react';
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
  Pencil,
} from 'lucide-react';
import { AdminNavHeader } from '@/components/admin/AdminNavHeader';
import { AdminToast, ConfirmDialog, type AdminToastState } from '@/components/admin/AdminFeedback';
import { formatPrice } from '@/lib/formatPrice';
import { errorMessage } from '@/lib/errors';

interface DbProduct {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  subcategory?: string | null;
  price_pkr: number;
  condition?: string | null;
  is_merch: boolean;
  is_featured?: boolean;
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
  const [editTarget, setEditTarget] = useState<DbProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DbProduct | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<AdminToastState | null>(null);

  // Initial `loading` state covers the first fetch; the refresh callback sets
  // the spinner itself so the effect body performs no synchronous setState
  // (react-hooks/set-state-in-effect).
  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/products');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch inventory');
      }
      const data = await res.json();
      setError(null);
      setProducts(data.products || []);
    } catch (err) {
      setError(errorMessage(err, 'Network error loading products'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch on mount: state updates land after the network await; the
    // lint rule's interprocedural heuristic treats the call as synchronous.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProducts();
  }, [fetchProducts]);

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
        setToast({ kind: 'error', message: data.error || 'Failed to update product status' });
      } else {
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, is_active: !p.is_active } : p))
        );
        setToast({
          kind: 'success',
          message: product.is_active
            ? 'Item hidden from the store'
            : 'Item published to the store',
        });
      }
    } catch {
      setToast({ kind: 'error', message: 'Network error updating product' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete product — audit F-77: ConfirmDialog instead of window.confirm.
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/products/${deleteTarget.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        setToast({ kind: 'error', message: data.error || 'Failed to delete product' });
      } else {
        setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
        setToast({ kind: 'success', message: `Deleted "${deleteTarget.name}"` });
      }
    } catch {
      setToast({ kind: 'error', message: 'Network error deleting product' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
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
    <div data-admin className="min-h-screen bg-black text-white pb-20">
      <AdminNavHeader
        onRefresh={() => {
          setLoading(true);
          fetchProducts();
        }}
        loading={loading}
      />

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
              className="inline-flex items-center gap-2 bg-white text-black hover:bg-neutral-200 text-xs sm:text-sm font-bold px-4 py-2.5 rounded-full transition-colors shadow-lg"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Add New Item
            </Link>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-admin-bg border border-admin-line rounded-[16px] p-3.5 sm:p-4">
            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Total Items</p>
            <p className="text-xl sm:text-2xl font-black text-white mt-1 font-mono">{totalItems}</p>
          </div>
          <div className="bg-admin-bg border border-admin-line rounded-[16px] p-3.5 sm:p-4">
            <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Active & In Stock</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-1 font-mono">{activeItems}</p>
          </div>
          <div className="bg-admin-bg border border-admin-line rounded-[16px] p-3.5 sm:p-4">
            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Sold Out</p>
            <p className="text-xl sm:text-2xl font-black text-neutral-400 mt-1 font-mono">{soldOutItems}</p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, brand, or size..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-admin-bg border border-admin-line rounded-[12px] pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder:text-neutral-400 outline-none focus:border-neutral-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
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
                  onClick={() => setActiveFilter(chip.id as 'all' | 'jeans' | 'merch' | 'sold-out')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap border transition-colors cursor-pointer ${
                    active
                      ? 'bg-white text-black border-white'
                      : 'bg-admin-field text-neutral-400 border-admin-line hover:border-neutral-600 hover:text-neutral-200'
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
        <h2 className="sr-only">All items</h2>
        {loading && products.length === 0 ? (
          <div className="text-center py-20">
            <RefreshCw className="w-6 h-6 text-neutral-600 animate-spin mx-auto mb-3" />
            <p className="text-xs text-neutral-400">Loading inventory...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16 bg-admin-bg border border-admin-raised rounded-[20px] p-8">
            <Package className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
            <p className="text-base font-bold text-neutral-300">No items found</p>
            <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
              {searchQuery ? 'Try clearing your search query.' : 'Click "Add New Item" to create your first product listing.'}
            </p>
            <Link
              href="/admin/products/new"
              className="inline-flex items-center gap-1.5 bg-white text-black text-xs font-bold px-4 py-2 rounded-full mt-4 hover:bg-neutral-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Item Now
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product) => {
              const coverImage = product.images?.[0];
              const isSoldOut = product.stock === 0;
              const isActionLoading = actionLoadingId === product.id;

              return (
                <div
                  key={product.id}
                  className={`bg-admin-bg border rounded-[20px] overflow-hidden flex flex-col justify-between transition-all ${
                    product.is_active
                      ? 'border-admin-line hover:border-admin-line-strong'
                      : 'border-admin-raised'
                  }`}
                >
                  {/* Top: Image & Badges */}
                  <div className="relative aspect-[4/3] bg-admin-field overflow-hidden">
                    {coverImage ? (
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
                        <span className="text-[10px] font-semibold bg-white/90 backdrop-blur-md px-2 py-0.5 rounded-full text-black">
                          {product.condition}
                        </span>
                      )}
                    </div>

                    {/* Stock Status Badge */}
                    <div className="absolute top-2.5 right-2.5">
                      {isSoldOut ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-950/90 text-rose-300 px-2 py-0.5 rounded-full">
                          Sold Out
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-950/90 text-emerald-300 px-2 py-0.5 rounded-full">
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

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-admin-raised">
                      <span className="text-base font-extrabold text-white font-mono">
                        {formatPrice(product.price_pkr)}
                      </span>

                      {/* Actions — 44px hit areas (audit F-73) */}
                      <div className="flex items-center gap-0.5">
                        <Link
                          href={`/product/${product.slug}`}
                          target="_blank"
                          title="View on live store"
                          aria-label={`View ${product.name} on the live store`}
                          className="w-11 h-11 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-admin-raised rounded-[8px] transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>

                        <button
                          onClick={() => setEditTarget(product)}
                          disabled={isActionLoading}
                          title="Edit item"
                          aria-label={`Edit ${product.name}`}
                          className="w-11 h-11 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-admin-raised rounded-[8px] transition-colors cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleToggleActive(product)}
                          disabled={isActionLoading}
                          title={product.is_active ? 'Hide item from store' : 'Publish item to store'}
                          aria-label={
                            product.is_active
                              ? `Hide ${product.name} from the store`
                              : `Publish ${product.name} to the store`
                          }
                          className="w-11 h-11 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-admin-raised rounded-[8px] transition-colors cursor-pointer"
                        >
                          {product.is_active ? (
                            <Eye className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-neutral-400" />
                          )}
                        </button>

                        <button
                          onClick={() => setDeleteTarget(product)}
                          disabled={isActionLoading}
                          title="Delete item"
                          aria-label={`Delete ${product.name}`}
                          className="w-11 h-11 flex items-center justify-center text-neutral-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-[8px] transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Edit item modal (audit F-39) */}
      {editTarget && (
        <EditItemModal
          product={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(updated) => {
            setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            setEditTarget(null);
            setToast({ kind: 'success', message: 'Item updated' });
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this item?"
        message={`"${deleteTarget?.name ?? 'This item'}" will be permanently removed. Existing links to its product page will 404.`}
        confirmLabel="Delete item"
        destructive
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

// ── Edit item modal (audit F-39) — typo/price/stock fixes without delete ──
const CONDITION_CHOICES = ['Premium', 'Excellent', 'Very Good'];

function EditItemModal({
  product,
  onClose,
  onSaved,
}: {
  product: DbProduct;
  onClose: () => void;
  onSaved: (product: DbProduct) => void;
}) {
  const titleId = useId();
  const [name, setName] = useState(product.name);
  const [brand, setBrand] = useState(product.brand);
  const [price, setPrice] = useState(String(product.price_pkr));
  const [stock, setStock] = useState(String(product.stock));
  const [subcategory, setSubcategory] = useState(product.subcategory ?? '');
  const [condition, setCondition] = useState(product.condition ?? 'Premium');
  const [isFeatured, setIsFeatured] = useState(!!product.is_featured);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSave = async () => {
    setFormError(null);
    const priceNum = Number(price);
    const stockNum = Number(stock);
    if (!name.trim() || !brand.trim()) {
      setFormError('Name and brand are required.');
      return;
    }
    if (!Number.isInteger(priceNum) || priceNum <= 0) {
      setFormError('Price must be a positive whole number of PKR.');
      return;
    }
    if (!Number.isInteger(stockNum) || stockNum < 0) {
      setFormError('Stock must be zero or a positive whole number.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          brand: brand.trim(),
          price_pkr: priceNum,
          stock: stockNum,
          subcategory: subcategory.trim(),
          ...(product.is_merch ? {} : { condition }),
          is_featured: isFeatured,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to save changes.');
        return;
      }
      onSaved(data.product as DbProduct);
    } catch {
      setFormError('Network error while saving changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-admin-bg border border-admin-line-strong rounded-[16px] p-5 space-y-4"
      >
        <h2 id={titleId} className="text-sm font-bold text-white">
          Edit item
        </h2>

        {formError && (
          <div
            role="alert"
            className="p-3 bg-rose-950/40 border border-rose-800/40 rounded-[12px] text-rose-300 text-xs"
          >
            {formError}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label htmlFor="edit-name" className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Product Name
            </label>
            <input
              id="edit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-admin-field border border-admin-line-strong rounded-[12px] px-3.5 py-2.5 text-sm text-white outline-none focus:border-neutral-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-brand" className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Brand
              </label>
              <input
                id="edit-brand"
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full bg-admin-field border border-admin-line-strong rounded-[12px] px-3.5 py-2.5 text-sm text-white outline-none focus:border-neutral-400"
              />
            </div>
            <div>
              <label htmlFor="edit-subcategory" className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Style / Fit
              </label>
              <input
                id="edit-subcategory"
                type="text"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className="w-full bg-admin-field border border-admin-line-strong rounded-[12px] px-3.5 py-2.5 text-sm text-white outline-none focus:border-neutral-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-price" className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Price (PKR)
              </label>
              <input
                id="edit-price"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-admin-field border border-admin-line-strong rounded-[12px] px-3.5 py-2.5 text-sm text-white outline-none focus:border-neutral-400 font-mono"
              />
            </div>
            <div>
              <label htmlFor="edit-stock" className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Stock
              </label>
              <input
                id="edit-stock"
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full bg-admin-field border border-admin-line-strong rounded-[12px] px-3.5 py-2.5 text-sm text-white outline-none focus:border-neutral-400 font-mono"
              />
              {!product.is_merch && (
                <p className="text-[10px] text-neutral-400 mt-1">
                  Thrift pieces can only be in stock (1) or sold out (0).
                </p>
              )}
            </div>
          </div>

          {!product.is_merch && (
            <div>
              <label htmlFor="edit-condition" className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Condition Grade
              </label>
              <select
                id="edit-condition"
                value={CONDITION_CHOICES.includes(condition) ? condition : 'Premium'}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full appearance-none bg-admin-field border border-admin-line-strong rounded-[12px] px-3.5 py-2.5 text-sm text-white outline-none focus:border-neutral-400 cursor-pointer"
              >
                {CONDITION_CHOICES.map((choice) => (
                  <option key={choice} value={choice}>
                    {choice}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="w-4 h-4 rounded border-admin-line-strong text-black focus:ring-0 cursor-pointer"
            />
            <span className="text-xs text-neutral-300">Featured on homepage</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 px-4 text-xs font-semibold text-neutral-300 hover:text-white bg-admin-field hover:bg-admin-raised border border-admin-line rounded-full transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="min-h-11 px-5 text-xs font-bold bg-white text-black hover:bg-neutral-200 rounded-full transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
