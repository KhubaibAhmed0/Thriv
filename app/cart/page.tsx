import type { Metadata } from 'next';
import { CartPageClient } from '@/components/CartPageClient';

export const metadata: Metadata = {
  title: 'Your Cart',
  description: 'Review your selected pieces before checkout.',
};

export default function CartPage() {
  return (
    <main className="min-h-screen bg-[#F5F3F0]">
      <CartPageClient />
    </main>
  );
}
