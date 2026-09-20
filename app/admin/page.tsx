import type { Metadata } from 'next';
import AdminOrdersListClient from '@/components/admin/AdminOrdersListClient';

export const metadata: Metadata = {
  title: 'Orders — Thriv Admin',
  description: 'Manage incoming customer orders and dispatch status.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminPage() {
  return <AdminOrdersListClient />;
}
