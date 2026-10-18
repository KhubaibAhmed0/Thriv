import type { Product } from '@/types';

export type HomeAsset = {
  src: string | null;
  alt: string;
  fit: 'cover' | 'contain';
  position: string;
};

const emptyAsset = (alt: string, fit: HomeAsset['fit'] = 'cover'): HomeAsset => ({
  src: null, alt, fit, position: 'center',
});

// Add supplied photographs here. Null reserves the layout without requesting
// invented filenames or substituting stock photography.
export const homeAssets = {
  hero: emptyAsset('Thriv hero photograph', 'contain'),
  editorial: {
    'zara-wide-leg-vintage-wash-denim': emptyAsset('Thriv denim editorial photograph'),
    'akira-neo-tokyo-cyberpunk-tee': emptyAsset('Thriv graphic tee editorial photograph'),
  } as Record<string, HomeAsset>,
  featured: emptyAsset('Zara Wide-Leg Vintage Wash Denim', 'contain'),
  campaign: emptyAsset('Thriv community campaign photograph', 'contain'),
  products: {} as Record<string, HomeAsset>,
};

export const homeProductSlugs = [
  'zara-wide-leg-vintage-wash-denim',
  'akira-neo-tokyo-cyberpunk-tee',
  'bershka-baggy-carpenter-jeans',
  'calvin-klein-straight-cut-indigo-jeans',
  'evangelion-unit-01-schematic-tee',
];

export function selectHomeProducts(products: Product[]): Product[] {
  const preferred = homeProductSlugs.flatMap((slug) => {
    const product = products.find((item) => item.slug === slug);
    return product ? [product] : [];
  });
  return [...preferred, ...products.filter((item) => !homeProductSlugs.includes(item.slug))].slice(0, 5);
}

export function productAsset(product: Product): HomeAsset {
  return homeAssets.products[product.slug] ?? {
    src: product.images[0] ?? null, alt: product.name, fit: 'contain', position: 'center',
  };
}
