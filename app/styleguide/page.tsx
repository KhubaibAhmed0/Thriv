import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { FilterChip } from '@/components/ui/FilterChip';
import { Input, Select, Textarea } from '@/components/ui/FormFields';
import { ProductImage } from '@/components/ProductImage';
import { ProductCard } from '@/components/ProductCard';
import { ShopTheLook } from '@/components/ShopTheLook';
import { CategoryFilterRow } from '@/components/CategoryFilterRow';
import { formatPrice } from '@/lib/formatPrice';
import { products } from '@/data/products';

export const metadata: Metadata = {
  title: 'Thriv — Design System & Phase 2 Components',
  description: 'Tokens and Phase 2 components fidelity check',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-16">
      <h2 className="text-xl font-bold text-[#111111] mb-1">{title}</h2>
      <div className="w-16 h-0.5 bg-[#111111] mb-6" />
      {children}
    </section>
  );
}

function Token({ name, value, preview }: { name: string; value: string; preview?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      {preview}
      <div>
        <p className="text-sm font-mono font-medium text-[#111111]">{name}</p>
        <p className="text-xs font-mono text-[#9A9A9A]">{value}</p>
      </div>
    </div>
  );
}

function ColorSwatch({ color, name, value }: { color: string; name: string; value: string }) {
  return (
    <Token
      name={name}
      value={value}
      preview={
        <div
          className="w-12 h-12 rounded-[8px] border border-[#E2E0DC] flex-shrink-0"
          style={{ backgroundColor: color }}
        />
      }
    />
  );
}

