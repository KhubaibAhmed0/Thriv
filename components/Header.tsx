'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ShoppingBag, Search, Menu, X } from 'lucide-react';
import { useCart } from '@/components/CartProvider';

export function Header() {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  const { totalCount } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const router = useRouter();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/shop?q=${encodeURIComponent(searchQuery.trim())}`);
      setShowSearchInput(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#F5F3F0]/95 backdrop-blur-md border-b border-[#E2E0DC]/60 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Left: Mobile menu toggle + Desktop Nav links */}
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 -ml-2 text-[#111111] hover:text-black focus:outline-none md:hidden"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 stroke-[1.75]" />
              ) : (
                <Menu className="w-5 h-5 stroke-[1.75]" />
              )}
            </button>

            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#444444]">
              <Link
                href="/shop"
                className="hover:text-[#111111] transition-colors"
              >
                Shop
              </Link>
              <Link
                href="/about"
                className="hover:text-[#111111] transition-colors"
              >
                About
              </Link>
              <Link
                href="/faq"
                className="hover:text-[#111111] transition-colors"
              >
                FAQs
              </Link>
              <Link
                href="/styleguide"
                className="text-xs text-[#9A9A9A] hover:text-[#111111] px-2 py-0.5 rounded-full border border-[#E2E0DC] transition-colors"
              >
                Styleguide
              </Link>
            </nav>
          </div>

          {/* Center: Wordmark "thriv" (replacing reference "F fashion") */}
          <div className="flex items-center justify-center">
            <Link
              href="/"
              className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111111] hover:opacity-90 transition-opacity"
            >
              thriv<span className="text-[#9A9A9A] text-lg sm:text-xl font-normal">.pk</span>
            </Link>
          </div>

          {/* Right: Search Pill & Cart */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Search form for desktop / toggle on mobile */}
            <form onSubmit={handleSearchSubmit} className="relative hidden sm:block">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search jeans, tees..."
                className="w-44 md:w-56 bg-white/80 focus:bg-white text-xs text-[#111111] placeholder:text-[#9A9A9A] border border-[#E2E0DC] focus:border-[#111111] rounded-full pl-3.5 pr-8 py-2 outline-none transition-all"
              />
              <button
                type="submit"
                aria-label="Submit search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9A9A9A] hover:text-[#111111] transition-colors"
              >
                <Search className="w-3.5 h-3.5 stroke-[2]" />
              </button>
            </form>

            {/* Mobile search toggle button */}
            <button
              type="button"
              onClick={() => setShowSearchInput(!showSearchInput)}
              aria-label="Search items"
              className="sm:hidden p-2 text-[#111111] hover:bg-[#EDEBE8] rounded-full transition-colors"
            >
              <Search className="w-5 h-5 stroke-[1.75]" />
            </button>

            {/* Cart Bag Pill Button with Live Count */}
            <Link
              href="/cart"
              aria-label={`View cart with ${totalCount} items`}
              className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white border border-[#E2E0DC] hover:border-[#111111] shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition-all active:scale-95"
            >
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-[#111111] stroke-[1.75]" />
              {totalCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-[#111111] text-white text-[10px] font-bold rounded-full shadow-sm animate-in zoom-in-50">
                  {totalCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Mobile Search Input Drawer when toggled */}
        {showSearchInput && (
          <form onSubmit={handleSearchSubmit} className="pb-3 sm:hidden">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search jeans, graphic tees..."
                autoFocus
                className="w-full bg-white text-sm text-[#111111] placeholder:text-[#9A9A9A] border border-[#111111] rounded-full pl-4 pr-10 py-2.5 outline-none"
              />
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#111111]"
              >
                <Search className="w-4 h-4 stroke-[2]" />
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Mobile Nav Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#E2E0DC] bg-[#F5F3F0] px-4 py-5 space-y-3">
          <Link
            href="/shop"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-[#111111] hover:text-black py-1.5"
          >
            All Products
          </Link>
          <Link
            href="/shop?category=jeans"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-[#444444] hover:text-[#111111] py-1.5"
          >
            Curated Jeans (Thrift 1-of-1)
          </Link>
          <Link
            href="/shop?category=graphic-tees"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-[#444444] hover:text-[#111111] py-1.5"
          >
            Graphic T-Shirts (In-House Merch)
          </Link>
          <Link
            href="/about"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-[#444444] hover:text-[#111111] py-1.5"
          >
            About Thriv
          </Link>
          <Link
            href="/faq"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-[#444444] hover:text-[#111111] py-1.5"
          >
            Delivery & FAQs
          </Link>
          <div className="pt-2 border-t border-[#E2E0DC]">
            <Link
              href="/styleguide"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-block text-xs text-[#9A9A9A] hover:text-[#111111] py-1"
            >
              Phase 1 Design Styleguide →
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
