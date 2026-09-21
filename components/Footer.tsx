'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, ShieldCheck, Truck, Sparkles } from 'lucide-react';

export function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <footer className="mt-20 border-t border-[#E2E0DC] bg-[#EDEBE8] text-[#111111]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        
        {/* Top Trust Banner within Footer */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-12 border-b border-[#E2E0DC]">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles className="w-5 h-5 text-[#111111]" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#111111]">One-of-One Curated Thrift</h4>
              <p className="text-xs text-[#444444] mt-1 leading-relaxed">
                Handpicked branded denim and streetwear. Every piece is cleaned and disinfected before listing.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
              <Truck className="w-5 h-5 text-[#111111]" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#111111]">Flat Rs 200 Nationwide</h4>
              <p className="text-xs text-[#444444] mt-1 leading-relaxed">
                Direct dispatch from Karachi to all cities across Pakistan with courier tracking.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
              <ShieldCheck className="w-5 h-5 text-[#111111]" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#111111]">Final Sale Policy</h4>
              <p className="text-xs text-[#444444] mt-1 leading-relaxed">
                All sales are strictly final: no returns or exchanges due to unique one-of-one stock.
              </p>
            </div>
          </div>
        </div>

        {/* Main Footer Links */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-12">
          
          {/* Brand Column */}
          <div className="md:col-span-4">
            <Link href="/" className="text-2xl font-black text-[#111111]">
              thriv<span className="text-[#9A9A9A] font-normal text-lg">.pk</span>
            </Link>
            <p className="text-xs text-[#444444] mt-3 leading-relaxed max-w-sm">
              Karachi-based thrift & curated streetwear. Authentic branded denim (Zara, Bershka, H&M, Calvin Klein, Old Navy) and in-house anime graphic tees.
            </p>
            <div className="mt-4 flex items-center gap-3 text-xs text-[#444444]">
              <span>Follow us:</span>
              <a
                href="https://instagram.com/thriv.pk"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 font-semibold text-[#111111] hover:underline"
              >
                @thriv.pk <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div className="md:col-span-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-[#9A9A9A] mb-4">
              Catalog
            </h5>
            <ul className="space-y-2.5 text-sm text-[#444444]">
              <li>
                <Link href="/shop" className="hover:text-[#111111] transition-colors">
                  All Products
                </Link>
              </li>
              <li>
                <Link href="/shop?category=jeans" className="hover:text-[#111111] transition-colors">
                  Curated Jeans (Thrift 1-of-1)
                </Link>
              </li>
              <li>
                <Link href="/shop?category=graphic-tees" className="hover:text-[#111111] transition-colors">
                  Graphic T-Shirts (In-House Merch)
                </Link>
              </li>
              <li>
                <Link href="/cart" className="hover:text-[#111111] transition-colors">
                  Your Cart
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Care */}
          <div className="md:col-span-2">
            <h5 className="text-xs font-bold uppercase tracking-wider text-[#9A9A9A] mb-4">
              Customer Care
            </h5>
            <ul className="space-y-2.5 text-sm text-[#444444]">
              <li>
                <Link href="/about" className="hover:text-[#111111] transition-colors">
                  About Thriv
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-[#111111] transition-colors">
                  FAQs & Delivery
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-[#111111] transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-[#111111] transition-colors text-xs text-[#9A9A9A]">
                  Admin Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Accepted Payments & Note */}
          <div className="md:col-span-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-[#9A9A9A] mb-4">
              Payment Methods
            </h5>
            <div className="flex flex-wrap gap-2 text-xs text-[#444444]">
              <span className="px-2.5 py-1 rounded-full bg-white border border-[#E2E0DC]">
                Cash on Delivery
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white border border-[#E2E0DC]">
                Bank Transfer
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white border border-[#E2E0DC]">
                EasyPaisa
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white border border-[#E2E0DC]">
                JazzCash
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white border border-[#E2E0DC] text-[#9A9A9A]">
                Card (Coming Soon)
              </span>
            </div>
            <p className="text-[11px] text-[#9A9A9A] mt-4">
              Direct WhatsApp order confirmation after checkout.
            </p>
          </div>

        </div>

        {/* Bottom copyright & disclaimer */}
        <div className="mt-12 pt-8 border-t border-[#E2E0DC] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#9A9A9A]">
          <p>© {new Date().getFullYear()} Thriv (@thriv.pk). All rights reserved. Karachi, Pakistan.</p>
          <p>Strictly no returns or exchanges on one-of-one vintage items.</p>
        </div>

      </div>
    </footer>
  );
}
