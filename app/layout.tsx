import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { SITE_URL } from '@/lib/site-url';
import { CartProvider } from '@/components/CartProvider';
import { WishlistProvider } from '@/components/WishlistProvider';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { WhatsAppFAB } from '@/components/WhatsAppFAB';

const inter = localFont({
  src: './fonts/Inter-Variable.ttf',
  display: 'swap',
  variable: '--font-inter',
  weight: '100 900',
});

const anton = localFont({
  src: './fonts/Anton-Regular.ttf',
  display: 'swap',
  variable: '--font-display',
  weight: '400',
});

export const metadata: Metadata = {
  title: {
    default: 'thriv | Curated Thrift & Streetwear, Pakistan',
    template: '%s | thriv',
  },
  description:
    'Handpicked, disinfected thrift from H&M, Zara, Bershka, Calvin Klein, and Old Navy. One piece, one price, flat Rs 200 delivery across Pakistan.',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    siteName: 'thriv',
    locale: 'en_PK',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${anton.variable}`}>
      <body className="bg-page text-black font-[var(--font-inter)] antialiased min-h-screen flex flex-col justify-between">
        <CartProvider>
          <WishlistProvider>
            <Header />
            <div id="store-content" tabIndex={-1} className="flex-1">
              {children}
            </div>
            <Footer />
            <WhatsAppFAB />
          </WishlistProvider>
        </CartProvider>
      </body>
    </html>
  );
}
