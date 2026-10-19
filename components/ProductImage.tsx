'use client';

import { useState } from 'react';
import Image from 'next/image';

type AspectRatio = '4:5' | '16:9' | '1:1';

interface ProductImageProps {
  slug: string;
  brand: string;
  subcategory: string;
  aspectRatio?: AspectRatio;
  alt?: string;
  className?: string;
  priority?: boolean;
  imageUrl?: string;
  /**
   * Rendered width hint for next/image's srcset selection (B11).
   * The same component powers the PDP hero (~55vw), grid cards (~25vw),
   * cart thumbnails (~96px) and checkout thumbnails (~48px), so the caller
   * supplies the hint; the default matches the PDP hero layout.
   */
  sizes?: string;
}

// Deterministic hue from slug string — gives each product a distinct warm-neutral tint
function slugToHue(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = slug.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Constrain to warm neutral range: 20–55 (warm browns / tans / taupes)
  return 20 + (Math.abs(hash) % 35);
}

function slugToLightness(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  }
  // 78–88% lightness — always a soft, pale tile
  return 78 + (Math.abs(hash) % 10);
}

const aspectMap: Record<AspectRatio, string> = {
  '4:5': 'aspect-[4/5]',
  '16:9': 'aspect-[16/9]',
  '1:1': 'aspect-square',
};

export function ProductImage({
  slug,
  brand,
  subcategory,
  aspectRatio = '4:5',
  alt,
  className = '',
  priority = false,
  imageUrl,
  sizes = '(max-width: 1024px) 100vw, 55vw',
}: ProductImageProps) {
  const [imgError, setImgError] = useState(false);

  // Audit F-16: never fabricate a local image path. The old fallback guessed
  // `/products/<slug>-N.jpg` — files that never existed — so every seed
  // product rendered a broken image. Without a URL we render an explicit
  // "photo coming soon" tile instead of a silent error state.

  const hue = slugToHue(slug);
  const lightness = slugToLightness(slug);
  const placeholderBg = `hsl(${hue}, 18%, ${lightness}%)`;
  // Dark enough to clear 4.5:1 against the pale tile across every hue and
  // lightness combination (worst case ~5.2:1) — Lighthouse-verified.
  const placeholderText = `hsl(${hue}, 15%, ${lightness - 55}%)`;

  const altText = alt ?? `${brand} ${subcategory}`;

  if (imageUrl && !imgError) {
    return (
      <div
        className={[
          'relative overflow-hidden rounded-[16px] w-full',
          aspectMap[aspectRatio],
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <Image
          src={imageUrl}
          alt={altText}
          fill
          className="object-cover"
          onError={() => setImgError(true)}
          priority={priority}
          sizes={sizes}
        />
      </div>
    );
  }

  // Explicit placeholder state — shown until a real photo is uploaded (F-16).
  return (
    <div
      className={[
        'relative overflow-hidden rounded-[16px] w-full flex items-end',
        aspectMap[aspectRatio],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ backgroundColor: placeholderBg }}
      role="img"
      aria-label={altText}
    >
      <div className="p-3">
        <p
          className="text-[10px] font-semibold uppercase tracking-wider leading-tight"
          style={{ color: placeholderText }}
        >
          {brand}
        </p>
        <p
          className="text-[10px] capitalize leading-tight mt-0.5"
          style={{ color: placeholderText }}
        >
          {subcategory}
        </p>
        <p
          className="text-[9px] font-medium uppercase tracking-wider leading-tight mt-1"
          style={{ color: placeholderText }}
        >
          Photo coming soon
        </p>
      </div>
    </div>
  );
}
