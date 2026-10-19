'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import type { HomeAsset } from '@/data/homepage';

export function HomeMedia({ asset, label, className = '', preload = false, sizes }: {
  asset: HomeAsset; label: string; className?: string; preload?: boolean; sizes?: string;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const hasImage = asset.src && asset.src !== failedSource;
  return (
    <div className={`home-media ${hasImage ? 'has-image' : 'is-placeholder'} ${className}`}>
      {hasImage ? (
        <Image src={asset.src!} alt={asset.alt} fill
          // B11: the hero image occupies ~40% of a max-width container; the
          // product grid is 3 columns (2 on mobile). Callers that render in a
          // smaller slot pass their own hint so the browser doesn't download
          // ~2x the bytes it needs.
          sizes={sizes ?? '(max-width: 767px) 100vw, (max-width: 1023px) 60vw, 50vw'}
          preload={preload}
          style={{ objectFit: asset.fit, objectPosition: asset.position }}
          onError={() => setFailedSource(asset.src)} />
      ) : (
        <div className="home-photo-placeholder" role="img" aria-label={`${asset.alt} — photograph not supplied`}>
          <ImageIcon size={22} strokeWidth={1.25} aria-hidden="true" />
          <span>{label}</span><small>Your photograph goes here</small>
        </div>
      )}
    </div>
  );
}
