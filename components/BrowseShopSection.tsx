'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { Product } from '@/types';
import { ProductCard } from '@/components/ProductCard';
import { ProductImage } from '@/components/ProductImage';
import { Badge } from '@/components/ui/Badge';
import { formatPrice } from '@/lib/formatPrice';
import { useCart } from '@/components/CartProvider';

interface BrowseShopSectionProps {
  products: Product[];
  featuredMerch: Product | null;
}

const TABS = [
  { id: 'all', label: 'All Items' },
  { id: 'jeans', label: 'Jeans' },
  { id: 'graphic-tees', label: 'Graphic Tees' },
  { id: 'featured', label: 'Featured' },
] as const;

type TabId = typeof TABS[number]['id'];

export function BrowseShopSection({ products, featuredMerch }: BrowseShopSectionProps) {
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const { addItem, isInCart } = useCart();

  const filtered = products
    .filter((p) => {
      if (activeTab === 'all') return true;
      if (activeTab === 'featured') return p.isFeatured;
      return p.category === activeTab;
    })
    .slice(0, 8); // Show max 8 on homepage

  return (
    <div>
      {/* Tab Filter Row (matching reference pill style) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            aria-pressed={activeTab === tab.id}
            className={[
              'px-4 py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-150 cursor-pointer shrink-0',
              activeTab === tab.id
                ? 'bg-[#111111] text-white shadow-[0_1px_4px_rgba(0,0,0,0.12)]'
                : 'bg-white text-[#444444] hover:text-[#111111] border border-[#E2E0DC] hover:border-[#111111]',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid: 3 cols on desktop. First position on desktop = Featured Drop card (spans 1 col, 2 rows) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">

        {/* Featured Drop Card (reference "Special Offers" stacked-card style) — always visible on 'all' or 'featured' tab */}
        {(activeTab === 'all' || activeTab === 'featured') && featuredMerch && (
          <div className="col-span-2 md:col-span-1 md:row-span-2">
            <FeaturedDropCard product={featuredMerch} onAdd={() => addItem(featuredMerch, 'L')} inCart={isInCart(featuredMerch.id, 'L')} />
          </div>
        )}

        {/* Regular product cards */}
        {filtered
          .filter((p) => p.id !== featuredMerch?.id || activeTab !== 'all')
          .slice(0, activeTab === 'all' ? 7 : 8)
          .map((product, idx) => (
            <ProductCard
              key={product.id}
              product={product}
              priority={idx < 4}
            />
          ))}
      </div>
    </div>
  );
}

// ── Featured Drop Card ─────────────────────────────────────────────────
// Replicates the reference "Special Offers" stacked/layered large card style
function FeaturedDropCard({
  product,
  onAdd,
  inCart,
}: {
  product: Product;
  onAdd: () => void;
  inCart: boolean;
}) {
  return (
    <div className="relative bg-[#EDEBE8] rounded-[20px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.07)] border border-[#E2E0DC] flex flex-col h-full min-h-[360px] md:min-h-[480px] overflow-hidden">
      {/* Background stacked card layer (visual depth effect from reference) */}
      <div className="absolute -bottom-3 -right-3 w-[92%] h-[92%] bg-[#E2DFD9] rounded-[20px] -z-0" aria-hidden="true" />
      <div className="absolute -bottom-1.5 -right-1.5 w-[96%] h-[96%] bg-[#E8E5E1] rounded-[20px] -z-0" aria-hidden="true" />

      <div className="relative z-10 flex flex-col h-full">
        {/* Promo badge top-left */}
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center px-2.5 py-1 bg-[#E8F0E0] text-[#3A6B35] text-[11px] font-bold rounded-full">
            Featured Drop
          </span>
          <Badge variant="condition" label={product.condition} />
        </div>

        {/* Title area */}
        <div className="mb-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#9A9A9A]">
            {product.brand} · In-House Merch
          </p>
          <h3 className="text-base sm:text-lg font-extrabold text-[#111111] leading-snug mt-1">
            {product.name}
          </h3>
          <p className="text-xs text-[#444444] mt-1.5 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        </div>

        {/* Product Image */}
        <div className="flex-1 relative">
          <ProductImage
            slug={product.slug}
            brand={product.brand}
            subcategory={product.subcategory}
            aspectRatio="4:5"
            alt={product.name}
            className="w-full max-h-[260px]"
          />
        </div>

        {/* Bottom: Price + CTA */}
        <div className="mt-3 flex items-center justify-between gap-3 pt-3 border-t border-[#E2E0DC]/60">
          <div>
            <p className="text-base font-black text-[#111111]">{formatPrice(product.price)}</p>
            <p className="text-[10px] text-[#9A9A9A]">S / M / L / XL</p>
          </div>
          <div className="flex flex-col gap-1.5 items-end">
            <button
              type="button"
              onClick={onAdd}
              className={[
                'text-xs font-bold px-4 py-2 rounded-full transition-all active:scale-95 cursor-pointer',
                inCart
                  ? 'bg-[#3A6B35] text-white'
                  : 'bg-[#111111] text-white hover:bg-black shadow-[0_1px_4px_rgba(0,0,0,0.12)]',
              ].join(' ')}
            >
              {inCart ? 'In Cart' : 'Add To Cart'}
            </button>
            <Link
              href={`/product/${product.slug}`}
              className="text-[10px] text-[#9A9A9A] hover:text-[#111111] underline underline-offset-2 transition-colors"
            >
              View Details
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
