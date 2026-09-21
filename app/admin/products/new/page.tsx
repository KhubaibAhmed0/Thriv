import type { Metadata } from 'next';
import { AddProductForm } from '@/components/admin/AddProductForm';

export const metadata: Metadata = {
  title: 'Add New Item — Thriv Admin',
  description: 'Upload photos, configure pricing, and list a new thrift or merch item.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AddProductPage() {
  return <AddProductForm />;
}
