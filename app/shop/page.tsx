import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ShopCatalog } from '@/components/ShopCatalog';
import { getAllProductsWithStatus } from '@/lib/products-db';

export const metadata: Metadata = {
  title: 'Shop All Curated Pieces: Jeans & Graphic Tees',
  description:
    'Browse handpicked one-of-one thrift jeans from Zara, Bershka, Calvin Klein, H&M, Old Navy and exclusive in-house anime graphic tees. Flat Rs 200 delivery across Pakistan.',
};

/**
 * The catalogue is read on the server so pieces are in the prerendered HTML —
 * no shell → JS → /api/products waterfall. `revalidateCatalog()` (lib/revalidate.ts)
 * calls revalidatePath('/shop') after admin mutations; this is the safety net
 * for anything that writes directly to the DB. The route stays static (no
 * cookies/headers), so it keeps being served as an edge-cached HIT.
 */
export const revalidate = 60;

export default async function ShopPage() {
  const { products, ok } = await getAllProductsWithStatus();
  return (
    <main className="min-h-screen bg-page">
      <Suspense
        fallback={
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
            <div className="inline-block w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-body">Loading collection...</p>
          </div>
        }
      >
        <ShopCatalog initialProducts={products} initialError={!ok} />
      </Suspense>
    </main>
  );
}
