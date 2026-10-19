import type { MetadataRoute } from 'next';
import { getAllProducts } from '@/lib/products-db';
import { SITE_URL } from '@/lib/site-url';

// Cached for an hour and invalidated on demand after catalogue mutations
// (lib/revalidate.ts), so newly added pieces still appear without a redeploy.
export const revalidate = 3600;

const BASE_URL = SITE_URL;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/shop`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];

  let productRoutes: MetadataRoute.Sitemap = [];
  try {
    const products = await getAllProducts();
    productRoutes = products.map((product) => ({
      url: `${BASE_URL}/product/${product.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
  } catch (error) {
    // A DB hiccup should never break the sitemap for the static routes.
    console.error('[sitemap] product fetch failed:', error);
  }

  return [...staticRoutes, ...productRoutes];
}
