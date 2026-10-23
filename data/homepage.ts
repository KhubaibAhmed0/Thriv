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

const photo = (
  src: string,
  alt: string,
  fit: HomeAsset['fit'] = 'cover',
  position = 'center',
): HomeAsset => ({ src, alt, fit, position });

// B13: the owner's website image pack is placed by folder, in order:
// Hero Section -> hero, Section 2 -> edit, Section 3 Cards -> categories,
// Section 4 -> statement, Section 5 -> look. Files live in
// public/images/home and are already resized/WebP-encoded (1.03 MB total).
export const homeAssets = {
  hero: photo(
    '/images/home/hero-streetwear.webp',
    'Model in a black zip sweatshirt and wide-leg jeans, seated on a concrete ledge',
    'contain',
    '50% 100%',
  ),
  edit: [
    photo('/images/home/edit-graphic-tee.webp', 'Back view of a white graphic tee with a Luffy print', 'cover', '50% 35%'),
    photo('/images/home/edit-denim.webp', 'Oversized grey sweatshirt styled with distressed wide-leg jeans', 'cover', '50% 30%'),
    photo('/images/home/edit-colour.webp', 'Blue and cream colour-block sweater', 'cover', '50% 30%'),
  ],
  statement: photo(
    '/images/home/statement-stripe.webp',
    'Navy striped knit sweater layered over a white collar',
    'cover',
    '50% 28%',
  ),
  look: photo(
    '/images/home/look-henley.webp',
    'Model in a taupe textured henley and washed wide-leg jeans',
    'contain',
    '50% 100%',
  ),

  // Older homepage slots. Kept so the existing editorial/feature components
  // keep type-checking; the current homepage uses the five sections above.
  editorial: {
    'zara-wide-leg-vintage-wash-denim': emptyAsset('Thriv denim editorial photograph'),
    'akira-neo-tokyo-cyberpunk-tee': emptyAsset('Thriv graphic tee editorial photograph'),
  } as Record<string, HomeAsset>,
  featured: emptyAsset('Zara Wide-Leg Vintage Wash Denim', 'contain'),
  campaign: emptyAsset('Thriv community campaign photograph', 'contain'),
  products: {} as Record<string, HomeAsset>,
};

export type HomeEditCard = {
  caption: string;
  href: string;
  asset: HomeAsset;
};

export const homeEditCards: HomeEditCard[] = [
  { caption: 'The graphic tee', href: '/shop?category=graphic-tees', asset: homeAssets.edit[0] },
  { caption: 'Denim, reworked', href: '/shop?category=jeans', asset: homeAssets.edit[1] },
  { caption: 'The colour story', href: '/shop', asset: homeAssets.edit[2] },
];

export type HomeCategoryCard = {
  label: string;
  href: string;
  asset: HomeAsset;
};

export const homeCategoryCards: HomeCategoryCard[] = [
  {
    label: 'Layers',
    href: '/shop',
    asset: photo('/images/home/category-layers.webp', 'Grey striped sweatshirt', 'cover', '50% 28%'),
  },
  {
    label: 'Denim',
    href: '/shop?category=jeans',
    asset: photo('/images/home/category-denim.webp', 'Wide-leg jeans with star patches', 'cover', '50% 30%'),
  },
  {
    label: 'Graphic tees',
    href: '/shop?category=graphic-tees',
    asset: photo('/images/home/category-graphic-tees.webp', 'White graphic tee with a Luffy print', 'cover', '50% 35%'),
  },
];

export const homeProductSlugs = [
  'zara-wide-leg-vintage-wash-denim',
  'akira-neo-tokyo-cyberpunk-tee',
  'bershka-baggy-carpenter-jeans',
  'calvin-klein-straight-cut-indigo-jeans',
  'evangelion-unit-01-schematic-tee',
];

// B12 imported the website image pack as live listings. These two are art
// placeholders rather than wearable pieces, so they stay off the homepage
// grid even though they have photographs.
const homeGridExclusions = new Set([
  'tanjiro-kamado-water-breathing-sticker',
  'minimalist-one-piece-streetwear-portrait',
]);

export function selectHomeProducts(products: Product[]): Product[] {
  // The five featured slugs are legacy thrift pieces without photos. Prefer
  // them only when they actually have an image, then fill the grid with the
  // newest photographed pieces so the homepage never opens on grey tiles.
  const catalogue = products.filter((product) => !homeGridExclusions.has(product.slug));
  const preferred = homeProductSlugs.flatMap((slug) => {
    const product = catalogue.find((item) => item.slug === slug);
    return product && product.images.length > 0 ? [product] : [];
  });
  const chosen = new Set(preferred.map((product) => product.id));
  const withImages = catalogue.filter((product) => product.images.length > 0 && !chosen.has(product.id));
  const rest = catalogue.filter((product) => product.images.length === 0 && !chosen.has(product.id));
  return [...preferred, ...withImages, ...rest].slice(0, 5);
}

export function productAsset(product: Product): HomeAsset {
  return homeAssets.products[product.slug] ?? {
    src: product.images[0] ?? null, alt: product.name, fit: 'contain', position: 'center',
  };
}
