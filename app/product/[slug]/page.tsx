import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getProductBySlug, getAllProducts } from '@/lib/products-db';
import { ProductDetailClient } from '@/components/ProductDetailClient';

// Always render from the database: price, stock and visibility changes must
// reach product pages immediately (audit F-17). Build-time snapshots let
// stale prices and sold-out items stay shoppable indefinitely.
export const dynamic = 'force-dynamic';

interface ProductPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return {
      title: 'Item Not Found | thriv',
    };
  }

  return {
    title: `${product.name} | ${product.brand}`,
    description: product.description,
    openGraph: {
      title: `${product.name} | ${product.brand}`,
      description: product.description,
      type: 'website',
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  // Related items come from the live catalogue too (audit F-18 — it is
  // already filtered to is_active). Same category first, then other pieces.
  const all = await getAllProducts();
  const pool = all.filter((p) => p.slug !== product.slug);
  const sameCategory = pool.filter((p) => p.category === product.category);
  const others = pool.filter((p) => p.category !== product.category);
  const relatedProducts = [...sameCategory, ...others].slice(0, 3);

  return (
    <main className="min-h-screen bg-[#F5F3F0]">
      <ProductDetailClient
        product={product}
        relatedProducts={relatedProducts}
      />
    </main>
  );
}
