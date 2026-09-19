import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Sparkles, ShieldCheck, Package, Truck, Shirt } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About Thriv — How We Source and Curate',
  description:
    'Thriv is a Karachi-based thrift and curated streetwear store. Learn how we source, inspect, disinfect, and list every one-of-one branded piece.',
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#F5F3F0]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[#9A9A9A] mb-8">
          <Link href="/" className="hover:text-[#111111] transition-colors">Home</Link>
          <span>/</span>
          <span className="text-[#111111] font-medium">About</span>
        </nav>

        {/* Hero Header */}
        <div className="mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-[#9A9A9A] mb-3">
            Karachi-Based · Nationwide Delivery
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-[#111111] leading-[1.08] tracking-tight">
            About Thriv
          </h1>
          <p className="text-lg text-[#444444] mt-4 leading-relaxed max-w-2xl">
            Thriv is a curated thrift and streetwear store run out of Karachi. Every piece is handpicked, cleaned, and listed individually. No restocks, no bulk buying — just one piece at a time, done properly.
          </p>
        </div>

        {/* Section: What we do */}
        <section className="mb-12 bg-[#EDEBE8] rounded-[20px] p-6 sm:p-8 border border-[#E2E0DC]">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles className="w-5 h-5 text-[#111111]" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-[#111111]">How We Source</h2>
              <p className="text-[#9A9A9A] text-xs mt-0.5 uppercase tracking-wider">The Curation Process</p>
            </div>
          </div>
          <div className="space-y-4 text-sm text-[#444444] leading-relaxed">
            <p>
              We source exclusively from international and branded inventory — H&amp;M, Zara, Bershka, Calvin Klein, and Old Navy. Every piece arrives as a physical item that we hold in Karachi.
            </p>
            <p>
              Before anything gets listed on the site, it passes through a manual inspection: checking seams, hardware, wash condition, pocket integrity, and fit consistency. Anything that doesn&apos;t meet our standard doesn&apos;t get listed. We&apos;d rather have an empty listing than a bad one.
            </p>
            <p>
              We currently focus on two product lines: curated thrift denim (jeans) and our in-house anime graphic tee series. Both exist because we saw a real gap — branded pre-owned denim that you can actually trust the quality of, and heavyweight graphic tees that don&apos;t shrink in the first wash.
            </p>
          </div>
        </section>

        {/* Section: Disinfection */}
        <section className="mb-12 bg-[#EDEBE8] rounded-[20px] p-6 sm:p-8 border border-[#E2E0DC]">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
              <ShieldCheck className="w-5 h-5 text-[#111111]" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-[#111111]">The Disinfection Step</h2>
              <p className="text-[#9A9A9A] text-xs mt-0.5 uppercase tracking-wider">Before Every Listing</p>
            </div>
          </div>
          <div className="space-y-4 text-sm text-[#444444] leading-relaxed">
            <p>
              Every thrift item goes through a proper cleaning process before it reaches the listing stage. This is not optional — it is a non-negotiable step regardless of how clean the piece looks on arrival.
            </p>
            <p>
              After washing, pieces are air-dried and pressed where needed, then re-inspected before photography. The photos on the listing reflect the actual item in its cleaned, ready-to-ship state. There is no gap between what you see and what arrives.
            </p>
          </div>
        </section>

        {/* Section: One-of-One */}
        <section className="mb-12 bg-[#EDEBE8] rounded-[20px] p-6 sm:p-8 border border-[#E2E0DC]">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
              <Package className="w-5 h-5 text-[#111111]" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-[#111111]">Why One-of-One Matters</h2>
              <p className="text-[#9A9A9A] text-xs mt-0.5 uppercase tracking-wider">The Core of Curated Thrift</p>
            </div>
          </div>
          <div className="space-y-4 text-sm text-[#444444] leading-relaxed">
            <p>
              Every thrift item at Thriv is a single piece with a single fixed size and a stock of exactly 1. There are no size variants on a thrift listing. There are no restocks. When an item sells, it&apos;s gone.
            </p>
            <p>
              This isn&apos;t a limitation — it is the point. Curated thrift is about owning something specific, not something you&apos;ve seen on ten other people. You are buying that pair of Zara wide-leg jeans in size 32, not &quot;a pair of Zara jeans.&quot;
            </p>
            <p>
              We show exact measurements for every thrift piece — waist, length, inseam, and rise. This is the most important information on the listing. Please compare these numbers against a pair you already own before placing an order, because all sales are final.
            </p>
          </div>
        </section>

        {/* Section: Anime Tees */}
        <section className="mb-12 bg-[#EDEBE8] rounded-[20px] p-6 sm:p-8 border border-[#E2E0DC]">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
              <Shirt className="w-5 h-5 text-[#111111]" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-[#111111]">The Anime Tee Line</h2>
              <p className="text-[#9A9A9A] text-xs mt-0.5 uppercase tracking-wider">In-House Merch</p>
            </div>
          </div>
          <div className="space-y-4 text-sm text-[#444444] leading-relaxed">
            <p>
              The anime tee line is Thriv&apos;s first in-house product. Four designs — Akira, Evangelion, Berserk, Cowboy Bebop — on 240 GSM combed cotton. Boxy streetwear fits, heavy enough that they don&apos;t go transparent, pre-shrunk so the size you order is the size you wear.
            </p>
            <p>
              Unlike thrift pieces, the graphic tees come in multiple sizes (S, M, L, XL) with real batch stock. You can order multiples if needed. They are produced in limited runs, so availability is not guaranteed long-term.
            </p>
          </div>
        </section>

        {/* Section: Delivery */}
        <section className="mb-12 bg-[#EDEBE8] rounded-[20px] p-6 sm:p-8 border border-[#E2E0DC]">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
              <Truck className="w-5 h-5 text-[#111111]" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-[#111111]">Nationwide Delivery</h2>
              <p className="text-[#9A9A9A] text-xs mt-0.5 uppercase tracking-wider">Rs 200 Flat</p>
            </div>
          </div>
          <div className="space-y-4 text-sm text-[#444444] leading-relaxed">
            <p>
              We dispatch from Karachi to all cities and towns across Pakistan. Delivery is Rs 200 flat — one price regardless of whether you&apos;re in Lahore, Faisalabad, Multan, Hyderabad, Quetta, Peshawar, or Gilgit.
            </p>
            <p>
              After your order is placed, you will receive a confirmation on WhatsApp. Once dispatched, you will receive a tracking number from the courier. Estimated delivery time is 3–7 working days depending on your city.
            </p>
            <p>
              Cash on Delivery is available alongside Bank Transfer, EasyPaisa, JazzCash, and Card (coming soon).
            </p>
          </div>
        </section>

        {/* Final Sale Policy — Prominent */}
        <div className="mb-12 bg-[#F5E6E6] rounded-[16px] p-5 sm:p-6 border border-[#E2C2C2]">
          <h3 className="text-sm font-bold text-[#8B2020] mb-2">Final Sale — No Returns, No Exchanges</h3>
          <p className="text-xs text-[#8B2020] leading-relaxed">
            All sales at Thriv are strictly final. No returns or exchanges are accepted. This applies to both thrift items and graphic tees. Because thrift inventory is one-of-one, a returned piece cannot be re-listed in the same condition — this is why we invest heavily in accurate photography, exact measurements, and honest condition grading. Please read the listing carefully and check the measurements before placing your order.
          </p>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 bg-[#111111] text-white font-bold text-sm px-8 py-4 rounded-full hover:bg-black transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
          >
            Browse the Collection <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-xs text-[#9A9A9A] mt-4">
            Have a question? <a href="https://wa.me/923248188616" target="_blank" rel="noopener noreferrer" className="text-[#111111] font-semibold hover:underline">Chat on WhatsApp (0324-8188616) →</a>
          </p>
        </div>

      </div>
    </main>
  );
}
