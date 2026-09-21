import Link from 'next/link';
import { products } from '@/data/products';
import { HeroCarousel } from '@/components/HeroCarousel';
import { BrowseShopSection } from '@/components/BrowseShopSection';
import { YouMayAlsoLikeRow } from '@/components/YouMayAlsoLikeRow';
import {
  Sparkles,
  ShieldCheck,
  Truck,
  Package,
  ArrowRight,
} from 'lucide-react';

export const metadata = {
  title: 'thriv | Curated Thrift Jeans & Anime Graphic Tees · Pakistan',
  description:
    'One-of-one branded denim from Zara, Bershka, Calvin Klein, H&M, Old Navy: handpicked, disinfected, and shipped flat Rs 200 nationwide. Plus in-house anime graphic tees.',
};

const featuredMerch = products.find((p) => p.isMerch && p.isFeatured);

export default function HomePage() {
  return (
    <main className="bg-[#F5F3F0] overflow-x-hidden">

      {/* ── Section 3: Hero ── */}
      <section aria-label="Hero" className="px-4 sm:px-6 lg:px-8 pt-6 pb-4 max-w-7xl mx-auto">
        <HeroCarousel />
      </section>

      {/* ── Section 4: Browse Shop ── */}
      <section aria-label="Browse Shop" className="px-4 sm:px-6 lg:px-8 py-12 max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-6 gap-4">
          <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#111111] tracking-tight leading-tight">
              Browse Shop
            </h2>
            <p className="text-sm text-[#444444] mt-1.5">
              Handpicked 1-of-1 branded denim and in-house anime tees.
            </p>
          </div>
          <Link
            href="/shop"
            className="shrink-0 hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-[#111111] bg-white border border-[#E2E0DC] hover:border-[#111111] px-4 py-2 rounded-full transition-colors"
          >
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <BrowseShopSection products={products} featuredMerch={featuredMerch ?? null} />
      </section>

      {/* ── Section 5: Promo Banner Row ── */}
      <section
        aria-label="Promotions"
        className="px-4 sm:px-6 lg:px-8 pb-12 max-w-7xl mx-auto"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Promo Tile 1: New Thrift Drops */}
          <div className="relative rounded-[20px] overflow-hidden min-h-[160px] sm:min-h-[200px] bg-[#2A2824] flex flex-col justify-between p-6 group">
            <div>
              <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-white/60 mb-2">
                Thriv Thrift
              </span>
              <h3 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">
                New Drops<br />This Week
              </h3>
              <p className="text-xs text-white/65 mt-2 max-w-xs">
                Fresh one-of-one denim from Zara, Calvin Klein and Bershka arrive regularly. First come, first served.
              </p>
            </div>
            <div className="flex items-center justify-between mt-4">
              <Link
                href="/shop?category=jeans&sort=newest"
                className="inline-flex items-center gap-2 bg-white text-[#111111] text-xs font-bold px-4 py-2 rounded-full hover:bg-white/90 transition-colors"
              >
                Explore <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <div
                className="text-[64px] font-black text-white/5 absolute right-6 bottom-3 select-none leading-none"
                aria-hidden="true"
              >
                DENIM
              </div>
            </div>
          </div>

          {/* Promo Tile 2: Anime Tees Now Live */}
          <div className="relative rounded-[20px] overflow-hidden min-h-[160px] sm:min-h-[200px] bg-[#1A2325] flex flex-col justify-between p-6 group">
            <div>
              <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-emerald-400/80 mb-2">
                In-House Merch · Now Live
              </span>
              <h3 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">
                Anime Heavyweight<br />Graphic Tees
              </h3>
              <p className="text-xs text-white/65 mt-2 max-w-xs">
                Akira, Evangelion, Berserk, Cowboy Bebop. 240 GSM screenprinted. Multiple sizes.
              </p>
            </div>
            <div className="flex items-center justify-between mt-4">
              <Link
                href="/shop?category=graphic-tees"
                className="inline-flex items-center gap-2 bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-full hover:bg-emerald-600 transition-colors"
              >
                Shop Tees <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <div
                className="text-[64px] font-black text-white/5 absolute right-6 bottom-3 select-none leading-none"
                aria-hidden="true"
              >
                ANIME
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 6: Full-Width Lifestyle Banner ── */}
      <section
        aria-label="Streetwear banner"
        className="px-4 sm:px-6 lg:px-8 pb-12 max-w-7xl mx-auto"
      >
        <div
          className="relative rounded-[20px] overflow-hidden min-h-[260px] sm:min-h-[320px] flex flex-col justify-end p-8 sm:p-12"
          style={{
            background:
              'linear-gradient(160deg, #1C2431 0%, #2A3340 40%, #3A4352 100%)',
          }}
        >
          {/* Large watermark text */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
            aria-hidden="true"
          >
            <span className="text-[90px] sm:text-[140px] font-black text-white/[0.04] tracking-tighter leading-none">
              THRIV
            </span>
          </div>

          <div className="relative z-10 max-w-lg">
            <p className="text-xs text-white/50 font-semibold uppercase tracking-widest mb-3">
              Karachi Street · Nationwide Ship
            </p>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight">
              Branded Denim.<br />
              <span className="italic font-light">One Piece Only.</span>
            </h2>
            <p className="text-sm text-white/65 mt-3 mb-6 max-w-sm">
              Zara. Bershka. Calvin Klein. H&amp;M. Old Navy. Every pair is cleaned, checked, and shipped from Karachi. When it&apos;s gone, it&apos;s gone.
            </p>
            <div className="flex items-center gap-3">
              <Link
                href="/shop?category=jeans"
                className="inline-flex items-center gap-2 bg-white text-[#111111] font-bold text-sm px-6 py-3 rounded-full hover:bg-white/90 transition-colors shadow-[0_2px_12px_rgba(0,0,0,0.3)]"
              >
                Shop Jeans
              </Link>
              <Link
                href="/shop?category=graphic-tees"
                className="inline-flex items-center gap-2 bg-white/10 border border-white/25 text-white font-semibold text-sm px-6 py-3 rounded-full hover:bg-white/20 transition-colors"
              >
                Anime Tees
              </Link>
            </div>
          </div>

          {/* Trust tag pills */}
          <div
            className="absolute bottom-6 right-6 sm:bottom-8 sm:right-8 flex flex-wrap gap-2 justify-end"
            aria-hidden="true"
          >
            {['H&M', 'Zara', 'Bershka', 'Calvin Klein', 'Old Navy'].map((b) => (
              <span
                key={b}
                className="text-[10px] font-semibold text-white/60 bg-white/10 border border-white/15 px-2.5 py-1 rounded-full"
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 8: You May Also Like (horizontal scroll) ── */}
      <section
        aria-label="You may also like"
        className="pb-12 max-w-7xl mx-auto"
      >
        <div className="px-4 sm:px-6 lg:px-8 mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#111111] tracking-tight">
              You May Also Like
            </h2>
            <p className="text-sm text-[#444444] mt-1">
              More curated pieces, ready to ship.
            </p>
          </div>
          <Link
            href="/shop"
            className="shrink-0 hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-[#111111] bg-white border border-[#E2E0DC] hover:border-[#111111] px-4 py-2 rounded-full transition-colors"
          >
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <YouMayAlsoLikeRow products={products} />
      </section>

      {/* ── Section 9: Why Choose Thriv ── */}
      <section
        aria-labelledby="why-thriv-heading"
        className="px-4 sm:px-6 lg:px-8 pb-16 max-w-7xl mx-auto"
      >
        <div className="bg-[#EDEBE8] rounded-[20px] p-6 sm:p-10 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-[#E2E0DC]">
          <div className="text-center mb-8 sm:mb-10">
            <span className="text-xs font-bold uppercase tracking-widest text-[#9A9A9A]">
              The Thriv Difference
            </span>
            <h2
              id="why-thriv-heading"
              className="text-3xl sm:text-4xl font-extrabold text-[#111111] mt-2 leading-tight"
            >
              Why Choose Thriv?
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Pillar 1 */}
            <div className="bg-white rounded-[16px] p-5 border border-[#E2E0DC] flex flex-col gap-3">
              <div className="w-10 h-10 rounded-full bg-[#EDEBE8] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-[#111111]" />
              </div>
              <h3 className="text-sm font-bold text-[#111111]">
                Handpicked &amp; Disinfected
              </h3>
              <p className="text-xs text-[#444444] leading-relaxed">
                Every piece is physically inspected for structural integrity, odour, and wear before it&apos;s listed. What you see in the photos is exactly what ships to you: no surprises.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="bg-white rounded-[16px] p-5 border border-[#E2E0DC] flex flex-col gap-3">
              <div className="w-10 h-10 rounded-full bg-[#EDEBE8] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-[#111111]" />
              </div>
              <h3 className="text-sm font-bold text-[#111111]">
                100% Branded
              </h3>
              <p className="text-xs text-[#444444] leading-relaxed">
                We stock denim from H&amp;M, Zara, Bershka, Calvin Klein, and Old Navy only. No unbranded fillers, no generic labels. The hardware, stitching, and labeling are all authentic.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="bg-white rounded-[16px] p-5 border border-[#E2E0DC] flex flex-col gap-3">
              <div className="w-10 h-10 rounded-full bg-[#EDEBE8] flex items-center justify-center">
                <Package className="w-5 h-5 text-[#111111]" />
              </div>
              <h3 className="text-sm font-bold text-[#111111]">
                One Piece Only
              </h3>
              <p className="text-xs text-[#444444] leading-relaxed">
                Every thrift item is a one-of-one. No restocks, no size variants, no waitlists. If it&apos;s listed, it&apos;s here. If it&apos;s sold, it&apos;s gone. That&apos;s the nature of curated thrift.
              </p>
            </div>

            {/* Pillar 4 */}
            <div className="bg-white rounded-[16px] p-5 border border-[#E2E0DC] flex flex-col gap-3">
              <div className="w-10 h-10 rounded-full bg-[#EDEBE8] flex items-center justify-center">
                <Truck className="w-5 h-5 text-[#111111]" />
              </div>
              <h3 className="text-sm font-bold text-[#111111]">
                Rs 200 Flat, Anywhere
              </h3>
              <p className="text-xs text-[#444444] leading-relaxed">
                One price, nationwide. Whether you&apos;re in Karachi, Lahore, Peshawar, or Gilgit, courier delivery is Rs 200 flat. Order by WhatsApp or directly on the site.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-8 text-center">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 bg-[#111111] text-white font-bold text-sm px-8 py-3.5 rounded-full hover:bg-black transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
            >
              Start Shopping <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}
