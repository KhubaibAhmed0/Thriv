import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';
import { products as staticProducts } from '@/data/products';
import type { Product } from '@/types';

export async function getAllProducts(): Promise<Product[]> {
  if (isServiceConfigured()) {
    try {
      const client = getServiceClient();
      const { data, error } = await client
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((row: any): Product => ({
          id: row.id,
          slug: row.slug,
          name: row.name,
          brand: row.brand,
          category: row.category,
          subcategory: row.subcategory || (row.category === 'jeans' ? 'straight-leg' : 'anime-tees'),
          price: row.price_pkr,
          condition: row.condition || 'Premium',
          isMerch: row.is_merch || false,
          size: row.size,
          sizes: row.sizes,
          stock: row.stock,
          images: row.images || [],
          description: row.description,
          measurements: row.measurements || {},
          isFeatured: row.is_featured || false,
        }));
      }
    } catch (e) {
      console.warn('[getAllProducts] Supabase fetch fallback to static:', e);
    }
  }
  return staticProducts;
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (isServiceConfigured()) {
    try {
      const client = getServiceClient();
      const { data, error } = await client
        .from('products')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          slug: data.slug,
          name: data.name,
          brand: data.brand,
          category: data.category,
          subcategory: data.subcategory || (data.category === 'jeans' ? 'straight-leg' : 'anime-tees'),
          price: data.price_pkr,
          condition: data.condition || 'Premium',
          isMerch: data.is_merch || false,
          size: data.size,
          sizes: data.sizes,
          stock: data.stock,
          images: data.images || [],
          description: data.description,
          measurements: data.measurements || {},
          isFeatured: data.is_featured || false,
        };
      }
    } catch (e) {
      console.warn('[getProductBySlug] Supabase fetch fallback to static:', e);
    }
  }
  return staticProducts.find((p) => p.slug === slug) || null;
}
