import type { Metadata } from 'next';
import { OrderConfirmationClient } from '@/components/OrderConfirmationClient';

interface OrderPageProps {
  params: Promise<{ orderNumber: string }>;
}

export async function generateMetadata({ params }: OrderPageProps): Promise<Metadata> {
  const { orderNumber } = await params;
  return {
    title: `Order ${orderNumber} Confirmed | thriv`,
    description: 'Your Thriv order has been placed. Check WhatsApp for confirmation.',
  };
}

export default async function OrderPage({ params }: OrderPageProps) {
  const { orderNumber } = await params;

  return (
    <main className="min-h-screen bg-[#F5F3F0]">
      <OrderConfirmationClient orderNumber={orderNumber} />
    </main>
  );
}
