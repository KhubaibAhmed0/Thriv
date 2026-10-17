'use client';

import React from 'react';
import Link from 'next/link';
import { Heart, Check } from 'lucide-react';
import type { Product } from '@/types';
import { ProductImage } from '@/components/ProductImage';
import { Badge } from '@/components/ui/Badge';
import { formatPrice } from '@/lib/formatPrice';
import { useQuickAdd } from '@/lib/useQuickAdd';
import { useWishlist } from '@/components/WishlistProvider';

interface ProductCardProps {
  product: Product;
  priority?: boolean;
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const { isSaved, toggle } = useWishlist();
  const saved = isSaved(product.slug);

  // Size-aware quick add (audit F-20): multi-size merch opens an inline size
  // picker instead of silently adding a hardcoded size.
  const { sizes, needsSizeChoice, showSizePicker, justAdded, inCart, trigger, pickSize } =
    useQuickAdd(product);

  const isSoldOut = product.stock <= 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    trigger();
  };

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(product.slug);
  };

  return (
    <div
      className={[
        'group relative bg-card rounded-[16px] p-3 transition-all duration-200',
        'hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] flex flex-col justify-between',
        // No whole-card opacity for sold-out pieces: blending every label at
        // 80% dropped all card text below 4.5:1 (Lighthouse color-contrast).
        // The SOLD badge + disabled button carry the state instead.
      ].join(' ')}
    >
      {/* Top Image Container */}
      <Link href={`/product/${product.slug}`} className="block relative">
        <ProductImage
          slug={product.slug}
          brand={product.brand}
          subcategory={product.subcategory}
          imageUrl={product.images?.[0]}
          aspectRatio="4:5"
          priority={priority}
          alt={product.name}
          className="transition-transform duration-300 group-hover:scale-[1.01]"
        />

        {/* Wishlist Heart Button top-right — 44px hit area (audit F-73) */}
        <button
          type="button"
          onClick={handleWishlistToggle}
          aria-pressed={saved}
          aria-label={
            saved
              ? `Remove ${product.name} from saved items`
              : `Save ${product.name} to wishlist`
          }
          className="absolute top-1.5 right-1.5 w-11 h-11 z-10 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform duration-150 cursor-pointer"
        >
          <span className="w-8 h-8 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-[0_1px_4px_rgba(0,0,0,0.1)]">
            <Heart
              className={[
                'w-4 h-4 transition-colors',
                saved
                  ? 'fill-badge-sold-text text-badge-sold-text'
                  : 'text-black stroke-[1.75]',
              ].join(' ')}
            />
          </span>
        </button>

        {/* Top-Left Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 z-10">
          {product.isMerch ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-black text-white">
              IN-HOUSE MERCH
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/90 backdrop-blur-sm text-black border border-border/60">
              1 OF 1 THRIFT
            </span>
          )}
          {product.isFeatured && (
            <Badge variant="promo" label="Featured Drop" />
          )}
        </div>
      </Link>

      {/* Card Body Details */}
      <div className="mt-3 px-1 flex flex-col flex-1 justify-between">
        <div>
          {/* Brand & Category Label */}
          <div className="flex items-center justify-between gap-2 text-xs text-muted-text">
            <span className="font-semibold uppercase tracking-wider text-[11px] text-body">
              {product.brand}
            </span>
            <span>
              {product.isMerch ? 'Multi-size' : `Size ${product.size}`}
            </span>
          </div>

          {/* Product Title */}
          <Link href={`/product/${product.slug}`} className="block mt-1">
            <h3 className="text-sm font-semibold text-black leading-snug line-clamp-1 group-hover:text-black transition-colors">
              {product.name}
            </h3>
          </Link>
        </div>

        {/* Condition Grade + Color Swatches */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <Badge variant="condition" label={product.condition} />

          {/* Color swatches if present */}
          {product.colors && product.colors.length > 0 && (
            <div className="flex items-center gap-1">
              {product.colors.map((color, i) => (
                <span
                  key={i}
                  className="w-2.5 h-2.5 rounded-full border border-black/10"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          )}
        </div>

        {/* Price & Action Row */}
        <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-black">
              {formatPrice(product.price)}
            </p>
          </div>

          {isSoldOut ? (
            <button
              disabled
              className="bg-badge-sold-bg text-badge-sold-text text-xs font-semibold px-3 py-1.5 rounded-full cursor-not-allowed"
            >
              Sold Out
            </button>
          ) : needsSizeChoice && showSizePicker ? (
            <div
              className="flex items-center gap-1"
              role="group"
              aria-label={`Choose a size for ${product.name}`}
            >
              {sizes.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    pickSize(sz);
                  }}
                  className="min-w-7 h-7 px-2 rounded-full text-[11px] font-bold bg-white text-black border border-border hover:border-black transition-colors cursor-pointer"
                >
                  {sz}
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleAddToCart}
              className={[
                'inline-flex items-center gap-1.5 text-xs font-medium px-4 min-h-11 rounded-full transition-all duration-150 active:scale-95 cursor-pointer',
                justAdded
                  ? 'bg-badge-promo-text text-white shadow-sm'
                  : inCart
                  ? 'bg-[#2a2a2a] text-white'
                  : 'bg-black text-white hover:bg-[#2a2a2a] shadow-[0_1px_4px_rgba(0,0,0,0.12)]',
              ].join(' ')}
            >
              {justAdded ? (
                <>
                  <Check className="w-3 h-3 stroke-[2.5]" />
                  <span>Added</span>
                </>
              ) : inCart ? (
                <span>In Cart</span>
              ) : (
                <span>Add To Cart</span>
              )}
              <span className="sr-only"> — {product.name}</span>
            </button>
          )}
        </div>

        {/* Trust fact — the old fake 4.5-star dot row was removed (audit F-72) */}
        <div className="mt-2.5 pt-1.5">
          <span className="text-[10px] text-muted-text font-medium">
            {product.isMerch ? 'Heavyweight 240 GSM' : 'Disinfected & Handpicked'}
          </span>
        </div>

      </div>
    </div>
  );
}
