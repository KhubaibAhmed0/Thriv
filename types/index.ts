// ──────────────────────────────────────────────
// Thriv — Shared TypeScript Types
// ──────────────────────────────────────────────

export type Condition = 'Premium' | 'Excellent' | 'Very Good';

// Client updated: business currently carries Jeans and Graphic T-shirts only
export type Category = 'jeans' | 'graphic-tees';

export type Gender = 'men' | 'women' | 'unisex';

export type Subcategory =
  | 'straight-leg'
  | 'baggy'
  | 'wide-leg'
  | 'relaxed-fit'
  | 'vintage-wash'
  | 'cargo-denim'
  | 'anime-tees'
  | 'oversized-tees'
  | string;

export type Brand =
  | 'H&M'
  | 'Zara'
  | 'Bershka'
  | 'Calvin Klein'
  | 'Old Navy'
  | 'Thriv';

export type Product = {
  id: string;
  slug: string;
  name: string;
  brand: Brand;
  category: Category;
  gender?: Gender;
  subcategory: Subcategory;
  price: number;           // PKR integer, 999–2499
  condition: Condition;
  isMerch: boolean;        // true only for anime tees
  size: string | null;     // thrift: single fixed size e.g. "32/32" or "M"
  sizes: string[] | null;  // merch only: ['S','M','L','XL']
  stock: number;           // thrift: always 1 (or 0 if sold). merch: 10–40
  images: string[];        // paths under /products/
  description: string;     // 2–3 real sentences
  measurements?: {
    waist?: string;
    length?: string;
    inseam?: string;
    rise?: string;
    chest?: string;
    shoulders?: string;
  };
  colors?: string[];       // hex color swatches
  isFeatured?: boolean;
};

export type CartItem = {
  product: Product;
  quantity: number;
  selectedSize?: string;   // required for merch items
};

export type Cart = {
  items: CartItem[];
};

export type CartAction =
  | { type: 'ADD_ITEM'; product: Product; selectedSize?: string }
  | { type: 'REMOVE_ITEM'; productId: string; selectedSize?: string }
  | { type: 'UPDATE_QUANTITY'; productId: string; quantity: number; selectedSize?: string }
  | { type: 'CLEAR_CART' };

export type PaymentMethod =
  | 'cash-on-delivery'
  | 'bank-transfer'
  | 'easypaisa'
  | 'jazzcash'
  | 'card';

export type Province =
  | 'Punjab'
  | 'Sindh'
  | 'Khyber Pakhtunkhwa'
  | 'Balochistan'
  | 'Gilgit-Baltistan'
  | 'Azad Jammu & Kashmir'
  | 'Islamabad Capital Territory';

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered';

export type Order = {
  orderNumber: string;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: PaymentMethod;
  customerName: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  province: Province;
  notes?: string;
  createdAt: string;
};
