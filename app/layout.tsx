import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { CartProvider } from '@/components/CartProvider';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { WhatsAppFAB } from '@/components/WhatsAppFAB';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['300', '400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: {
    default: 'thriv — Curated Thrift & Streetwear, Pakistan',
    template: '%s — thriv',
  },
  description:
    'Handpicked, disinfected thrift from H&M, Zara, Bershka, Calvin Klein, and Old Navy. One piece, one price, flat Rs 200 delivery across Pakistan.',
  metadataBase: new URL('https://thriv.pk'),
  openGraph: {
    siteName: 'thriv',
    locale: 'en_PK',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-[#F5F3F0] text-[#111111] font-[var(--font-inter)] antialiased min-h-screen flex flex-col justify-between">
        <CartProvider>
          <Header />
          <div className="flex-1">
            {children}
          </div>
          <Footer />
          <WhatsAppFAB />
        </CartProvider>
      </body>
    </html>
  );
}
