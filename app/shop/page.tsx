import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ShopCatalog } from '@/components/ShopCatalog';

export const metadata: Metadata = {
  title: 'Shop All Curated Pieces — Jeans & Graphic Tees',
  description:
    'Browse handpicked one-of-one thrift jeans from Zara, Bershka, Calvin Klein, H&M, Old Navy and exclusive in-house anime graphic tees. Flat Rs 200 delivery across Pakistan.',
};

export default function ShopPage() {
  return (
    <main className="min-h-screen bg-[#F5F3F0]">
      <Suspense
        fallback={
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
            <div className="inline-block w-8 h-8 border-2 border-[#111111] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-[#444444]">Loading collection...</p>
          </div>
        }
      >
        <ShopCatalog />
      </Suspense>
    </main>
  );
}
