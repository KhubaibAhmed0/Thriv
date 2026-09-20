import type { Metadata } from 'next';
import OrderDetailClient from '@/components/admin/OrderDetailClient';

export const metadata: Metadata = {
  title: 'Order Detail — Thriv Admin',
  description: 'View order details, customer contact, and fulfill parcel.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  return <OrderDetailClient orderNumber={orderNumber} />;
}
