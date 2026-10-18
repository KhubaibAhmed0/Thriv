'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, AtSign, MessageCircle } from 'lucide-react';

export function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) return null;
  return (
    <footer className={`store-footer ${pathname === '/' ? 'store-footer-home' : ''}`}>
      <div className="store-footer-panel">
        <h2 className="sr-only">Thriv links and contact</h2>
        <div className="store-footer-top">
          <div className="store-footer-contact"><p>Karachi, Pakistan.<br />Curated here. Worn everywhere.</p><a href="tel:+923248188616">0324-8188616</a><a href="mailto:admin@thriv.pk">admin@thriv.pk</a><p>Flat Rs 200 nationwide.<br />All sales final.</p></div>
          <nav aria-label="Catalogue"><h3>Explore</h3><Link href="/shop">All products</Link><Link href="/shop?category=jeans">Curated denim</Link><Link href="/shop?category=graphic-tees">Graphic tees</Link><Link href="/wishlist">Saved items</Link></nav>
          <nav aria-label="Customer care"><h3>Good to know</h3><Link href="/about">About Thriv</Link><Link href="/faq">Delivery &amp; FAQs</Link><Link href="/contact">Contact us</Link><Link href="/cart">Your cart</Link></nav>
          <div className="store-footer-social"><h3 className="home-display">Don&apos;t miss<br />the next drop.</h3><p>One-of-one pieces go quickly.<br />Follow along for what&apos;s next.</p><a href="https://instagram.com/thriv.pk" target="_blank" rel="noopener noreferrer" className="store-social-link">Follow @thriv.pk <ArrowUpRight size={16} /></a><a href="https://wa.me/923248188616?text=Hello%20Thriv!%20I%20have%20a%20question%20about%20an%20item." target="_blank" rel="noopener noreferrer" className="store-social-link">Message on WhatsApp <ArrowUpRight size={16} /></a></div>
        </div>
        <div className="store-footer-bottom"><div className="store-footer-icons"><a href="https://instagram.com/thriv.pk" target="_blank" rel="noopener noreferrer" aria-label="Thriv on Instagram"><AtSign size={18} strokeWidth={1.5} /></a><a href="https://wa.me/923248188616" target="_blank" rel="noopener noreferrer" aria-label="Thriv on WhatsApp"><MessageCircle size={18} strokeWidth={1.5} /></a></div><p>© {new Date().getFullYear()} Thriv. All rights reserved.</p><span>One piece. One of you.</span></div>
        <Link href="/" className="store-footer-wordmark" aria-label="Thriv home">thriv<span>.pk</span></Link>
      </div>
    </footer>
  );
}
