'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import type { Product } from '@/types';
import { ProductImage } from '@/components/ProductImage';
import { Badge } from '@/components/ui/Badge';
import { formatPrice } from '@/lib/formatPrice';
import { useCart } from '@/components/CartProvider';

interface ShopTheLookProps {
  title?: string;
  items: Product[];
}

export function ShopTheLook({ title = 'Item In This Look', items }: ShopTheLookProps) {
  const { addItem, isInCart } = useCart();
  const [addedSlug, setAddedSlug] = useState<string | null>(null);

  const handleAdd = (product: Product) => {
    if (product.stock <= 0) return;
    const defaultSize = product.isMerch ? 'L' : (product.size ?? undefined);
    addItem(product, defaultSize);
    setAddedSlug(product.slug);
    setTimeout(() => setAddedSlug(null), 1200);
  };

  return (
    <section className="my-12 sm:my-16">
      <div className="bg-[#EDEBE8] rounded-[20px] p-4 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left: Lifestyle Photo Container with Look Navigation */}
          <div className="lg:col-span-6 relative">
            <div className="relative rounded-[16px] overflow-hidden bg-[#E2DFD9] aspect-[4/5] flex items-center justify-center">
              {/* Deterministic lifestyle placeholder */}
              <div className="w-full h-full p-8 flex flex-col justify-between bg-gradient-to-br from-[#374151] via-[#1F2937] to-[#111827] text-white">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold uppercase tracking-widest px-3 py-1 bg-white/20 backdrop-blur-md rounded-full">
                    Look 01 · Streetwear
                  </span>
                  <span className="text-xs text-white/70">Karachi Street Style</span>
                </div>

                <div>
                  <h4 className="text-2xl sm:text-3xl font-bold leading-tight">
                    Baggy Denim & Heavyweight Graphic Tee
                  </h4>
                  <p className="text-sm text-white/75 mt-2 max-w-sm">
                    Handpicked Zara 1-of-1 vintage wash paired with in-house Akira screenprint.
                  </p>
                </div>
              </div>

              {/* Navigation Arrows like reference */}
              <button
                type="button"
                aria-label="Previous look"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Next look"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right: Items in this look list */}
          <div className="lg:col-span-6">
            <h3 className="text-xl sm:text-2xl font-bold text-[#111111] mb-6">
              {title}
            </h3>

            <div className="space-y-4">
              {items.slice(0, 3).map((item) => {
                const inCart = isInCart(item.id, item.isMerch ? 'L' : undefined);
                const isJustAdded = addedSlug === item.slug;
                const isSold = item.stock <= 0;

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-[16px] p-3.5 sm:p-4 border border-[#E2E0DC] flex items-center justify-between gap-4 shadow-sm hover:border-[#111111] transition-colors"
                  >
                    {/* Thumbnail */}
                    <Link
                      href={`/product/${item.slug}`}
                      className="w-16 h-20 sm:w-20 sm:h-24 rounded-[12px] overflow-hidden shrink-0 bg-[#F5F3F0] relative"
                    >
                      <ProductImage
                        slug={item.slug}
                        brand={item.brand}
                        subcategory={item.subcategory}
                        aspectRatio="4:5"
                        alt={item.name}
                      />
                    </Link>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#9A9A9A]">
                          {item.brand}
                        </span>
                        <Badge variant="condition" label={item.condition} />
                      </div>

                      <Link href={`/product/${item.slug}`} className="block mt-0.5">
                        <p className="text-sm font-semibold text-[#111111] truncate hover:underline">
                          {item.name}
                        </p>
                      </Link>

                      <p className="text-xs text-[#9A9A9A] mt-0.5">
                        {item.isMerch ? 'Multi-size Merch' : `One-of-one · Size ${item.size}`}
                      </p>

                      {/* Dot Rating Pattern */}
                      <div className="flex items-center gap-1 mt-1.5" aria-hidden="true">
                        <span className="text-[10px] text-[#9A9A9A]">Curated</span>
                        <div className="flex gap-0.5 ml-1">
                          {[1, 2, 3, 4, 5].map((d) => (
                            <div
                              key={d}
                              className="w-1 h-1 rounded-full"
                              style={{ backgroundColor: d <= 4 ? '#111111' : '#E2E0DC' }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Price & Action */}
                    <div className="text-right flex flex-col items-end gap-2 shrink-0">
                      <span className="text-sm sm:text-base font-bold text-[#111111]">
                        {formatPrice(item.price)}
                      </span>

                      {isSold ? (
                        <span className="text-[11px] font-medium text-[#8B2020] bg-[#F5E6E6] px-3 py-1 rounded-full">
                          Sold
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAdd(item)}
                          className={[
                            'text-xs font-medium px-3.5 py-1.5 rounded-full transition-all duration-150 active:scale-95 cursor-pointer',
                            isJustAdded
                              ? 'bg-[#3A6B35] text-white'
                              : inCart
                              ? 'bg-[#2a2a2a] text-white'
                              : 'bg-[#111111] text-white hover:bg-[#2a2a2a]',
                          ].join(' ')}
                        >
                          {isJustAdded ? (
                            <span className="flex items-center gap-1">
                              <Check className="w-3 h-3" /> Added
                            </span>
                          ) : inCart ? (
                            'In Cart'
                          ) : (
                            'Add To Cart'
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
