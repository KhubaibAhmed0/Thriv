'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles, Tag } from 'lucide-react';

interface CategoryFilterRowProps {
  currentCategory?: string;
  currentSubcategory?: string;
  onSelectCategory?: (category: string, subcategory?: string) => void;
  interactive?: boolean; // if true, pushes to router /shop
}

export function CategoryFilterRow({
  currentCategory = 'all',
  currentSubcategory = 'all',
  onSelectCategory,
  interactive = true,
}: CategoryFilterRowProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Selected state can be driven by props or by URL query params
  const activeCat = searchParams ? (searchParams.get('category') ?? currentCategory) : currentCategory;
  const activeSub = searchParams ? (searchParams.get('subcategory') ?? currentSubcategory) : currentSubcategory;

  // Categories & Subcategory filters tailored specifically to Jeans and Graphic Tees as requested
  const filterOptions = [
    { id: 'all', label: 'All Items', category: 'all', subcategory: 'all' },
    { id: 'jeans', label: 'Jeans (Thrift 1-of-1)', category: 'jeans', subcategory: 'all' },
    { id: 'graphic-tees', label: 'Graphic T-Shirts (Merch)', category: 'graphic-tees', subcategory: 'all' },
    { id: 'wide-baggy', label: 'Baggy & Wide-Leg', category: 'jeans', subcategory: 'wide-leg' },
    { id: 'straight-cut', label: 'Straight Cut Denim', category: 'jeans', subcategory: 'straight-leg' },
    { id: 'cargo-denim', label: 'Cargo Denim', category: 'jeans', subcategory: 'cargo-denim' },
    { id: 'vintage-wash', label: 'Vintage Wash', category: 'jeans', subcategory: 'vintage-wash' },
    { id: 'anime-tees', label: 'Anime Heavyweight Tees', category: 'graphic-tees', subcategory: 'anime-tees' },
  ];

  const handleFilterClick = (cat: string, sub?: string) => {
    if (onSelectCategory) {
      onSelectCategory(cat, sub);
      return;
    }

    if (interactive) {
      const params = new URLSearchParams();
      if (cat !== 'all') params.set('category', cat);
      if (sub && sub !== 'all') params.set('subcategory', sub);
      const queryString = params.toString();
      router.push(`/shop${queryString ? `?${queryString}` : ''}`);
    }
  };

  return (
    <div className="w-full overflow-hidden py-3 sm:py-4 border-b border-[#E2E0DC]/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 snap-x-mandatory">
          
          {/* Quick Indicator Chip */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#EDEBE8] text-[#111111] text-xs font-semibold shrink-0">
            <Tag className="w-3.5 h-3.5 text-[#111111]" />
            <span>Categories</span>
          </div>

          {filterOptions.map((item) => {
            const isSelected =
              (item.category === 'all' && activeCat === 'all') ||
              (item.category === activeCat && (item.subcategory === 'all' ? activeSub === 'all' : activeSub === item.subcategory));

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleFilterClick(item.category, item.subcategory)}
                className={[
                  'px-4 py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-150 shrink-0 cursor-pointer snap-start',
                  isSelected
                    ? 'bg-[#111111] text-white shadow-[0_1px_4px_rgba(0,0,0,0.12)]'
                    : 'bg-white text-[#444444] hover:text-[#111111] border border-[#E2E0DC] hover:border-[#111111] shadow-[0_1px_2px_rgba(0,0,0,0.03)]',
                ].join(' ')}
                aria-pressed={isSelected}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
