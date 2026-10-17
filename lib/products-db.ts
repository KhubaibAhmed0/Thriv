import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';
import { products as staticProducts } from '@/data/products';
import type { Product } from '@/types';

/**
 * Product data source (audit F-13 / F-15 / F-18).
 *
 * - Unconfigured Supabase (local dev / demo checkout-less runs): the static
 *   seed array is served so the site still renders.
 * - Configured Supabase: the DATABASE is the single source of truth. An
 *   error or an empty result returns an empty catalogue instead of silently
 *   shadowing the failing/empty DB with phantom seed products — phantom
 *   items lead customers into a checkout that cannot fulfil them. Failures
 *   are logged as the operator signal.
 *
 * Visibility is governed solely by `products.is_active` (audit F-15: the
 * legacy hardcoded-slug exclusion was removed once the DB row itself was
 * hidden by the B4 migration).
 */

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  brand: Product['brand'];
  category: Product['category'];
  subcategory: string | null;
  price_pkr: number;
  condition: string | null;
  is_merch: boolean | null;
  size: string | null;
  sizes: string[] | null;
  stock: number;
  images: string[] | null;
  description: string;
  measurements: Record<string, string> | null;
  is_featured: boolean | null;
}

function mapRow(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    category: row.category,
    // Audit F-10: never fabricate a subcategory — a missing value renders as
    // unfiltered instead of silently landing the item under a wrong filter.
    subcategory: row.subcategory || '',
    price: row.price_pkr,
    condition: (row.condition || 'Premium') as Product['condition'],
    isMerch: row.is_merch || false,
    size: row.size,
    sizes: row.sizes,
    stock: row.stock,
    images: row.images || [],
    description: row.description,
    measurements: row.measurements || {},
    isFeatured: row.is_featured || false,
  };
}

export async function getAllProducts(): Promise<Product[]> {
  if (!isServiceConfigured()) {
    return staticProducts;
  }

  try {
    const client = getServiceClient();
    const { data, error } = await client
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(
        '[getAllProducts] Supabase error — returning empty catalogue (DB is the source of truth):',
        error.message
      );
      return [];
    }

    return (data ?? []).map(mapRow);
  } catch (e) {
    console.error(
      '[getAllProducts] Supabase fetch failed — returning empty catalogue:',
      e
    );
    return [];
  }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (!isServiceConfigured()) {
    return staticProducts.find((p) => p.slug === slug) || null;
  }

  try {
    const client = getServiceClient();
    const { data, error } = await client
      .from('products')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true) // audit F-18: hidden products are not viewable
      .maybeSingle();

    if (error) {
      console.error(
        '[getProductBySlug] Supabase error — treating as not found:',
        error.message
      );
      return null;
    }

    return data ? mapRow(data) : null;
  } catch (e) {
    console.error('[getProductBySlug] Supabase fetch failed — treating as not found:', e);
    return null;
  }
}
