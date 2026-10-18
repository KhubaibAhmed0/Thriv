'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { useCurrentProduct } from '@/lib/currentProduct';

const WHATSAPP_NUMBER = '923248188616';
const GENERIC_MESSAGE = 'Hello Thriv! I have a question about an item.';

/** Screens whose bottom-right corner has real CTAs: FAB shrinks to a circle. */
const COMPACT_PREFIXES = ['/shop', '/cart', '/checkout', '/order'];

export function WhatsAppFAB() {
  const pathname = usePathname();
  const currentProduct = useCurrentProduct();

  if (pathname === '/' || pathname?.startsWith('/admin')) {
    return null;
  }

  const onProductPage = pathname?.startsWith('/product/');
  const compact =
    onProductPage ||
    COMPACT_PREFIXES.some((prefix) => pathname?.startsWith(prefix));

  // On a PDP, pre-fill the chat with the exact piece (audit F-75).
  const message =
    onProductPage && currentProduct
      ? `Hi Thriv! Is this piece available? ${currentProduct.brand} — ${currentProduct.name}` +
        (currentProduct.size ? ` (size ${currentProduct.size})` : '') +
        (currentProduct.condition ? `, grade ${currentProduct.condition}` : '') +
        ' — seen on thriv.pk'
      : GENERIC_MESSAGE;

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

  return (
    <aside aria-label="Support">
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        // Expanded pill shows "WhatsApp Support": the accessible name must
        // contain that visible text (WCAG 2.5.3 / Lighthouse).
        aria-label={
          compact
            ? 'Chat with Thriv on WhatsApp'
            : 'WhatsApp Support — chat with Thriv'
        }
        className={[
          'fixed z-50 flex items-center justify-center rounded-full',
          // Safe-area aware: clears the iOS home indicator (audit F-74).
          'bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-4 sm:right-6',
          'bg-black text-white shadow-[0_4px_16px_rgba(0,0,0,0.2)]',
          'border border-white/20 transition-all duration-200 hover:scale-105 active:scale-95 group',
          compact ? 'w-14 h-14' : 'gap-2.5 px-4 py-3',
        ].join(' ')}
      >
        {!compact && (
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        )}
        <MessageCircle className={compact ? 'w-6 h-6 stroke-[2]' : 'w-4 h-4 stroke-[2]'} />
        {!compact && (
          <span className="text-xs font-semibold tracking-wide">
            WhatsApp Support
          </span>
        )}
      </a>
    </aside>
  );
}