export default function StyleguidePage() {
  // Grab sample items for demonstration
  const sampleThrift = products.find((p) => !p.isMerch && p.stock > 0)!;
  const sampleSoldOut = products.find((p) => p.stock === 0)!;
  const sampleMerch = products.find((p) => p.isMerch)!;
  const lookItems = products.slice(0, 3);

  return (
    <main className="min-h-screen bg-[#F5F3F0] px-4 sm:px-6 py-12 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#9A9A9A]">
            Phase 1 & Phase 2 Gate
          </span>
          <span className="text-xs bg-[#E8F0E0] text-[#3A6B35] px-2.5 py-0.5 rounded-full font-medium">
            Jeans & Graphic Tees Catalog
          </span>
        </div>
        <h1 className="text-4xl font-extrabold text-[#111111] mb-3">thriv styleguide & live components</h1>
        <p className="text-[#444444] max-w-2xl">
          Complete visual foundation, design tokens, and Phase 2 components (live CartContext, 33-item typed dataset, ProductCard, CategoryFilterRow, Header, Footer, ShopTheLook).
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 bg-[#E8F0E0] text-[#3A6B35] text-xs font-medium px-3 py-1.5 rounded-full">
            ✓ formatPrice: {formatPrice(1299)} · {formatPrice(999)} · {formatPrice(2499)}
          </span>
          <span className="inline-flex items-center gap-1.5 bg-white border border-[#E2E0DC] text-[#111111] text-xs font-medium px-3 py-1.5 rounded-full">
            ✓ Total Seed Items: {products.length} (28 Thrift Jeans + 5 Anime Tees)
          </span>
        </div>
      </div>

      {/* ── PHASE 2 SHOWCASE: CATEGORY FILTER ROW ── */}
      <Section title="Phase 2: Category Filter Row (Curated for Jeans & Graphic Tees)">
        <p className="text-sm text-[#444444] mb-4">
          Per client request: catalog is focused strictly on <strong>Jeans (Thrift 1-of-1)</strong> and <strong>Graphic T-Shirts (In-House Merch)</strong> with fit filters. Pill active state matches reference design.
        </p>
        <div className="bg-white rounded-[16px] p-2 border border-[#E2E0DC]">
          <Suspense fallback={<div className="h-10" />}>
            <CategoryFilterRow interactive={false} />
          </Suspense>
        </div>
      </Section>

      {/* ── PHASE 2 SHOWCASE: LIVE PRODUCT CARDS ── */}
      <Section title="Phase 2: Live ProductCard Primitives (Connected to CartProvider)">
        <p className="text-sm text-[#444444] mb-4">
          Try clicking <strong>&quot;Add To Cart&quot;</strong> below — notice the Header cart count badge updates immediately in real-time, persists to localStorage, and enforces 1-of-1 thrift rules.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-2">1. One-of-One Thrift Jeans</p>
            <ProductCard product={sampleThrift} />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-2">2. Sold-Out Thrift (Disabled CTA)</p>
            <ProductCard product={sampleSoldOut} />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-2">3. In-House Merch Graphic Tee</p>
            <ProductCard product={sampleMerch} />
          </div>
        </div>
      </Section>

      {/* ── PHASE 2 SHOWCASE: SHOP THE LOOK ── */}
      <Section title="Phase 2: Shop The Look Module (Clone of Reference 'Item In This Look')">
        <p className="text-sm text-[#444444] mb-4">
          Replicating the exact reference pattern with lifestyle photography block, item list, condition grades, and individual add-to-cart actions.
        </p>
        <ShopTheLook items={lookItems} />
      </Section>

      {/* ── 1. COLOR TOKENS ── */}
      <Section title="1. Color Tokens">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
          <ColorSwatch color="#F5F3F0" name="--color-page" value="#F5F3F0 — page background" />
          <ColorSwatch color="#EDEBE8" name="--color-card" value="#EDEBE8 — card surface" />
          <ColorSwatch color="#FFFFFF" name="--color-card-inner" value="#FFFFFF — inner white" />
          <ColorSwatch color="#111111" name="--color-black" value="#111111 — primary text / buttons" />
          <ColorSwatch color="#9A9A9A" name="--color-muted" value="#9A9A9A — meta / labels" />
          <ColorSwatch color="#444444" name="--color-body" value="#444444 — body copy" />
          <ColorSwatch color="#E2E0DC" name="--color-border" value="#E2E0DC — borders / dividers" />
          <ColorSwatch color="#E8F0E0" name="badge-promo-bg" value="#E8F0E0 — promo badge" />
          <ColorSwatch color="#EDE9E0" name="badge-premium-bg" value="#EDE9E0 — Premium condition" />
          <ColorSwatch color="#E6EDF5" name="badge-excellent-bg" value="#E6EDF5 — Excellent condition" />
          <ColorSwatch color="#EAF0EA" name="badge-verygood-bg" value="#EAF0EA — Very Good condition" />
          <ColorSwatch color="#F5E6E6" name="badge-sold-bg" value="#F5E6E6 — Sold out" />
        </div>
      </Section>

      {/* ── 2. RADIUS ── */}
      <Section title="2. Border Radius">
        <div className="flex flex-wrap gap-6 items-end">
          <div className="flex flex-col items-center gap-2">
            <div className="w-32 h-20 bg-[#EDEBE8] border border-[#E2E0DC] rounded-[20px]" />
            <p className="text-xs text-[#9A9A9A] font-mono">hero / large card<br />20px</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-28 h-16 bg-[#EDEBE8] border border-[#E2E0DC] rounded-[16px]" />
            <p className="text-xs text-[#9A9A9A] font-mono">product card<br />16px</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-24 h-10 bg-[#EDEBE8] border border-[#E2E0DC] rounded-[8px]" />
            <p className="text-xs text-[#9A9A9A] font-mono">input / sm<br />8px</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-20 h-9 bg-[#111111] rounded-[9999px]" />
            <p className="text-xs text-[#9A9A9A] font-mono">button / pill<br />9999px</p>
          </div>
        </div>
      </Section>

      {/* ── 3. SHADOW ── */}
      <Section title="3. Shadow">
        <div className="flex flex-wrap gap-6">
          <div className="flex flex-col items-center gap-2">
            <div className="w-32 h-20 bg-white rounded-[16px] shadow-[0_2px_12px_rgba(0,0,0,0.07)]" />
            <p className="text-xs text-[#9A9A9A] font-mono">shadow-card<br />0 2px 12px rgba(0,0,0,0.07)</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-28 h-12 bg-[#111111] rounded-[9999px] shadow-[0_1px_4px_rgba(0,0,0,0.12)]" />
            <p className="text-xs text-[#9A9A9A] font-mono">shadow-btn<br />0 1px 4px rgba(0,0,0,0.12)</p>
          </div>
        </div>
      </Section>

      {/* ── 4. TYPOGRAPHY ── */}
      <Section title="4. Typography — Inter">
        <div className="space-y-4 bg-[#EDEBE8] rounded-[16px] p-6">
          <p className="text-4xl font-bold text-[#111111] leading-tight">Heading XL — Bold 36px</p>
          <p className="text-2xl font-bold text-[#111111]">Heading LG — Bold 24px</p>
          <p className="text-xl font-semibold text-[#111111]">Heading MD — Semibold 20px</p>
          <p className="text-base font-medium text-[#111111]">Body MD — Medium 16px — Product name style</p>
          <p className="text-sm text-[#444444]">Body SM — Regular 14px — Description copy. Clear, direct, no filler.</p>
          <p className="text-xs text-[#9A9A9A] uppercase tracking-wider">Caption — 12px muted gray — category labels</p>
          <p className="text-lg font-bold text-[#111111]">Price — Bold 18px — {formatPrice(1499)}</p>
        </div>
      </Section>

      {/* ── 5. BUTTONS ── */}
      <Section title="5. Buttons">
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3 items-center">
            <Button variant="primary">Start Shopping</Button>
            <Button variant="primary">Add To Cart</Button>
            <Button variant="primary" disabled>Sold Out</Button>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <Button variant="outline">Shop Now</Button>
            <Button variant="outline">View All</Button>
          </div>
          <div className="flex flex-wrap gap-3 items-center p-6 bg-[#333] rounded-[16px]">
            <Button variant="ghost">Shop Now</Button>
            <span className="text-white text-xs">Ghost (for use on dark/photo backgrounds)</span>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <Button variant="small">Add To Cart</Button>
            <Button variant="small">Add To Cart</Button>
            <span className="text-[#9A9A9A] text-xs">Small (product card CTAs)</span>
          </div>
        </div>
      </Section>

      {/* ── 6. BADGES ── */}
      <Section title="6. Badges">
        <div className="flex flex-wrap gap-3 items-center">
          <Badge variant="condition" label="Premium" />
          <Badge variant="condition" label="Excellent" />
          <Badge variant="condition" label="Very Good" />
          <Badge variant="promo" label="Up to 30% off" />
          <Badge variant="sold-out" label="Sold" />
        </div>
      </Section>

      {/* ── 7. FORM FIELDS ── */}
      <Section title="7. Form Fields">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
          <Input
            label="Full Name"
            id="sg-name"
            placeholder="Ahmed Khan"
          />
          <Input
            label="WhatsApp Number"
            id="sg-phone"
            placeholder="03XX-XXXXXXX"
          />
          <Input
            label="With error state"
            id="sg-error"
            placeholder="..."
            error="Please enter a valid Pakistani number"
            defaultValue="0123"
          />
          <Select
            label="Province"
            id="sg-province"
            placeholder="Select province"
            options={[
              { value: 'punjab', label: 'Punjab' },
              { value: 'sindh', label: 'Sindh' },
              { value: 'kpk', label: 'Khyber Pakhtunkhwa' },
            ]}
          />
          <div className="sm:col-span-2">
            <Textarea
              label="Order Notes (optional)"
              id="sg-notes"
              placeholder="Anything we should know?"
            />
          </div>
        </div>
      </Section>

      {/* ── 8. HERO BLOCK PREVIEW ── */}
      <Section title="8. Hero Block Anatomy">
        <div
          className="relative rounded-[20px] overflow-hidden p-8 min-h-[240px] flex flex-col justify-end"
          style={{ background: 'linear-gradient(135deg, #2a2824 0%, #4a4035 100%)' }}
        >
          <div className="relative z-10 max-w-sm">
            <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">Thriv Karachi Drop</p>
            <h2 className="text-white text-3xl font-bold leading-tight mb-3">
              Curated Jeans.<br />Anime Heavyweight Tees.
            </h2>
            <div className="flex gap-2 mb-4">
              <span className="bg-white/20 border border-white/30 text-white text-xs px-3 py-1 rounded-full">1-of-1 Denim</span>
            </div>
            <Button variant="ghost">Start Shopping</Button>
          </div>
        </div>
      </Section>
    </main>
  );
}
