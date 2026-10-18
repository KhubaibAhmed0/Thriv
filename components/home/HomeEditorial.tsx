'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react';
import type { Product } from '@/types';
import { homeAssets, productAsset } from '@/data/homepage';
import { formatPrice } from '@/lib/formatPrice';
import { HomeMedia } from './HomeMedia';

export function HomeEditorial({ products }: { products: Product[] }) {
  const [index, setIndex] = useState(0);
  const current = products[index % Math.max(products.length, 1)];
  const asset = current ? homeAssets.editorial[current.slug] ?? productAsset(current) : homeAssets.hero;
  return (
    <section className="home-editorial home-container" aria-labelledby="editorial-heading">
      <div className="home-editorial-copy">
        <h2 id="editorial-heading" className="home-display">Carefully<br />curated<br />streetwear.</h2>
        <p>Handpicked branded denim.<br />In-house anime graphic tees.<br />Cleaned, checked, and ready for your rotation.</p>
        <div className="home-editorial-arrows" aria-label="Editorial products">
          <button type="button" aria-label="Previous editorial product" disabled={products.length < 2} onClick={() => setIndex((value) => (value - 1 + products.length) % products.length)}><ArrowLeft size={21} /></button>
          <button type="button" aria-label="Next editorial product" disabled={products.length < 2} onClick={() => setIndex((value) => (value + 1) % products.length)}><ArrowRight size={21} /></button>
        </div>
      </div>
      <div className="home-editorial-visual">
        <div className="home-editorial-backplate" aria-hidden="true" />
        <HomeMedia key={current?.slug ?? 'empty'} asset={asset} label="Editorial photograph" className="home-editorial-photo" />
        {current && <Link href={`/product/${current.slug}`} className="home-editorial-caption" aria-live="polite">
          <span className="home-display">{current.name}</span>
          <span className="home-caption-bottom">{formatPrice(current.price)}<ArrowUpRight size={19} aria-hidden="true" /></span>
        </Link>}
      </div>
    </section>
  );
}
