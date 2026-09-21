'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { SlidersHorizontal, ArrowUpDown, X, Search, Sparkles } from 'lucide-react';
import { products as initialProducts } from '@/data/products';
import { ProductCard } from '@/components/ProductCard';
import { CustomDropdown, type DropdownOption } from '@/components/ui/CustomDropdown';
import type { Condition, Brand, Product } from '@/types';

const BRANDS: Brand[] = ['Zara', 'Bershka', 'Calvin Klein', 'H&M', 'Old Navy', 'Thriv'];
const CONDITIONS: Condition[] = ['Premium', 'Excellent', 'Very Good'];

const brandOptions: DropdownOption[] = [
  { value: 'all', label: 'All Brands' },
  ...BRANDS.map((b) => ({ value: b, label: b })),
];

const conditionOptions: DropdownOption[] = [
  { value: 'all', label: 'All Conditions' },
  { value: 'Premium', label: 'Grade: Premium', dotColor: '#5A4A2F' },
  { value: 'Excellent', label: 'Grade: Excellent', dotColor: '#1E3A5F' },
  { value: 'Very Good', label: 'Grade: Very Good', dotColor: '#2E5E2E' },
];

const sortOptions: DropdownOption[] = [
  { value: 'newest', label: 'Featured & Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
];

export function ShopCatalog() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [allProducts, setAllProducts] = useState<Product[]>(initialProducts);

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((data) => {
        if (data.products && Array.isArray(data.products) && data.products.length > 0) {
          setAllProducts(data.products);
        }
      })
      .catch(() => {});
  }, []);

  // Read URL query params
  const activeCategory = searchParams.get('category') || 'all';
  const activeSubcategory = searchParams.get('subcategory') || 'all';
  const activeBrand = searchParams.get('brand') || 'all';
  const activeCondition = searchParams.get('condition') || 'all';
  const activeSort = searchParams.get('sort') || 'newest';
  const searchQuery = searchParams.get('q') || '';

  // Helper to update URL params
  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all' || !value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const query = params.toString();
    router.push(`/shop${query ? `?${query}` : ''}`, { scroll: false });
  };

  const clearAllFilters = () => {
    router.push('/shop', { scroll: false });
  };

  // Primary category chips tailored for Jeans & Graphic Tees
  const categoryPills = [
    { label: 'All Items', cat: 'all', sub: 'all' },
    { label: 'Jeans (Thrift 1-of-1)', cat: 'jeans', sub: 'all' },
    { label: 'Graphic T-Shirts (Merch)', cat: 'graphic-tees', sub: 'all' },
    { label: 'Baggy & Wide-Leg', cat: 'jeans', sub: 'wide-leg' },
    { label: 'Straight Leg Denim', cat: 'jeans', sub: 'straight-leg' },
    { label: 'Cargo Denim', cat: 'jeans', sub: 'cargo-denim' },
    { label: 'Vintage Wash', cat: 'jeans', sub: 'vintage-wash' },
    { label: 'Anime Heavyweight Tees', cat: 'graphic-tees', sub: 'anime-tees' },
  ];

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    return allProducts
      .filter((product) => {
        // Search query filter
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchName = product.name.toLowerCase().includes(q);
          const matchBrand = product.brand.toLowerCase().includes(q);
          const matchDesc = product.description.toLowerCase().includes(q);
          const matchSub = product.subcategory.toLowerCase().includes(q);
          if (!matchName && !matchBrand && !matchDesc && !matchSub) return false;
        }

        // Category filter
        if (activeCategory !== 'all' && product.category !== activeCategory) {
          return false;
        }

        // Subcategory filter
        if (activeSubcategory !== 'all' && product.subcategory !== activeSubcategory) {
          return false;
        }

        // Brand filter
        if (activeBrand !== 'all' && product.brand !== activeBrand) {
          return false;
        }

        // Condition filter
        if (activeCondition !== 'all' && product.condition !== activeCondition) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (activeSort === 'price-asc') {
          return a.price - b.price;
        }
        if (activeSort === 'price-desc') {
          return b.price - a.price;
        }
        // 'newest' default: keep featured first, then original order
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        return 0;
      });
  }, [allProducts, activeCategory, activeSubcategory, activeBrand, activeCondition, activeSort, searchQuery]);

  const hasActiveFilters =
    activeCategory !== 'all' ||
    activeSubcategory !== 'all' ||
    activeBrand !== 'all' ||
    activeCondition !== 'all' ||
    searchQuery !== '';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[#9A9A9A] mb-4">
        <Link href="/" className="hover:text-[#111111] transition-colors">
          Home
        </Link>
        <span>/</span>
        <span className="text-[#111111] font-medium">Shop</span>
        {activeCategory !== 'all' && (
          <>
            <span>/</span>
            <span className="capitalize text-[#111111]">
              {activeCategory === 'jeans' ? 'Jeans' : 'Graphic T-Shirts'}
            </span>
          </>
        )}
      </nav>

      {/* Page Title & Subtitle */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#E2E0DC]">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#111111] tracking-tight">
            Curated Drops
          </h1>
          <p className="text-sm text-[#444444] mt-1.5 max-w-xl">
            One-of-one branded denim (Zara, Bershka, Calvin Klein, H&M, Old Navy) sanitized and checked in Karachi, alongside in-house anime graphic tees.
          </p>
        </div>

        {/* Total results count */}
        <div className="text-xs font-semibold text-[#444444] shrink-0 bg-white border border-[#E2E0DC] px-3.5 py-1.5 rounded-full self-start md:self-auto">
          {filteredProducts.length} {filteredProducts.length === 1 ? 'Piece Available' : 'Pieces Available'}
        </div>
      </div>

      {/* ── Category Filter Pills Row ── */}
      <div className="py-5 overflow-x-auto no-scrollbar snap-x-mandatory">
        <div className="flex items-center gap-2">
          {categoryPills.map((pill) => {
            const isSelected =
              (pill.cat === 'all' && activeCategory === 'all' && activeSubcategory === 'all') ||
              (pill.cat === activeCategory && (pill.sub === 'all' ? activeSubcategory === 'all' : activeSubcategory === pill.sub));

            return (
              <button
                key={pill.label}
                type="button"
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  if (pill.cat === 'all') {
                    params.delete('category');
                    params.delete('subcategory');
                  } else {
                    params.set('category', pill.cat);
                    if (pill.sub !== 'all') {
                      params.set('subcategory', pill.sub);
                    } else {
                      params.delete('subcategory');
                    }
                  }
                  const q = params.toString();
                  router.push(`/shop${q ? `?${q}` : ''}`, { scroll: false });
                }}
                className={[
                  'px-4 py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-150 shrink-0 cursor-pointer snap-start',
                  isSelected
                    ? 'bg-[#111111] text-white shadow-[0_1px_4px_rgba(0,0,0,0.12)]'
                    : 'bg-white text-[#444444] hover:text-[#111111] border border-[#E2E0DC] hover:border-[#111111]',
                ].join(' ')}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Secondary Controls: Brand, Condition & Sort ── */}
      <div className="bg-[#EDEBE8] rounded-[16px] p-3 sm:p-4 mb-8 flex flex-wrap items-center justify-between gap-4">
        
        {/* Left: Brand & Condition pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[#9A9A9A] font-semibold uppercase tracking-wider text-[10px] hidden sm:inline mr-1">
            Filter:
          </span>

          {/* Brand Selector */}
          <CustomDropdown
            prefix="Brand"
            value={activeBrand}
            onChange={(val) => setParam('brand', val)}
            options={brandOptions}
          />

          {/* Condition Selector */}
          <CustomDropdown
            prefix="Condition"
            value={activeCondition}
            onChange={(val) => setParam('condition', val)}
            options={conditionOptions}
          />

          {/* Search Query Pill if searching */}
          {searchQuery && (
            <span className="inline-flex items-center gap-1.5 bg-white text-[#111111] text-xs font-medium px-3 py-1.5 rounded-full border border-[#E2E0DC]">
              <Search className="w-3 h-3 text-[#9A9A9A]" />
              &quot;{searchQuery}&quot;
              <button
                type="button"
                onClick={() => setParam('q', '')}
                className="hover:text-red-600 ml-1"
                aria-label="Remove search filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs text-[#8B2020] hover:underline font-semibold ml-2 cursor-pointer"
            >
              Reset All
            </button>
          )}
        </div>

        {/* Right: Sort Control */}
        <div className="ml-auto">
          <CustomDropdown
            prefix="Sort"
            icon={<ArrowUpDown className="w-3 h-3" />}
            value={activeSort}
            onChange={(val) => setParam('sort', val)}
            options={sortOptions}
            align="right"
          />
        </div>

      </div>

      {/* ── Product Grid ── */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
          {filteredProducts.map((product, idx) => (
            <ProductCard
              key={product.id}
              product={product}
              priority={idx < 4}
            />
          ))}
        </div>
      ) : (
        /* ── Written Empty State (not a shrug) ── */
        <div className="bg-[#EDEBE8] rounded-[20px] p-8 sm:p-12 text-center max-w-2xl mx-auto my-12 border border-[#E2E0DC]">
          <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Sparkles className="w-6 h-6 text-[#111111]" />
          </div>
          <h3 className="text-xl font-bold text-[#111111]">
            No Pieces Match This Filter
          </h3>
          <p className="text-sm text-[#444444] mt-2 leading-relaxed">
            Every thrift piece at Thriv is a unique one-of-one item with a single size and stock of exactly 1. Because pieces don&apos;t restock, specific combinations of fit, brand, or size sell out quickly.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={clearAllFilters}
              className="bg-[#111111] text-white text-xs font-semibold px-5 py-2.5 rounded-full hover:bg-black transition-colors"
            >
              Reset Filters & View All
            </button>
            <Link
              href="/shop?category=jeans"
              className="bg-white text-[#111111] border border-[#E2E0DC] text-xs font-semibold px-5 py-2.5 rounded-full hover:border-[#111111] transition-colors"
            >
              Browse All Jeans
            </Link>
            <Link
              href="/shop?category=graphic-tees"
              className="bg-white text-[#111111] border border-[#E2E0DC] text-xs font-semibold px-5 py-2.5 rounded-full hover:border-[#111111] transition-colors"
            >
              Browse Graphic Tees
            </Link>
          </div>
        </div>
      )}

      {/* Bottom delivery reminder */}
      <div className="mt-16 text-center border-t border-[#E2E0DC] pt-8">
        <p className="text-xs text-[#9A9A9A]">
          Dispatched from Karachi · Flat Rs 200 delivery nationwide · All thrift items are 1-of-1 final sale
        </p>
      </div>

    </div>
  );
}
