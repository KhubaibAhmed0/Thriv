'use client';

import React from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import type { Product } from '@/types';
import { ProductImage } from '@/components/ProductImage';
import { Badge } from '@/components/ui/Badge';
import { formatPrice } from '@/lib/formatPrice';
import { useQuickAdd } from '@/lib/useQuickAdd';

interface ShopTheLookProps {
  title?: string;
  items: Product[];
}

/**
 * "Pairs well with" module for the PDP. The previous version faked a look
 * navigation (dead arrows) and hard-coded a specific outfit onto every
 * product page — audit F-23. Copy is now derived from the actual items and
 * the fake multi-look arrows are gone.
 */
export function ShopTheLook({ title = 'Pairs Well With', items }: ShopTheLookProps) {
  if (items.length === 0) {
    return null;
  }

  const brands = Array.from(new Set(items.map((item) => String(item.brand)))).slice(0, 3);

  return (
    <section className="my-12 sm:my-16">
      <div className="bg-card rounded-[20px] p-4 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">

          {/* Left: honest pairing panel derived from the real items */}
          <div className="lg:col-span-6 relative">
            <div className="relative rounded-[16px] overflow-hidden aspect-[4/5] flex items-center justify-center">
              <div className="w-full h-full p-8 flex flex-col justify-between bg-gradient-to-br from-[#374151] via-[#1F2937] to-[#111827] text-white">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold uppercase tracking-widest px-3 py-1 bg-white/20 backdrop-blur-md rounded-full">
                    Style Pairing
                  </span>
                  <span className="text-xs text-white/70">Thriv · Karachi</span>
                </div>

                <div>
                  <p className="text-2xl sm:text-3xl font-bold leading-tight">
                    {items.length} one-of-one {items.length === 1 ? 'piece' : 'pieces'} from the same drop
                  </p>
                  <p className="text-sm text-white/75 mt-2 max-w-sm">
                    Handpicked from {brands.join(' · ')} — disinfected and shipped
                    nationwide from Karachi.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: items that pair with the current product */}
          <div className="lg:col-span-6">
            <h2 className="text-xl sm:text-2xl font-bold text-black mb-6">
              {title}
            </h2>

            <div className="space-y-4">
              {items.slice(0, 3).map((item) => (
                <LookItem key={item.id} item={item} />
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

/**
 * One row in the pairing list. Extracted so each row can use the quick-add
 * hook with its own size-picker state (audit F-20).
 */
function LookItem({ item }: { item: Product }) {
  const { sizes, needsSizeChoice, showSizePicker, justAdded, inCart, trigger, pickSize } =
    useQuickAdd(item);

  const isSold = item.stock <= 0;

  return (
    <div className="bg-white rounded-[16px] p-3.5 sm:p-4 border border-border flex items-center justify-between gap-4 shadow-sm hover:border-black transition-colors">
      {/* Thumbnail */}
      <Link
        href={`/product/${item.slug}`}
        className="w-16 h-20 sm:w-20 sm:h-24 rounded-[12px] overflow-hidden shrink-0 bg-page relative"
      >
        <ProductImage
          slug={item.slug}
          brand={item.brand}
          subcategory={item.subcategory}
          imageUrl={item.images?.[0]}
          aspectRatio="4:5"
          alt={item.name}
          sizes="80px"
        />
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-text">
            {item.brand}
          </span>
          <Badge variant="condition" label={item.condition} />
        </div>

        <Link href={`/product/${item.slug}`} className="block mt-0.5">
          <p className="text-sm font-semibold text-black truncate hover:underline">
            {item.name}
          </p>
        </Link>

        <p className="text-xs text-muted-text mt-0.5">
          {item.isMerch ? 'Multi-size Merch' : `One-of-one · Size ${item.size}`}
        </p>
      </div>

      {/* Price & Action */}
      <div className="text-right flex flex-col items-end gap-2 shrink-0">
        <span className="text-sm sm:text-base font-bold text-black">
          {formatPrice(item.price)}
        </span>

        {isSold ? (
          <span className="text-[11px] font-medium text-badge-sold-text bg-badge-sold-bg px-3 py-1 rounded-full">
            Sold
          </span>
        ) : needsSizeChoice && showSizePicker ? (
          <div
            className="flex flex-wrap justify-end gap-1 max-w-[150px]"
            role="group"
            aria-label={`Choose a size for ${item.name}`}
          >
            {sizes.map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => pickSize(sz)}
                className="min-w-8 h-8 px-1.5 rounded-full text-[10px] font-bold bg-white text-black border border-border hover:border-black transition-colors cursor-pointer"
              >
                {sz}
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={trigger}
            className={[
              'text-xs font-medium px-4 min-h-11 rounded-full transition-all duration-150 active:scale-95 cursor-pointer',
              justAdded
                ? 'bg-badge-promo-text text-white'
                : inCart
                ? 'bg-[#2a2a2a] text-white'
                : 'bg-black text-white hover:bg-[#2a2a2a]',
            ].join(' ')}
          >
            {justAdded ? (
              <span className="flex items-center gap-1">
                <Check className="w-3 h-3" /> Added
              </span>
            ) : inCart ? (
              'In Cart'
            ) : (
              'Add To Cart'
            )}
            <span className="sr-only"> — {item.name}</span>
          </button>
        )}
      </div>
    </div>
  );
}
