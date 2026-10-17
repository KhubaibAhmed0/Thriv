'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Heart,
  ShoppingBag,
  Check,
  Truck,
  Sparkles,
  AlertCircle,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';
import type { Product } from '@/types';
import { ProductImage } from '@/components/ProductImage';
import { Badge } from '@/components/ui/Badge';
import { formatPrice } from '@/lib/formatPrice';
import { useCart } from '@/components/CartProvider';
import { useWishlist } from '@/components/WishlistProvider';
import { ShopTheLook } from '@/components/ShopTheLook';
import { setCurrentProduct } from '@/lib/currentProduct';

/** One-line plain-language gloss for each grade (audit F-40). */
const CONDITION_NOTES: Record<string, string> = {
  Premium: 'no visible signs of wear.',
  Excellent: 'light natural wear; no structural flaws.',
  'Very Good': 'visible pre-loved character; no damage.',
};

interface ProductDetailClientProps {
  product: Product;
  relatedProducts: Product[];
}

export function ProductDetailClient({
  product,
  relatedProducts,
}: ProductDetailClientProps) {
  const { addItem, isInCart, announce } = useCart();
  const { isSaved, toggle } = useWishlist();
  const saved = isSaved(product.slug);
  const [selectedSize, setSelectedSize] = useState<string>(
    product.isMerch ? (product.sizes?.[0] ?? 'M') : (product.size ?? '')
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [justAdded, setJustAdded] = useState<boolean>(false);

  // Tell layout chrome (WhatsApp FAB) which piece is on screen (audit F-75).
  useEffect(() => {
    setCurrentProduct({
      name: product.name,
      brand: String(product.brand),
      size: product.size,
      condition: product.condition,
    });
    return () => setCurrentProduct(null);
  }, [product.name, product.brand, product.size, product.condition]);

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

    announce(`${product.name} added to cart`); // audit F-70
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  };

  const measurementValues = product.measurements
    ? Object.values(product.measurements).filter(Boolean)
    : [];
  const hasMeasurements = measurementValues.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted-text mb-8 overflow-x-auto no-scrollbar">
        <Link href="/" className="hover:text-black transition-colors shrink-0">
          Home
        </Link>
        <span className="shrink-0">/</span>
        <Link href="/shop" className="hover:text-black transition-colors shrink-0">
          Shop
        </Link>
        <span className="shrink-0">/</span>
        <Link
          href={`/shop?category=${product.category}`}
          className="hover:text-black transition-colors shrink-0 capitalize"
        >
          {product.category === 'jeans' ? 'Jeans' : 'Graphic Tees'}
        </Link>
        <span className="shrink-0">/</span>
        <span className="text-black font-medium truncate max-w-[200px] sm:max-w-md shrink-0">
          {product.name}
        </span>
      </nav>

      {/* Main Product Layout: 2 Columns (Image Gallery Left, Details Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        
        {/* Left Column: Image Gallery */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative bg-card rounded-[20px] p-3 sm:p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-border">
            <ProductImage
              slug={product.slug}
              brand={product.brand}
              subcategory={product.subcategory}
              imageUrl={product.images?.[0]}
              aspectRatio="4:5"
              priority
              alt={product.name}
              className="w-full rounded-[16px]"
            />

            {/* Top-Right Wishlist Button — persisted, 44px hit (F-24/F-73) */}
            <button
              type="button"
              onClick={() => toggle(product.slug)}
              aria-pressed={saved}
              aria-label={
                saved
                  ? `Remove ${product.name} from saved items`
                  : `Save ${product.name} to wishlist`
              }
              className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform duration-150 cursor-pointer"
            >
              <span className="w-10 h-10 rounded-full bg-white/95 backdrop-blur-md flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
                <Heart
                  className={[
                    'w-5 h-5 transition-colors',
                    saved
                      ? 'fill-badge-sold-text text-badge-sold-text'
                      : 'text-black stroke-[1.75]',
                  ].join(' ')}
                />
              </span>
            </button>

            {/* Top-Left Badge */}
            <div className="absolute top-6 left-6 flex flex-col gap-1.5">
              {product.isMerch ? (
                <span className="px-3 py-1 bg-black text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-sm">
                  In-House Merch
                </span>
              ) : (
                <span className="px-3 py-1 bg-white text-black text-xs font-semibold rounded-full border border-border shadow-sm">
                  One-of-One Thrift Piece
                </span>
              )}
              {isSoldOut && (
                <span className="px-3 py-1 bg-badge-sold-bg text-badge-sold-text text-xs font-bold rounded-full">
                  Sold Out
                </span>
              )}
            </div>
          </div>

          {/* Additional angles placeholder note */}
          <div className="flex items-center justify-between px-2 text-xs text-muted-text">
            <span>Authentic pre-sanitized piece</span>
            <span>Karachi Warehouse Stock</span>
          </div>
        </div>

        {/* Right Column: Product Details in Exact Required Order:
            brand → name → price → condition badge → size → measurements → description */}
        <div className="lg:col-span-5 flex flex-col justify-between">
          <div>
            
            {/* 1. Brand (small, muted) */}
            <p className="text-xs font-bold uppercase tracking-widest text-muted-text">
              {product.brand}
            </p>

            {/* 2. Name */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-black mt-1.5 leading-tight">
              {product.name}
            </h1>

            {/* 3. Price (bold) & Condition Badge (pill) */}
            <div className="mt-4 flex items-baseline gap-4">
              <span className="text-2xl sm:text-3xl font-black text-black">
                {formatPrice(product.price)}
              </span>
              <Badge variant="condition" label={product.condition} />
            </div>

            {/* 3b. Plain-language grade note + link to the full grade system (audit F-40) */}
            {!product.isMerch && CONDITION_NOTES[product.condition] && (
              <p className="text-xs text-body mt-2 leading-relaxed">
                Graded <strong>{product.condition}</strong>:{' '}
                {CONDITION_NOTES[product.condition]}{' '}
                <Link
                  href="/faq#condition-grades"
                  className="font-semibold text-black underline underline-offset-2 decoration-border hover:decoration-black transition-colors"
                >
                  What the grades mean
                </Link>
              </p>
            )}

            {/* 4. Sizing Section (Strict Domain Distinction) */}
            <div className="mt-6 pt-6 border-t border-border">
              {product.isMerch ? (
                /* Merch: Size Selector */
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-black">
                      Select Size:
                    </span>
                    <span className="text-xs text-muted-text">Heavyweight Relaxed Fit</span>
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
                            ? 'bg-black text-white shadow-sm'
                            : 'bg-white text-black border border-border hover:border-black',
                        ].join(' ')}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Thrift: One Piece Only · Size {size} */
                <div className="bg-card rounded-[14px] p-3.5 border border-border/70">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-black">
                      One Piece Only · Size {product.size}
                    </span>
                    <span className="text-[11px] font-semibold text-badge-sold-text bg-badge-sold-bg px-2 py-0.5 rounded-full">
                      Stock: {product.stock}
                    </span>
                  </div>
                  <p className="text-xs text-body mt-1">
                    Thrift inventory consists of unique 1-of-1 pieces. Once this item is ordered, there is no restock.
                  </p>
                </div>
              )}
            </div>

            {/* 5. Quantity Stepper (Merch only) or Locked Quantity (Thrift) */}
            <div className="mt-5">
              {product.isMerch && !isSoldOut ? (
                <div className="flex items-center gap-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-black">
                    Quantity:
                  </span>
                  <div className="flex items-center bg-white border border-border rounded-full px-1.5 py-0.5">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                      aria-label="Decrease quantity"
                      className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-black hover:bg-card disabled:opacity-30 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="w-10 text-center text-xs font-bold text-black">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                      disabled={quantity >= product.stock}
                      aria-label="Increase quantity"
                      className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-black hover:bg-card disabled:opacity-30 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-xs text-muted-text">
                    {product.stock} available in batch
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted-text">
                  Quantity locked to 1 for thrift piece.
                </p>
              )}
            </div>

            {/* 6. Primary Add to Cart CTA */}
            <div className="mt-6 space-y-3">
              {isSoldOut ? (
                <button
                  disabled
                  className="w-full bg-badge-sold-bg text-badge-sold-text font-bold text-sm py-4 rounded-full cursor-not-allowed text-center"
                >
                  Sold Out (No Restocks)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className={[
                    'w-full py-4 rounded-full font-bold text-sm flex items-center justify-center gap-2.5 transition-all duration-150 active:scale-[0.99] cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.12)]',
                    justAdded
                      ? 'bg-badge-promo-text text-white'
                      : alreadyInCart
                      ? 'bg-[#2a2a2a] text-white hover:bg-black'
                      : 'bg-black text-white hover:bg-black',
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
                  className="w-full py-3 rounded-full text-xs font-bold text-black bg-white border border-border hover:border-black flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Go to Checkout</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

            {/* 7. Trust Row under CTA (Disinfected, No Returns, Rs 200 Delivery) */}
            <div className="mt-6 bg-white rounded-[16px] p-4 border border-border space-y-3">
              <div className="flex items-center gap-3 text-xs text-body">
                <Sparkles className="w-4 h-4 text-black shrink-0" />
                <span>Handpicked & thoroughly disinfected before dispatch.</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-body">
                <Truck className="w-4 h-4 text-black shrink-0" />
                <span>Flat Rs 200 courier delivery nationwide across Pakistan.</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-badge-sold-text font-medium">
                <AlertCircle className="w-4 h-4 text-badge-sold-text shrink-0" />
                <span>Strictly no returns, no exchanges. Check measurements below.</span>
              </div>
            </div>

            {/* 8. Measurements Table — with empty state (F-22) + measuring guide (F-76) */}
            <div className="mt-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-black mb-2.5">
                Exact Measurements (Inches)
              </h2>
              {hasMeasurements ? (
                <div className="bg-card rounded-[14px] p-3.5 border border-border">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    {product.measurements?.waist && (
                      <div className="bg-white rounded-[8px] p-2">
                        <p className="text-[10px] text-muted-text uppercase">Waist</p>
                        <p className="text-xs font-bold text-black">{product.measurements.waist}</p>
                      </div>
                    )}
                    {product.measurements?.length && (
                      <div className="bg-white rounded-[8px] p-2">
                        <p className="text-[10px] text-muted-text uppercase">Length</p>
                        <p className="text-xs font-bold text-black">{product.measurements.length}</p>
                      </div>
                    )}
                    {product.measurements?.inseam && (
                      <div className="bg-white rounded-[8px] p-2">
                        <p className="text-[10px] text-muted-text uppercase">Inseam</p>
                        <p className="text-xs font-bold text-black">{product.measurements.inseam}</p>
                      </div>
                    )}
                    {product.measurements?.rise && (
                      <div className="bg-white rounded-[8px] p-2">
                        <p className="text-[10px] text-muted-text uppercase">Rise</p>
                        <p className="text-xs font-bold text-black">{product.measurements.rise}</p>
                      </div>
                    )}
                    {product.measurements?.chest && (
                      <div className="bg-white rounded-[8px] p-2">
                        <p className="text-[10px] text-muted-text uppercase">Chest</p>
                        <p className="text-xs font-bold text-black">{product.measurements.chest}</p>
                      </div>
                    )}
                    {product.measurements?.shoulders && (
                      <div className="bg-white rounded-[8px] p-2">
                        <p className="text-[10px] text-muted-text uppercase">Shoulders</p>
                        <p className="text-xs font-bold text-black">{product.measurements.shoulders}</p>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-text mt-2 text-center">
                    Measurements taken flat. Compare against a pair you currently own.
                  </p>

                  <details className="mt-3 border-t border-border pt-2.5 group/measure">
                    <summary className="flex items-center gap-1.5 text-[11px] font-semibold text-black cursor-pointer select-none list-none">
                      How to measure yourself
                      <ChevronDown className="w-3.5 h-3.5 transition-transform group-open/measure:rotate-180" />
                    </summary>
                    <ol className="mt-2 space-y-1.5 text-[11px] text-body leading-relaxed list-decimal list-inside">
                      <li>Lay a garment you already love flat, zip/buttons closed.</li>
                      <li>Waist: measure across the top edge, then double it.</li>
                      <li>Inseam: from the crotch seam straight down to the hem.</li>
                      <li>Trust the tape over the label — thrift sizing varies between brands and years.</li>
                    </ol>
                  </details>
                </div>
              ) : (
                <div className="bg-white rounded-[14px] p-4 border border-border">
                  <p className="text-xs text-body leading-relaxed">
                    Exact measurements for this piece are not published yet. Message
                    us and we will measure it for you before you order — all sales
                    are final.
                  </p>
                  <a
                    href={`https://wa.me/923248188616?text=${encodeURIComponent(
                      `Hi Thriv! Can you share measurements for ${product.brand} — ${product.name}?`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 min-h-11 mt-3 text-xs font-bold text-black underline underline-offset-4 decoration-border hover:decoration-black transition-colors"
                  >
                    Ask on WhatsApp
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            {/* 9. Description Copy */}
            <div className="mt-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-black mb-2">
                Item Description
              </h2>
              <p className="text-sm text-body leading-relaxed">
                {product.description}
              </p>
            </div>

          </div>
        </div>

      </div>

      {/* ── Related Items / Shop The Look Module ── */}
      <div className="mt-20 pt-12 border-t border-border">
        <ShopTheLook
          title={`Complete The Fit with ${product.brand}`}
          items={relatedProducts}
        />
      </div>

    </div>
  );
}
