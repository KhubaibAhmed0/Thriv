'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Heart,
  ShoppingBag,
  Check,
  ShieldCheck,
  Truck,
  Sparkles,
  AlertCircle,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import type { Product } from '@/types';
import { ProductImage } from '@/components/ProductImage';
import { Badge } from '@/components/ui/Badge';
import { formatPrice } from '@/lib/formatPrice';
import { useCart } from '@/components/CartProvider';
import { ShopTheLook } from '@/components/ShopTheLook';

interface ProductDetailClientProps {
  product: Product;
  relatedProducts: Product[];
}

export function ProductDetailClient({
  product,
  relatedProducts,
}: ProductDetailClientProps) {
  const { addItem, isInCart } = useCart();
  const [selectedSize, setSelectedSize] = useState<string>(
    product.isMerch ? (product.sizes?.[0] ?? 'M') : (product.size ?? '')
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [isWishlisted, setIsWishlisted] = useState<boolean>(false);
  const [justAdded, setJustAdded] = useState<boolean>(false);

  const isSoldOut = product.stock <= 0;
  const alreadyInCart = isInCart(
    product.id,
    product.isMerch ? selectedSize : undefined
  );

  const handleAddToCart = () => {
    if (isSoldOut) return;

    if (product.isMerch) {
      // For merch, add item with selected size and quantity
      for (let i = 0; i < quantity; i++) {
        addItem(product, selectedSize);
      }
    } else {
      // For thrift, locked to single quantity 1
      addItem(product, product.size ?? undefined);
    }

    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[#9A9A9A] mb-8 overflow-x-auto no-scrollbar">
        <Link href="/" className="hover:text-[#111111] transition-colors shrink-0">
          Home
        </Link>
        <span className="shrink-0">/</span>
        <Link href="/shop" className="hover:text-[#111111] transition-colors shrink-0">
          Shop
        </Link>
        <span className="shrink-0">/</span>
        <Link
          href={`/shop?category=${product.category}`}
          className="hover:text-[#111111] transition-colors shrink-0 capitalize"
        >
          {product.category === 'jeans' ? 'Jeans' : 'Graphic Tees'}
        </Link>
        <span className="shrink-0">/</span>
        <span className="text-[#111111] font-medium truncate max-w-[200px] sm:max-w-md shrink-0">
          {product.name}
        </span>
      </nav>

      {/* Main Product Layout: 2 Columns (Image Gallery Left, Details Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        
        {/* Left Column: Image Gallery */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative bg-[#EDEBE8] rounded-[20px] p-3 sm:p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-[#E2E0DC]">
            <ProductImage
              slug={product.slug}
              brand={product.brand}
              subcategory={product.subcategory}
              aspectRatio="4:5"
              priority
              alt={product.name}
              className="w-full rounded-[16px]"
            />

            {/* Top-Right Wishlist Button */}
            <button
              type="button"
              onClick={() => setIsWishlisted(!isWishlisted)}
              aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/95 backdrop-blur-md flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.12)] hover:scale-110 active:scale-95 transition-all duration-150 cursor-pointer"
            >
              <Heart
                className={[
                  'w-5 h-5 transition-colors',
                  isWishlisted
                    ? 'fill-[#8B2020] text-[#8B2020]'
                    : 'text-[#111111] stroke-[1.75]',
                ].join(' ')}
              />
            </button>

            {/* Top-Left Badge */}
            <div className="absolute top-6 left-6 flex flex-col gap-1.5">
              {product.isMerch ? (
                <span className="px-3 py-1 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-sm">
                  In-House Merch
                </span>
              ) : (
                <span className="px-3 py-1 bg-white text-[#111111] text-xs font-semibold rounded-full border border-[#E2E0DC] shadow-sm">
                  One-of-One Thrift Piece
                </span>
              )}
              {isSoldOut && (
                <span className="px-3 py-1 bg-[#F5E6E6] text-[#8B2020] text-xs font-bold rounded-full">
                  Sold Out
                </span>
              )}
            </div>
          </div>

          {/* Additional angles placeholder note */}
          <div className="flex items-center justify-between px-2 text-xs text-[#9A9A9A]">
            <span>Authentic pre-sanitized piece</span>
            <span>Karachi Warehouse Stock</span>
          </div>
        </div>

        {/* Right Column: Product Details in Exact Required Order:
            brand → name → price → condition badge → size → measurements → description */}
        <div className="lg:col-span-5 flex flex-col justify-between">
          <div>
            
            {/* 1. Brand (small, muted) */}
            <p className="text-xs font-bold uppercase tracking-widest text-[#9A9A9A]">
              {product.brand}
            </p>

            {/* 2. Name */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111111] mt-1.5 leading-tight">
              {product.name}
            </h1>

            {/* 3. Price (bold) & Condition Badge (pill) */}
            <div className="mt-4 flex items-baseline gap-4">
              <span className="text-2xl sm:text-3xl font-black text-[#111111]">
                {formatPrice(product.price)}
              </span>
              <Badge variant="condition" label={product.condition} />
            </div>

            {/* 4. Sizing Section (Strict Domain Distinction) */}
            <div className="mt-6 pt-6 border-t border-[#E2E0DC]">
              {product.isMerch ? (
                /* Merch: Size Selector */
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#111111]">
                      Select Size:
                    </span>
                    <span className="text-xs text-[#9A9A9A]">Heavyweight Relaxed Fit</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {product.sizes?.map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setSelectedSize(sz)}
                        className={[
                          'w-12 h-11 rounded-full text-xs font-bold transition-all duration-150 cursor-pointer',
                          selectedSize === sz
                            ? 'bg-[#111111] text-white shadow-sm'
                            : 'bg-white text-[#111111] border border-[#E2E0DC] hover:border-[#111111]',
                        ].join(' ')}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Thrift: One Piece Only · Size {size} */
                <div className="bg-[#EDEBE8] rounded-[14px] p-3.5 border border-[#E2E0DC]/70">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#111111]">
                      One Piece Only · Size {product.size}
                    </span>
                    <span className="text-[11px] font-semibold text-[#8B2020] bg-[#F5E6E6] px-2 py-0.5 rounded-full">
                      Stock: {product.stock}
                    </span>
                  </div>
                  <p className="text-xs text-[#444444] mt-1">
                    Thrift inventory consists of unique 1-of-1 pieces. Once this item is ordered, there is no restock.
                  </p>
                </div>
              )}
            </div>

            {/* 5. Quantity Stepper (Merch only) or Locked Quantity (Thrift) */}
            <div className="mt-5">
              {product.isMerch && !isSoldOut ? (
                <div className="flex items-center gap-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#111111]">
                    Quantity:
                  </span>
                  <div className="flex items-center bg-white border border-[#E2E0DC] rounded-full px-2 py-1">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-[#111111] hover:bg-[#EDEBE8] disabled:opacity-30 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-xs font-bold text-[#111111]">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                      disabled={quantity >= product.stock}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-[#111111] hover:bg-[#EDEBE8] disabled:opacity-30 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-xs text-[#9A9A9A]">
                    {product.stock} available in batch
                  </span>
                </div>
              ) : (
                <p className="text-xs text-[#9A9A9A]">
                  Quantity locked to 1 for thrift piece.
                </p>
              )}
            </div>

            {/* 6. Primary Add to Cart CTA */}
            <div className="mt-6 space-y-3">
              {isSoldOut ? (
                <button
                  disabled
                  className="w-full bg-[#F5E6E6] text-[#8B2020] font-bold text-sm py-4 rounded-full cursor-not-allowed text-center"
                >
                  Sold Out — No Restocks
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className={[
                    'w-full py-4 rounded-full font-bold text-sm flex items-center justify-center gap-2.5 transition-all duration-150 active:scale-[0.99] cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.12)]',
                    justAdded
                      ? 'bg-[#3A6B35] text-white'
                      : alreadyInCart
                      ? 'bg-[#2a2a2a] text-white hover:bg-black'
                      : 'bg-[#111111] text-white hover:bg-black',
                  ].join(' ')}
                >
                  {justAdded ? (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Added to Bag</span>
                    </>
                  ) : alreadyInCart ? (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      <span>In Bag (Add Another)</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      <span>Add To Cart · {formatPrice(product.price * (product.isMerch ? quantity : 1))}</span>
                    </>
                  )}
                </button>
              )}

              {alreadyInCart && (
                <Link
                  href="/cart"
                  className="w-full py-3 rounded-full text-xs font-bold text-[#111111] bg-white border border-[#E2E0DC] hover:border-[#111111] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Go to Checkout</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

            {/* 7. Trust Row under CTA (Disinfected, No Returns, Rs 200 Delivery) */}
            <div className="mt-6 bg-white rounded-[16px] p-4 border border-[#E2E0DC] space-y-3">
              <div className="flex items-center gap-3 text-xs text-[#444444]">
                <Sparkles className="w-4 h-4 text-[#111111] shrink-0" />
                <span>Handpicked & thoroughly disinfected before dispatch.</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-[#444444]">
                <Truck className="w-4 h-4 text-[#111111] shrink-0" />
                <span>Flat Rs 200 courier delivery nationwide across Pakistan.</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-[#8B2020] font-medium">
                <AlertCircle className="w-4 h-4 text-[#8B2020] shrink-0" />
                <span>Strictly no returns, no exchanges. Check measurements below.</span>
              </div>
            </div>

            {/* 8. Measurements Table */}
            {product.measurements && (
              <div className="mt-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111] mb-2.5">
                  Exact Measurements (Inches)
                </h3>
                <div className="bg-[#EDEBE8] rounded-[14px] p-3.5 border border-[#E2E0DC]">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    {product.measurements.waist && (
                      <div className="bg-white rounded-[8px] p-2">
                        <p className="text-[10px] text-[#9A9A9A] uppercase">Waist</p>
                        <p className="text-xs font-bold text-[#111111]">{product.measurements.waist}</p>
                      </div>
                    )}
                    {product.measurements.length && (
                      <div className="bg-white rounded-[8px] p-2">
                        <p className="text-[10px] text-[#9A9A9A] uppercase">Length</p>
                        <p className="text-xs font-bold text-[#111111]">{product.measurements.length}</p>
                      </div>
                    )}
                    {product.measurements.inseam && (
                      <div className="bg-white rounded-[8px] p-2">
                        <p className="text-[10px] text-[#9A9A9A] uppercase">Inseam</p>
                        <p className="text-xs font-bold text-[#111111]">{product.measurements.inseam}</p>
                      </div>
                    )}
                    {product.measurements.rise && (
                      <div className="bg-white rounded-[8px] p-2">
                        <p className="text-[10px] text-[#9A9A9A] uppercase">Rise</p>
                        <p className="text-xs font-bold text-[#111111]">{product.measurements.rise}</p>
                      </div>
                    )}
                    {product.measurements.chest && (
                      <div className="bg-white rounded-[8px] p-2">
                        <p className="text-[10px] text-[#9A9A9A] uppercase">Chest</p>
                        <p className="text-xs font-bold text-[#111111]">{product.measurements.chest}</p>
                      </div>
                    )}
                    {product.measurements.shoulders && (
                      <div className="bg-white rounded-[8px] p-2">
                        <p className="text-[10px] text-[#9A9A9A] uppercase">Shoulders</p>
                        <p className="text-xs font-bold text-[#111111]">{product.measurements.shoulders}</p>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-[#9A9A9A] mt-2 text-center">
                    Measurements taken flat. Compare against a pair you currently own.
                  </p>
                </div>
              </div>
            )}

            {/* 9. Description Copy */}
            <div className="mt-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111] mb-2">
                Item Description
              </h3>
              <p className="text-sm text-[#444444] leading-relaxed">
                {product.description}
              </p>
            </div>

          </div>
        </div>

      </div>

      {/* ── Related Items / Shop The Look Module ── */}
      <div className="mt-20 pt-12 border-t border-[#E2E0DC]">
        <ShopTheLook
          title={`Complete The Fit with ${product.brand}`}
          items={relatedProducts}
        />
      </div>

    </div>
  );
}
