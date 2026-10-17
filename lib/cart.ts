import type { Cart, CartAction, CartItem } from '@/types';

export const CART_STORAGE_KEY = 'thriv_cart_v1';

// Audit F-62: keep in lockstep with the SQL side — v_delivery_fee in the
// place_order RPC (supabase/migrations/20260920_place_order_rpc.sql) and the
// B4 note in 20261017_b4_data_truth.sql. Change both sides together.
export const FLAT_DELIVERY_FEE = 200;

export const initialCart: Cart = {
  items: [],
};

export function cartReducer(state: Cart, action: CartAction): Cart {
  switch (action.type) {
    case 'ADD_ITEM': {
      const { product, selectedSize } = action;

      // Rule: Sold-out item (stock: 0) cannot be added to cart
      if (product.stock <= 0) {
        return state;
      }

      // Thrift rule: one item, stock of exactly 1, no quantity > 1
      if (!product.isMerch) {
        const existingIndex = state.items.findIndex(
          (item) => item.product.id === product.id
        );
        if (existingIndex > -1) {
          // Already in cart, thrift quantity is locked to 1
          return state;
        }
        return {
          ...state,
          items: [...state.items, { product, quantity: 1, selectedSize: product.size ?? undefined }],
        };
      }

      // Merch rule (graphic tees): multiple sizes, variable stock
      const existingMerchIndex = state.items.findIndex(
        (item) => item.product.id === product.id && item.selectedSize === selectedSize
      );

      if (existingMerchIndex > -1) {
        const currentItem = state.items[existingMerchIndex];
        const newQty = Math.min(currentItem.quantity + 1, product.stock);
        const updatedItems = [...state.items];
        updatedItems[existingMerchIndex] = {
          ...currentItem,
          quantity: newQty,
        };
        return {
          ...state,
          items: updatedItems,
        };
      }

      return {
        ...state,
        items: [...state.items, { product, quantity: 1, selectedSize }],
      };
    }

    case 'REMOVE_ITEM': {
      return {
        ...state,
        items: state.items.filter(
          (item) =>
            !(item.product.id === action.productId && (!action.selectedSize || item.selectedSize === action.selectedSize))
        ),
      };
    }

    case 'UPDATE_QUANTITY': {
      const { productId, quantity, selectedSize } = action;

      return {
        ...state,
        items: state.items
          .map((item) => {
            if (item.product.id !== productId) return item;
            if (selectedSize && item.selectedSize !== selectedSize) return item;

            // Thrift pieces: strictly max 1
            if (!item.product.isMerch) {
              return { ...item, quantity: 1 };
            }

            // Merch pieces: clamped between 0 and stock
            if (quantity <= 0) return null;
            const validQty = Math.min(quantity, item.product.stock);
            return { ...item, quantity: validQty };
          })
          .filter(Boolean) as CartItem[],
      };
    }

    case 'CHANGE_SIZE': {
      const { productId, fromSize, toSize } = action;

      const sourceIndex = state.items.findIndex(
        (item) =>
          item.product.id === productId &&
          item.product.isMerch &&
          (fromSize === undefined || item.selectedSize === fromSize)
      );
      if (sourceIndex === -1) return state;

      const source = state.items[sourceIndex];
      if (source.selectedSize === toSize) return state;

      // Merge with an existing line for the same product+size
      const targetIndex = state.items.findIndex(
        (item, i) =>
          i !== sourceIndex &&
          item.product.id === productId &&
          item.selectedSize === toSize
      );

      if (targetIndex > -1) {
        const merged = [...state.items];
        const target = merged[targetIndex];
        merged[targetIndex] = {
          ...target,
          quantity: Math.min(target.quantity + source.quantity, source.product.stock),
        };
        merged.splice(sourceIndex, 1);
        return { ...state, items: merged };
      }

      const updated = [...state.items];
      updated[sourceIndex] = { ...source, selectedSize: toSize };
      return { ...state, items: updated };
    }

    case 'CLEAR_CART': {
      return { items: [] };
    }

    default:
      return state;
  }
}

export function calculateSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
}

export function calculateTotalCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function calculateOrderTotal(items: CartItem[]): {
  subtotal: number;
  deliveryFee: number;
  total: number;
} {
  const subtotal = calculateSubtotal(items);
  const deliveryFee = items.length > 0 ? FLAT_DELIVERY_FEE : 0;
  const total = subtotal + deliveryFee;
  return { subtotal, deliveryFee, total };
}
