'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Heart, Menu, Search, ShoppingBag, X } from 'lucide-react';
import { useCart } from '@/components/CartProvider';
import { useWishlist } from '@/components/WishlistProvider';

const nav = [{ href: '/shop', label: 'Shop' }, { href: '/about', label: 'About' }, { href: '/faq', label: 'FAQs' }];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { totalCount } = useCart();
  const { count } = useWishlist();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchButton = useRef<HTMLButtonElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const home = pathname === '/';

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (searchOpen) { setSearchOpen(false); searchButton.current?.focus(); }
      if (menuOpen) { setMenuOpen(false); menuButton.current?.focus(); }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [searchOpen, menuOpen]);

  if (pathname?.startsWith('/admin')) return null;
  const closePanels = () => { setMenuOpen(false); setSearchOpen(false); };
  return (
    <header className={`store-header ${home ? 'store-header-home' : ''}`}>
      <a href={home ? '#main-content' : '#store-content'} className="store-skip-link">Skip to content</a>
      <div className="store-header-inner">
        <button ref={menuButton} type="button" className="store-icon store-menu-toggle" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="store-mobile-menu" onClick={() => { setMenuOpen(!menuOpen); setSearchOpen(false); }}>
          {menuOpen ? <X size={21} strokeWidth={1.5} /> : <Menu size={21} strokeWidth={1.5} />}
        </button>
        <Link href="/" className="store-wordmark" onClick={closePanels} aria-label="Thriv home">thriv<span>.pk</span></Link>
        <nav className="store-desktop-nav" aria-label="Main navigation">{nav.map(({ href, label }) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined} onClick={closePanels}>{label}</Link>)}</nav>
        <div className="store-header-actions">
          <button ref={searchButton} type="button" className="store-icon" aria-label="Search items" aria-expanded={searchOpen} aria-controls="store-search" onClick={() => { setSearchOpen(!searchOpen); setMenuOpen(false); }}>{searchOpen ? <X size={19} strokeWidth={1.5} /> : <Search size={19} strokeWidth={1.5} />}</button>
          <Link href="/wishlist" className="store-icon" aria-label={count ? `View ${count} saved items` : 'View saved items'} onClick={closePanels}><Heart size={19} strokeWidth={1.5} />{count > 0 && <span className="store-count">{count}</span>}</Link>
          <Link href="/cart" className="store-icon" aria-label={`View cart with ${totalCount} items`} onClick={closePanels}><ShoppingBag size={19} strokeWidth={1.5} />{totalCount > 0 && <span className="store-count">{totalCount}</span>}</Link>
        </div>
      </div>
      {searchOpen && <form id="store-search" className="store-search" role="search" onSubmit={(event) => {
        event.preventDefault();
        if (query.trim()) { router.push(`/shop?q=${encodeURIComponent(query.trim())}`); closePanels(); }
      }}>
        <label htmlFor="store-query">Find your next piece</label>
        <div><input id="store-query" autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search jeans, graphic tees..." required /><button type="submit" className="home-button">Search <Search size={16} /></button></div>
      </form>}
      {menuOpen && <nav id="store-mobile-menu" className="store-mobile-nav" aria-label="Mobile navigation">{[...nav, { href: '/shop?category=jeans', label: 'Curated denim' }, { href: '/shop?category=graphic-tees', label: 'Anime graphic tees' }, { href: '/contact', label: 'Contact' }].map(({ href, label }) => <Link key={href} href={href} onClick={closePanels}>{label}</Link>)}</nav>}
    </header>
  );
}
