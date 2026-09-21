'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';

export function WhatsAppFAB() {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  const whatsappNumber = '923248188616'; // Client official WhatsApp
  const defaultText = encodeURIComponent('Hello Thriv! I have a question about an item.');
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${defaultText}`;

  return (
    <aside aria-label="Support">
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with Thriv on WhatsApp"
        className={[
          'fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-full',
          'bg-[#111111] text-white hover:bg-black shadow-[0_4px_16px_rgba(0,0,0,0.2)]',
          'border border-white/20 transition-all duration-200 hover:scale-105 active:scale-95 group',
        ].join(' ')}
      >
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <MessageCircle className="w-4 h-4 stroke-[2]" />
        <span className="text-xs font-semibold tracking-wide">WhatsApp Support</span>
      </a>
    </aside>
  );
}
