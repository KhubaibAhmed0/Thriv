'use client';

import React, { createContext, useContext, useEffect, useReducer, useState } from 'react';
import type { Cart, CartItem, Product } from '@/types';
import {
  CART_STORAGE_KEY,
  cartReducer,
  initialCart,
  calculateOrderTotal,
  calculateTotalCount,
} from '@/lib/cart';

interface CartContextType {
  cart: Cart;
  totalCount: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  addItem: (product: Product, selectedSize?: string) => void;
  removeItem: (productId: string, selectedSize?: string) => void;
  updateQuantity: (productId: string, quantity: number, selectedSize?: string) => void;
  clearCart: () => void;
  isInCart: (productId: string, selectedSize?: string) => boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, dispatch] = useReducer(cartReducer, initialCart);
  const [isHydrated, setIsHydrated] = useState(false);

  // Initialize from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed: Cart = JSON.parse(stored);
        if (Array.isArray(parsed.items)) {
          parsed.items.forEach((item: CartItem) => {
            dispatch({ type: 'ADD_ITEM', product: item.product, selectedSize: item.selectedSize });
          });
        }
      }
    } catch (e) {
      console.warn('Failed to parse cart from localStorage', e);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Save to localStorage on cart change
  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      } catch (e) {
        console.warn('Failed to save cart to localStorage', e);
      }
    }
  }, [cart, isHydrated]);

  const totalCount = calculateTotalCount(cart.items);
  const { subtotal, deliveryFee, total } = calculateOrderTotal(cart.items);

  const addItem = (product: Product, selectedSize?: string) => {
    dispatch({ type: 'ADD_ITEM', product, selectedSize });
  };

  const removeItem = (productId: string, selectedSize?: string) => {
    dispatch({ type: 'REMOVE_ITEM', productId, selectedSize });
  };

  const updateQuantity = (productId: string, quantity: number, selectedSize?: string) => {
    dispatch({ type: 'UPDATE_QUANTITY', productId, quantity, selectedSize });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  const isInCart = (productId: string, selectedSize?: string) => {
    return cart.items.some(
      (item) => item.product.id === productId && (!selectedSize || item.selectedSize === selectedSize)
    );
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        totalCount,
        subtotal,
        deliveryFee,
        total,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        isInCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
