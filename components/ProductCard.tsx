'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Heart, Check } from 'lucide-react';
import type { Product } from '@/types';
import { ProductImage } from '@/components/ProductImage';
import { Badge } from '@/components/ui/Badge';
import { formatPrice } from '@/lib/formatPrice';
import { useCart } from '@/components/CartProvider';

interface ProductCardProps {
  product: Product;
  priority?: boolean;
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const { addItem, isInCart } = useCart();
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isAddedRecently, setIsAddedRecently] = useState(false);

  const isSoldOut = product.stock <= 0;
  const inCart = isInCart(product.id, product.isMerch ? 'L' : undefined);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isSoldOut) return;

    // For merch, default to 'L' if quick-added from card, full size picker on PDP
    const defaultSize = product.isMerch ? 'L' : (product.size ?? undefined);
    addItem(product, defaultSize);

    setIsAddedRecently(true);
    setTimeout(() => setIsAddedRecently(false), 1200);
  };

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsWishlisted(!isWishlisted);
  };

  return (
    <div
      className={[
        'group relative bg-[#EDEBE8] rounded-[16px] p-3 transition-all duration-200',
        'hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] flex flex-col justify-between',
        isSoldOut ? 'opacity-80' : '',
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

        {/* Wishlist Heart Button top-right */}
        <button
          type="button"
          onClick={handleWishlistToggle}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className={[
            'absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/95 backdrop-blur-sm',
            'flex items-center justify-center shadow-[0_1px_4px_rgba(0,0,0,0.1)]',
            'hover:scale-110 active:scale-95 transition-all duration-150 z-10 cursor-pointer',
          ].join(' ')}
        >
          <Heart
            className={[
              'w-4 h-4 transition-colors',
              isWishlisted
                ? 'fill-[#8B2020] text-[#8B2020]'
                : 'text-[#111111] stroke-[1.75]',
            ].join(' ')}
          />
        </button>

        {/* Top-Left Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 z-10">
          {product.isMerch ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-[#111111] text-white">
              IN-HOUSE MERCH
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/90 backdrop-blur-sm text-[#111111] border border-[#E2E0DC]/60">
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
          <div className="flex items-center justify-between gap-2 text-xs text-[#9A9A9A]">
            <span className="font-semibold uppercase tracking-wider text-[11px] text-[#444444]">
              {product.brand}
            </span>
            <span>
              {product.isMerch ? 'Multi-size' : `Size ${product.size}`}
            </span>
          </div>

          {/* Product Title */}
          <Link href={`/product/${product.slug}`} className="block mt-1">
            <h3 className="text-sm font-semibold text-[#111111] leading-snug line-clamp-1 group-hover:text-black transition-colors">
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
        <div className="mt-3 pt-2 border-t border-[#E2E0DC]/60 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-[#111111]">
              {formatPrice(product.price)}
            </p>
          </div>

          {isSoldOut ? (
            <button
              disabled
              className="bg-[#F5E6E6] text-[#8B2020] text-xs font-semibold px-3 py-1.5 rounded-full cursor-not-allowed"
            >
              Sold Out
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAddToCart}
              className={[
                'inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-full transition-all duration-150 active:scale-95 cursor-pointer',
                isAddedRecently
                  ? 'bg-[#3A6B35] text-white shadow-sm'
                  : inCart
                  ? 'bg-[#2a2a2a] text-white'
                  : 'bg-[#111111] text-white hover:bg-[#2a2a2a] shadow-[0_1px_4px_rgba(0,0,0,0.12)]',
              ].join(' ')}
              aria-label={`Add ${product.name} to cart`}
            >
              {isAddedRecently ? (
                <>
                  <Check className="w-3 h-3 stroke-[2.5]" />
                  <span>Added</span>
                </>
              ) : inCart ? (
                <span>In Cart</span>
              ) : (
                <span>Add To Cart</span>
              )}
            </button>
          )}
        </div>

        {/* Decorative Trust Dot Pattern (matches reference Best Seller pattern) */}
        <div className="flex items-center gap-1.5 mt-2.5 pt-1.5">
          <span className="text-[10px] text-[#9A9A9A] font-medium">
            {product.isMerch ? 'Heavyweight 240 GSM' : 'Disinfected & Handpicked'}
          </span>
          <div className="flex gap-0.5 ml-auto" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((dot) => (
              <div
                key={dot}
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor: dot <= 4 ? '#111111' : '#D0CDC7',
                }}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
