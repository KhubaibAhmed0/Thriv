'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ShoppingBag, Search, Menu, X, Heart } from 'lucide-react';
import { useCart } from '@/components/CartProvider';
import { useWishlist } from '@/components/WishlistProvider';

export function Header() {
  const pathname = usePathname();
  const { totalCount } = useCart();
  const { count: savedCount } = useWishlist();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const router = useRouter();

  // Escape closes the mobile menu drawer (audit F-86).
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  // Admin screens have their own chrome — render nothing there.
  // (Hooks stay above this early return: audit F-65 — they used to run
  // conditionally, violating the rules of hooks.)
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/shop?q=${encodeURIComponent(searchQuery.trim())}`);
      setShowSearchInput(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-page/95 backdrop-blur-md border-b border-border/60 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex items-center justify-between h-16 sm:h-20">
          
          {/* Left: Mobile menu toggle button + Wordmark "thriv.pk" (black box area) */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-11 h-11 -ml-2.5 flex items-center justify-center text-black hover:text-black md:hidden"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 stroke-[1.75]" />
              ) : (
                <Menu className="w-5 h-5 stroke-[1.75]" />
              )}
            </button>

            <Link
              href="/"
              className="text-2xl sm:text-3xl font-extrabold tracking-tight text-black hover:opacity-90 transition-opacity"
            >
              thriv<span className="text-muted-text text-lg sm:text-xl font-normal">.pk</span>
            </Link>
          </div>

          {/* Center: Desktop Navigation Links (Home, Shop, FAQs, About, Contact) */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-body absolute left-1/2 -translate-x-1/2">
            <Link
              href="/"
              className="hover:text-black transition-colors py-1"
            >
              Home
            </Link>
            <Link
              href="/shop"
              className="hover:text-black transition-colors py-1"
            >
              Shop
            </Link>
            <Link
              href="/faq"
              className="hover:text-black transition-colors py-1"
            >
              FAQs
            </Link>
            <Link
              href="/about"
              className="hover:text-black transition-colors py-1"
            >
              About
            </Link>
            <Link
              href="/contact"
              className="hover:text-black transition-colors py-1"
            >
              Contact
            </Link>
          </nav>

          {/* Right: Search Pill & Cart */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Search form for desktop / toggle on mobile */}
            <form onSubmit={handleSearchSubmit} className="relative hidden sm:block">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search jeans, tees..."
                className="w-44 md:w-56 bg-white/80 focus:bg-white text-xs text-black placeholder:text-muted-text border border-border focus:border-black rounded-full pl-3.5 pr-10 py-2 transition-all"
              />
              <button
                type="submit"
                aria-label="Submit search"
                className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-muted-text hover:text-black transition-colors"
              >
                <Search className="w-3.5 h-3.5 stroke-[2]" />
              </button>
            </form>

            {/* Mobile search toggle button */}
            <button
              type="button"
              onClick={() => setShowSearchInput(!showSearchInput)}
              aria-label="Search items"
              className="sm:hidden p-2 text-black hover:bg-card rounded-full transition-colors"
            >
              <Search className="w-5 h-5 stroke-[1.75]" />
            </button>

            {/* Saved items (wishlist) pill */}
            <Link
              href="/wishlist"
              aria-label={
                savedCount > 0
                  ? `View ${savedCount} saved items`
                  : 'View saved items'
              }
              className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white border border-border hover:border-black shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition-all active:scale-95"
            >
              <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-black stroke-[1.75]" />
              {savedCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-black text-white text-[10px] font-bold rounded-full shadow-sm">
                  {savedCount}
                </span>
              )}
            </Link>

            {/* Cart Bag Pill Button with Live Count */}
            <Link
              href="/cart"
              aria-label={`View cart with ${totalCount} items`}
              className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white border border-border hover:border-black shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition-all active:scale-95"
            >
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-black stroke-[1.75]" />
              {totalCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-black text-white text-[10px] font-bold rounded-full shadow-sm">
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
                className="w-full bg-white text-sm text-black placeholder:text-muted-text border border-black rounded-full pl-4 pr-10 py-2.5"
              />
              <button
                type="submit"
                aria-label="Submit search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-black"
              >
                <Search className="w-4 h-4 stroke-[2]" />
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Mobile Nav Menu Drawer */}
      {mobileMenuOpen && (
        <div id="mobile-menu" className="md:hidden border-t border-border bg-page px-4 py-5 space-y-3">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-black hover:text-black py-1.5"
          >
            Home
          </Link>
          <Link
            href="/shop"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-body hover:text-black py-1.5"
          >
            All Products
          </Link>
          <Link
            href="/shop?category=jeans"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-body hover:text-black py-1.5"
          >
            Curated Jeans (Thrift 1-of-1)
          </Link>
          <Link
            href="/shop?category=graphic-tees"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-body hover:text-black py-1.5"
          >
            Graphic T-Shirts (In-House Merch)
          </Link>
          <Link
            href="/faq"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-body hover:text-black py-1.5"
          >
            Delivery & FAQs
          </Link>
          <Link
            href="/about"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-body hover:text-black py-1.5"
          >
            About Thriv
          </Link>
          <Link
            href="/contact"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-body hover:text-black py-1.5"
          >
            Contact Us
          </Link>
          <Link
            href="/wishlist"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-body hover:text-black py-1.5"
          >
            Saved Items ({savedCount})
          </Link>
        </div>
      )}
    </header>
  );
}
