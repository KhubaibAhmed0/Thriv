'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Heart, ShoppingBag } from 'lucide-react';
import type { Product } from '@/types';
import { ProductCard } from '@/components/ProductCard';
import { useWishlist } from '@/components/WishlistProvider';

export function WishlistPageClient() {
  const { slugs, isHydrated, count } = useWishlist();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.products)) {
          setAllProducts(data.products);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Match saved slugs against the live catalogue: sold or removed pieces
  // simply stop appearing (audit F-17 freshness).
  const savedProducts = useMemo(
    () => allProducts.filter((p) => slugs.includes(p.slug)),
    [allProducts, slugs]
  );

  const missingCount = loaded ? count - savedProducts.length : 0;

  if (!isHydrated || !loaded) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-xs text-muted-text mb-8"
      >
        <Link href="/" className="hover:text-black transition-colors">
          Home
        </Link>
        <span>/</span>
        <span className="text-black font-medium">Saved Items</span>
      </nav>

      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-text mb-3">
          Your Wishlist
        </p>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-black tracking-tight">
          Saved Items
        </h1>
        <p className="text-sm text-body mt-3">
          {count > 0
            ? `${count} ${count === 1 ? 'piece' : 'pieces'} saved on this device.`
            : 'Pieces you save with the heart icon appear here.'}
        </p>
        {missingCount > 0 && (
          <p className="text-xs text-muted-text mt-2">
            {missingCount === 1
              ? '1 saved piece has since sold or been removed.'
              : `${missingCount} saved pieces have since sold or been removed.`}
          </p>
        )}
      </div>

      {savedProducts.length === 0 ? (
        <div className="bg-card rounded-[20px] border border-border p-10 sm:p-16 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-card-inner border border-border flex items-center justify-center mb-5">
            <Heart className="w-6 h-6 text-muted-text" />
          </div>
          <h2 className="text-xl font-extrabold text-black mb-2">
            Nothing saved yet
          </h2>
          <p className="text-sm text-body max-w-md mx-auto leading-relaxed mb-7">
            Tap the heart on any piece to keep it here while you decide.
            Thrift items are one-of-one, so save the ones you love.
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center justify-center gap-2 min-h-11 bg-black text-white text-sm font-bold px-6 py-3 rounded-full hover:bg-black/85 transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            Browse the Shop
          </Link>
        </div>
      ) : (
        <section>
          <h2 className="sr-only">Saved pieces</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {savedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
