import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OrderConfirmationClient } from '@/components/OrderConfirmationClient';

const PUBLIC_TOKEN_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface OrderPageProps {
  params: Promise<{ publicToken: string }>;
}

/**
 * Metadata never embeds the token (no leaking the confirmation key into tab
 * titles, shares, or history) and the page is never indexed (brief 4: the
 * token is a bearer key).
 */
export const metadata: Metadata = {
  // The root layout appends '| thriv' via its title template.
  title: 'Order Confirmed',
  description: 'Your Thriv order has been placed. Check WhatsApp for confirmation.',
  robots: { index: false, follow: false },
};

export default async function OrderPage({ params }: OrderPageProps) {
  const { publicToken } = await params;

  // Only real token shapes render; old /order/THR-... links 404.
  if (!PUBLIC_TOKEN_RE.test(publicToken)) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-page">
      <OrderConfirmationClient publicToken={publicToken} />
    </main>
  );
}
