'use client';

import React from 'react';
import Link from 'next/link';
import { Trash2, ShoppingBag, ArrowRight, Shield } from 'lucide-react';
import { useCart } from '@/components/CartProvider';
import { ProductImage } from '@/components/ProductImage';
import { Badge } from '@/components/ui/Badge';
import { formatPrice } from '@/lib/formatPrice';

export function CartPageClient() {
  const { cart, removeItem, updateQuantity, subtotal, deliveryFee, total } = useCart();
  const { items } = cart;

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-[#EDEBE8] border border-[#E2E0DC] flex items-center justify-center mx-auto mb-6">
          <ShoppingBag className="w-7 h-7 text-[#9A9A9A] stroke-[1.5]" />
        </div>
        <h1 className="text-2xl font-extrabold text-[#111111] mb-2">Your cart is empty</h1>
        <p className="text-sm text-[#444444] leading-relaxed mb-8">
          You haven&apos;t added anything yet. Browse one-of-one branded denim and in-house anime tees below.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/shop?category=jeans"
            className="inline-flex items-center gap-2 bg-[#111111] text-white font-bold text-sm px-6 py-3 rounded-full hover:bg-black transition-colors"
          >
            Browse Jeans <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/shop?category=graphic-tees"
            className="inline-flex items-center gap-2 bg-white text-[#111111] border border-[#E2E0DC] hover:border-[#111111] font-semibold text-sm px-6 py-3 rounded-full transition-colors"
          >
            Browse Graphic Tees
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-[#9A9A9A] mb-8">
        <Link href="/" className="hover:text-[#111111] transition-colors">Home</Link>
        <span>/</span>
        <span className="text-[#111111] font-medium">Cart</span>
      </nav>

      <h1 className="text-3xl sm:text-4xl font-extrabold text-[#111111] tracking-tight mb-8">
        Your Cart <span className="text-[#9A9A9A] font-light text-2xl ml-2">({items.length} {items.length === 1 ? 'item' : 'items'})</span>
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* ── Left: Cart Line Items ── */}
        <div className="lg:col-span-7 space-y-3">
          {items.map((item) => {
            const isSoldOut = item.product.stock <= 0;
            const isThrift = !item.product.isMerch;

            return (
              <div
                key={`${item.product.id}-${item.selectedSize}`}
                className="bg-[#EDEBE8] rounded-[16px] p-4 sm:p-5 border border-[#E2E0DC] flex gap-4 items-start"
              >
                {/* Thumbnail */}
                <Link
                  href={`/product/${item.product.slug}`}
                  className="w-20 h-24 sm:w-24 sm:h-28 rounded-[12px] overflow-hidden shrink-0"
                >
                  <ProductImage
                    slug={item.product.slug}
                    brand={item.product.brand}
                    subcategory={item.product.subcategory}
                    aspectRatio="4:5"
                    alt={item.product.name}
                  />
                </Link>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#9A9A9A]">
                        {item.product.brand}
                      </p>
                      <Link href={`/product/${item.product.slug}`} className="hover:underline">
                        <h3 className="text-sm font-bold text-[#111111] leading-snug mt-0.5">
                          {item.product.name}
                        </h3>
                      </Link>
                    </div>
                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => removeItem(item.product.id, item.selectedSize)}
                      aria-label={`Remove ${item.product.name} from cart`}
                      className="text-[#9A9A9A] hover:text-[#8B2020] transition-colors p-1 shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 stroke-[1.75]" />
                    </button>
                  </div>

                  {/* Condition + Size meta */}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Badge variant="condition" label={item.product.condition} />
                    {item.selectedSize && (
                      <span className="text-[10px] font-semibold text-[#444444] bg-white border border-[#E2E0DC] px-2 py-0.5 rounded-full">
                        Size: {item.selectedSize}
                      </span>
                    )}
                  </div>

                  {/* Quantity row */}
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#E2E0DC]/60">
                    {/* Thrift: "1 of 1" locked label */}
                    {isThrift ? (
                      <div className="flex items-center gap-1.5 text-xs text-[#9A9A9A]">
                        <span className="font-semibold text-[#111111]">1 of 1</span>
                        <span>· one-of-one piece</span>
                      </div>
                    ) : (
                      /* Merch: quantity stepper */
                      <div className="flex items-center bg-white border border-[#E2E0DC] rounded-full px-1.5 py-0.5">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.selectedSize)}
                          disabled={item.quantity <= 1}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-[#111111] hover:bg-[#EDEBE8] disabled:opacity-30 cursor-pointer transition-colors"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-xs font-bold text-[#111111]">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.selectedSize)}
                          disabled={item.quantity >= item.product.stock}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-[#111111] hover:bg-[#EDEBE8] disabled:opacity-30 cursor-pointer transition-colors"
                        >
                          +
                        </button>
                      </div>
                    )}

                    <p className="text-sm font-black text-[#111111]">
                      {formatPrice(item.product.price * item.quantity)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Right: Order Summary ── */}
        <div className="lg:col-span-5">
          <div className="bg-[#EDEBE8] rounded-[20px] p-5 sm:p-6 border border-[#E2E0DC] shadow-[0_2px_12px_rgba(0,0,0,0.06)] sticky top-24">
            <h2 className="text-base font-extrabold text-[#111111] mb-5">Order Summary</h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-[#444444]">
                <span>Subtotal ({items.length} {items.length === 1 ? 'item' : 'items'})</span>
                <span className="font-semibold text-[#111111]">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-[#444444]">
                <span>Delivery — Nationwide</span>
                <span className="font-semibold text-[#111111]">{formatPrice(deliveryFee)}</span>
              </div>
            </div>

            <div className="border-t border-[#E2E0DC] my-4" />

            <div className="flex justify-between text-base font-extrabold text-[#111111] mb-6">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
            </div>

            <Link
              href="/checkout"
              className="w-full inline-flex items-center justify-center gap-2 bg-[#111111] text-white font-bold text-sm py-4 rounded-full hover:bg-black transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.12)] active:scale-[0.99]"
            >
              Proceed to Checkout <ArrowRight className="w-4 h-4" />
            </Link>

            {/* Trust notes */}
            <div className="mt-5 space-y-2">
              <div className="flex items-center gap-2 text-xs text-[#444444]">
                <Shield className="w-3.5 h-3.5 text-[#111111] shrink-0" />
                <span>Cash on Delivery available</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#9A9A9A]">
                <span className="w-3.5 text-center font-bold text-[#8B2020]">!</span>
                <span>All sales final — no returns or exchanges</span>
              </div>
            </div>

            <div className="mt-4 text-center">
              <Link href="/shop" className="text-xs text-[#9A9A9A] hover:text-[#111111] underline underline-offset-2 transition-colors">
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
