'use client';

import { useState } from 'react';
import Image from 'next/image';

type AspectRatio = '4:5' | '16:9' | '1:1';

interface ProductImageProps {
  slug: string;
  brand: string;
  subcategory: string;
  imageIndex?: number;
  aspectRatio?: AspectRatio;
  alt?: string;
  className?: string;
  priority?: boolean;
  imageUrl?: string;
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
  imageIndex = 1,
  aspectRatio = '4:5',
  alt,
  className = '',
  priority = false,
  imageUrl,
}: ProductImageProps) {
  const [imgError, setImgError] = useState(false);
  const src = imageUrl || `/products/${slug}-${imageIndex}.jpg`;

  const hue = slugToHue(slug);
  const lightness = slugToLightness(slug);
  const placeholderBg = `hsl(${hue}, 18%, ${lightness}%)`;
  const placeholderText = `hsl(${hue}, 15%, ${lightness - 30}%)`;

  const altText = alt ?? `${brand} ${subcategory}`;

  if (!imgError) {
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
          src={src}
          alt={altText}
          fill
          unoptimized
          className="object-cover"
          onError={() => setImgError(true)}
          priority={priority}
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
        />
      </div>
    );
  }

  // CSS placeholder — shown when real image is missing
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
          style={{ color: placeholderText, opacity: 0.75 }}
        >
          {subcategory}
        </p>
      </div>
    </div>
  );
}
