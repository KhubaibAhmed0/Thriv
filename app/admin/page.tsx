import type { Metadata } from 'next';
import AdminDashboardClient from '@/components/AdminDashboardClient';

export const metadata: Metadata = {
  title: 'Thriv Admin Portal — Order Management & Dispatch',
  description: 'Manage customer orders, update dispatch status, and send 1-click WhatsApp confirmations.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminPage() {
  return <AdminDashboardClient />;
}
