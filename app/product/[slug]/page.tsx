import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getProductBySlug, getAllProducts } from '@/lib/products-db';
import { ProductDetailClient } from '@/components/ProductDetailClient';

// Audit F-17: the DB is the single source of truth, so price, stock and
// visibility changes must reach product pages promptly. Pages are served from
// an ISR cache with a 60s cap, and every catalogue mutation revalidates them
// on demand via lib/revalidate.ts — admin edits and order-driven stock changes
// land on the next request. Edits that bypass the app (Supabase Studio) heal
// within the window, and checkout still validates price + stock server-side
// inside the place_order RPC, so a stale page can never sell a sold-out piece.
export const revalidate = 60;

interface ProductPageProps {
  params: Promise<{
    slug: string;
  }>;
}

/**
 * Pre-render every active product at build time. New pieces (and pieces
 * hidden at build time) render on demand and are cached the same way —
 * dynamicParams keeps its default. getAllProducts() returns [] instead of
 * throwing on a DB error, so a build without DB access degrades to
 * on-demand ISR rather than failing.
 */
export async function generateStaticParams() {
  const products = await getAllProducts();
  return products.map((product) => ({ slug: product.slug }));
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
    <main className="min-h-screen bg-page">
      <ProductDetailClient
        product={product}
        relatedProducts={relatedProducts}
      />
    </main>
  );
}
