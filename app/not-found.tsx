import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageCircle, ShoppingBag } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Page Not Found',
};

export default function NotFound() {
  return (
    <main className="min-h-[70vh] flex items-center justify-center bg-page px-4 py-16">
      <div className="max-w-md w-full text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-text mb-3">
          404 &middot; Page Not Found
        </p>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-black leading-[1.08] tracking-tight mb-4">
          This page slipped away.
        </h1>
        <p className="text-sm text-body leading-relaxed mb-8">
          The link may be broken or the piece you were looking for may have sold.
          Thrift items are one-of-one, so once they go, they are gone for good.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/shop"
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-11 bg-black text-white text-sm font-bold px-6 py-3 rounded-full hover:bg-black/85 transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            Browse the Shop
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center w-full sm:w-auto min-h-11 bg-card-inner text-black border border-border hover:border-black text-sm font-semibold px-6 py-3 rounded-full transition-colors"
          >
            Back to Home
          </Link>
        </div>

        <p className="text-xs text-muted-text mt-8">
          Looking for a specific piece?{' '}
          <a
            href="https://wa.me/923248188616?text=Hi+Thriv!+I+am+looking+for+a+piece."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-black underline underline-offset-4 decoration-border hover:decoration-black transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Message us on WhatsApp
          </a>
        </p>
      </div>
    </main>
  );
}
