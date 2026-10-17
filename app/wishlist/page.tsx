import type { Metadata } from 'next';
import { WishlistPageClient } from '@/components/WishlistPageClient';

export const metadata: Metadata = {
  title: 'Saved Items',
  description: 'Pieces you have saved on thriv.pk.',
  robots: { index: false },
};

export default function WishlistPage() {
  return (
    <main className="min-h-screen bg-page">
      <WishlistPageClient />
    </main>
  );
}
