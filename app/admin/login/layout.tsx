import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Sign In | Thriv',
  description: 'Thriv staff sign-in.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
