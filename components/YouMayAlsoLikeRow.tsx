'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Product } from '@/types';
import { ProductCard } from '@/components/ProductCard';

interface YouMayAlsoLikeRowProps {
  products: Product[];
}

export function YouMayAlsoLikeRow({ products }: YouMayAlsoLikeRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -280, behavior: 'smooth' });
  };

  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: 280, behavior: 'smooth' });
  };

  // Show a curated selection: mix of thrift and merch, in-stock
  const suggestions = products
    .filter((p) => p.stock > 0)
    .slice(4, 14);

  return (
    <div className="relative group/row">
      {/* Left Arrow */}
      <button
        type="button"
        onClick={scrollLeft}
        aria-label="Scroll left"
        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border border-[#E2E0DC] shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex items-center justify-center hover:border-[#111111] transition-all opacity-0 group-hover/row:opacity-100 focus:opacity-100 cursor-pointer"
      >
        <ChevronLeft className="w-4 h-4 text-[#111111] stroke-[2]" />
      </button>

      {/* Scrollable Row */}
      <div
        ref={scrollRef}
        className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar px-4 sm:px-6 lg:px-8 pb-2"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {suggestions.map((product, idx) => (
          <div
            key={product.id}
            className="shrink-0 w-[200px] sm:w-[240px]"
            style={{ scrollSnapAlign: 'start' }}
          >
            <ProductCard product={product} priority={idx < 3} />
          </div>
        ))}

        {/* View All trailing card */}
        <div className="shrink-0 w-[160px] sm:w-[180px] flex items-center justify-center" style={{ scrollSnapAlign: 'start' }}>
          <Link
            href="/shop"
            className="flex flex-col items-center justify-center gap-3 bg-[#EDEBE8] rounded-[16px] w-full h-full min-h-[260px] border border-[#E2E0DC] hover:border-[#111111] transition-colors p-4 text-center"
          >
            <div className="w-10 h-10 rounded-full bg-[#111111] flex items-center justify-center">
              <ChevronRight className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#111111]">View All</p>
              <p className="text-[10px] text-[#9A9A9A] mt-0.5">Full Collection</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Right Arrow */}
      <button
        type="button"
        onClick={scrollRight}
        aria-label="Scroll right"
        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border border-[#E2E0DC] shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex items-center justify-center hover:border-[#111111] transition-all opacity-0 group-hover/row:opacity-100 focus:opacity-100 cursor-pointer"
      >
        <ChevronRight className="w-4 h-4 text-[#111111] stroke-[2]" />
      </button>
    </div>
  );
}
