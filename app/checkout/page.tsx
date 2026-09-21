import type { Metadata } from 'next';
import { CheckoutForm } from '@/components/CheckoutForm';

export const metadata: Metadata = {
  title: 'Checkout | thriv',
  description: 'Complete your Thriv order. Flat Rs 200 delivery nationwide across Pakistan.',
};

export default function CheckoutPage() {
  return (
    <main className="min-h-screen bg-[#F5F3F0]">
      <CheckoutForm />
    </main>
  );
}
