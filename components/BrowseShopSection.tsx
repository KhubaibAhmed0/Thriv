'use client';

import React, { useState } from 'react';
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

export function BrowseShopSection({ products, featuredMerch }: BrowseShopSectionProps) {
  const [activeTab, setActiveTab] = useState<TabId>('all');

  const displayProducts = React.useMemo(() => {
    if (activeTab === 'featured') {
      return products.filter((p) => p.isFeatured).slice(0, 8);
    }
    if (activeTab === 'all') {
      const others = products.filter((p) => p.id !== featuredMerch?.id);
      const combined = featuredMerch ? [featuredMerch, ...others] : others;
      return combined.slice(0, 8);
    }
    return products.filter((p) => p.category === activeTab).slice(0, 8);
  }, [products, featuredMerch, activeTab]);

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

      {/* Grid: 2 cols on mobile, 3 cols on tablet, 4 cols on desktop — uniform ProductCard layout */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
        {displayProducts.map((product, idx) => (
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
