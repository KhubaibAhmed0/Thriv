'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RotateCcw, ShoppingBag } from 'lucide-react';

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error('[thriv] route error:', error);
  }, [error]);

  return (
    <main className="min-h-[70vh] flex items-center justify-center bg-page px-4 py-16">
      <div className="max-w-md w-full text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-text mb-3">
          Something went wrong
        </p>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-black leading-[1.08] tracking-tight mb-4">
          This page hit a snag.
        </h1>
        <p className="text-sm text-body leading-relaxed mb-8">
          An unexpected error interrupted this page. Your cart is saved on this
          device. Try again, or head back to the shop.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-11 bg-black text-white text-sm font-bold px-6 py-3 rounded-full hover:bg-black/85 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
          <Link
            href="/shop"
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-11 bg-card-inner text-black border border-border hover:border-black text-sm font-semibold px-6 py-3 rounded-full transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            Browse the Shop
          </Link>
        </div>

        {error.digest && (
          <p className="text-[11px] text-muted-text mt-8 font-mono">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
