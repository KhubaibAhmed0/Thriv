'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const slides = [
  {
    id: 1,
    overline: 'Thriv Drop — Karachi',
    headline: 'Branded Jeans.\nOne Piece Only.',
    italic: 'One Piece Only.',
    sub: 'Zara, Bershka, Calvin Klein, H&M and Old Navy — every pair handpicked, disinfected, and shipped nationwide.',
    tags: ['1-of-1 Thrift'],
    cta: { label: 'Shop Jeans', href: '/shop?category=jeans' },
    bg: 'linear-gradient(145deg, #1C2431 0%, #2D3748 55%, #3A4A5E 100%)',
    watermark: 'DENIM',
  },
  {
    id: 2,
    overline: 'In-House Merch — Now Live',
    headline: 'Anime Graphic\nTees Are Here.',
    italic: 'Tees Are Here.',
    sub: 'Akira, Evangelion, Berserk, Cowboy Bebop, Ghost in the Shell. 240 GSM screenprinted. Sizes S to XL.',
    tags: ['Heavyweight 240 GSM', 'S–XL Sizes'],
    cta: { label: 'Shop Anime Tees', href: '/shop?category=graphic-tees' },
    bg: 'linear-gradient(145deg, #0F1923 0%, #1A2835 55%, #212F3E 100%)',
    watermark: 'ANIME',
  },
];

export function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const prev = () => setCurrent((c) => (c === 0 ? slides.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c === slides.length - 1 ? 0 : c + 1));

  const slide = slides[current];

  return (
    <div
      className="relative rounded-[20px] overflow-hidden min-h-[340px] sm:min-h-[440px] flex flex-col justify-end p-7 sm:p-10 transition-all duration-500 shadow-[0_4px_24px_rgba(0,0,0,0.15)]"
      style={{ background: slide.bg }}
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const delta = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(delta) > 40) { delta < 0 ? next() : prev(); }
        touchStartX.current = null;
      }}
    >
      {/* Large watermark */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
        aria-hidden="true"
      >
        <span className="text-[80px] sm:text-[130px] font-black tracking-tighter text-white/[0.04] leading-none">
          {slide.watermark}
        </span>
      </div>

      {/* Slide indicators — top right */}
      <div className="absolute top-5 right-5 flex items-center gap-1.5" aria-label="Slide navigation">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setCurrent(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={[
              'rounded-full transition-all duration-300',
              i === current
                ? 'w-5 h-1.5 bg-white'
                : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/70',
            ].join(' ')}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-lg">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/55 mb-3">
          {slide.overline}
        </p>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-[1.1] mb-4 whitespace-pre-line">
          {slide.headline}
        </h1>

        <p className="text-sm text-white/65 mb-5 max-w-sm leading-relaxed">
          {slide.sub}
        </p>

        {/* Tag Pills */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {slide.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs font-semibold text-white bg-white/15 border border-white/25 px-3 py-1 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <Link
            href={slide.cta.href}
            className="inline-flex items-center gap-2 bg-white text-[#111111] font-bold text-sm px-6 py-3 rounded-full hover:bg-white/92 transition-all shadow-[0_2px_12px_rgba(0,0,0,0.25)] active:scale-[0.98]"
          >
            {slide.cta.label}
          </Link>
        </div>
      </div>

      {/* Arrow Controls */}
      <div className="absolute bottom-7 right-7 flex items-center gap-2">
        <button
          type="button"
          onClick={prev}
          aria-label="Previous slide"
          className="w-9 h-9 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white hover:bg-white/25 transition-colors active:scale-95 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 stroke-[2]" />
        </button>
        <button
          type="button"
          onClick={next}
          aria-label="Next slide"
          className="w-9 h-9 rounded-full bg-white/90 border border-white/25 flex items-center justify-center text-[#111111] hover:bg-white transition-colors active:scale-95 cursor-pointer"
        >
          <ChevronRight className="w-4 h-4 stroke-[2]" />
        </button>
      </div>
    </div>
  );
}
