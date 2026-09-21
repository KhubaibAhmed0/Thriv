import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { products, getRelatedProducts } from '@/data/products';
import { getProductBySlug } from '@/lib/products-db';
import { ProductDetailClient } from '@/components/ProductDetailClient';

interface ProductPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  return products.map((product) => ({
    slug: product.slug,
  }));
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return {
      title: 'Item Not Found — thriv',
    };
  }

  return {
    title: `${product.name} — ${product.brand}`,
    description: product.description,
    openGraph: {
      title: `${product.name} — ${product.brand}`,
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

  const relatedProducts = getRelatedProducts(product.slug, 3);

  return (
    <main className="min-h-screen bg-[#F5F3F0]">
      <ProductDetailClient
        product={product}
        relatedProducts={relatedProducts}
      />
    </main>
  );
}
