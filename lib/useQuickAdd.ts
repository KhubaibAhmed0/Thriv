'use client';

/**
 * lib/useQuickAdd.ts
 *
 * Shared quick-add behaviour for product cards and "complete the look" rows
 * (audit F-20). Merch with multiple sizes opens an inline size picker instead
 * of silently adding a hardcoded size; thrift pieces add their single size.
 */

import { useState } from 'react';
import type { Product } from '@/types';
import { useCart } from '@/components/CartProvider';

export function useQuickAdd(product: Product) {
  const { addItem, isInCart, announce } = useCart();
  const [showSizePicker, setShowSizePicker] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const sizes = product.isMerch ? product.sizes ?? [] : [];
  const needsSizeChoice = product.isMerch && sizes.length > 1;
  const inCart = isInCart(product.id);

  const add = (size?: string) => {
    addItem(product, product.isMerch ? size : product.size ?? undefined);
    // Screen-reader feedback for the silent add (audit F-70).
    announce(
      `${product.name}${size ? `, size ${size}` : ''} added to cart`
    );
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  /** Main "Add To Cart" click. */
  const trigger = () => {
    if (product.stock <= 0) return;
    if (needsSizeChoice) {
      setShowSizePicker(true);
      return;
    }
    add(sizes[0]);
  };

  const pickSize = (size: string) => {
    add(size);
    setShowSizePicker(false);
  };

  return {
    sizes,
    needsSizeChoice,
    showSizePicker,
    setShowSizePicker,
    justAdded,
    inCart,
    trigger,
    pickSize,
  };
}
