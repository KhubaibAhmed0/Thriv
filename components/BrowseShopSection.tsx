'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { Product } from '@/types';
import { ProductCard } from '@/components/ProductCard';

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

export function BrowseShopSection({ products: initialProducts, featuredMerch: initialFeaturedMerch }: BrowseShopSectionProps) {
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [products, setProducts] = useState<Product[]>(initialProducts);

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((data) => {
        if (data.products && Array.isArray(data.products) && data.products.length > 0) {
          setProducts(data.products);
        }
      })
      .catch(() => {});
  }, []);

  const featuredMerch = useMemo(() => {
    return products.find((p) => p.isMerch && p.isFeatured) ?? initialFeaturedMerch;
  }, [products, initialFeaturedMerch]);

  const displayProducts = useMemo(() => {
    const sortAvailableFirst = (list: Product[]) => {
      return [...list].sort((a, b) => {
        const aSold = a.stock <= 0;
        const bSold = b.stock <= 0;
        if (aSold && !bSold) return 1;
        if (!aSold && bSold) return -1;
        return 0;
      });
    };

    if (activeTab === 'featured') {
      return sortAvailableFirst(products.filter((p) => p.isFeatured)).slice(0, 4);
    }
    if (activeTab === 'all') {
      const others = products.filter((p) => p.id !== featuredMerch?.id);
      const combined = featuredMerch ? [featuredMerch, ...others] : others;
      return sortAvailableFirst(combined).slice(0, 4);
    }
    return sortAvailableFirst(products.filter((p) => p.category === activeTab)).slice(0, 4);
  }, [products, featuredMerch, activeTab]);

  const shopMoreHref = useMemo(() => {
    if (activeTab === 'jeans') return '/shop?category=jeans';
    if (activeTab === 'graphic-tees') return '/shop?category=graphic-tees';
    if (activeTab === 'featured') return '/shop?sort=newest';
    return '/shop';
  }, [activeTab]);

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

      {/* Grid: 2 cols on mobile, 4 cols on desktop — 4 uniform cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5">
        {displayProducts.map((product, idx) => (
          <ProductCard
            key={product.id}
            product={product}
            priority={idx < 4}
          />
        ))}
      </div>

      {/* Shop More Button */}
      <div className="mt-8 text-center">
        <Link
          href={shopMoreHref}
          className="inline-flex items-center justify-center gap-2 bg-[#111111] text-white hover:bg-black font-bold text-xs sm:text-sm px-8 py-3.5 rounded-full transition-all shadow-[0_2px_8px_rgba(0,0,0,0.12)] active:scale-95 cursor-pointer"
        >
          Shop More <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
