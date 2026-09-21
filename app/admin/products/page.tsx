import type { Metadata } from 'next';
import AdminProductsListClient from '@/components/admin/AdminProductsListClient';

export const metadata: Metadata = {
  title: 'Inventory — Thriv Admin',
  description: 'Manage store products, stock levels, and item listings.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminProductsPage() {
  return <AdminProductsListClient />;
}
