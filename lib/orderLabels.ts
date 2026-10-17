/**
 * Order presentation single-source (audit F-60).
 *
 * These maps used to live four-to-six times across the customer confirmation
 * page and both admin screens, so every copy tweak had to be repeated and
 * silently drifted when it was not. Edit here once.
 */

import { CheckCircle2, Clock, Truck, XCircle } from 'lucide-react';
import type { ComponentType } from 'react';

/** Customer-facing labels (confirmation page). Keys cover DB enums and client ids. */
export const PAYMENT_LABELS: Record<string, string> = {
  'cash-on-delivery': 'Cash on Delivery',
  cod: 'Cash on Delivery',
  'bank-transfer': 'Bank Transfer',
  bank_transfer: 'Bank Transfer',
  easypaisa: 'EasyPaisa',
  jazzcash: 'JazzCash',
  card: 'Card',
};

/** Compact badge labels (admin orders list). */
export const PAYMENT_LABELS_ADMIN_SHORT: Record<string, string> = {
  ...PAYMENT_LABELS,
  'cash-on-delivery': 'COD',
  cod: 'COD',
};

/** Long-form labels (admin order detail). */
export const PAYMENT_LABELS_ADMIN_LONG: Record<string, string> = {
  ...PAYMENT_LABELS,
  'cash-on-delivery': 'Cash on Delivery (COD)',
  cod: 'Cash on Delivery (COD)',
  'bank-transfer': 'Faysal Bank Transfer',
  bank_transfer: 'Faysal Bank Transfer',
};

const VARIANT_MAPS = {
  customer: PAYMENT_LABELS,
  list: PAYMENT_LABELS_ADMIN_SHORT,
  detail: PAYMENT_LABELS_ADMIN_LONG,
} as const;

export type PaymentLabelVariant = keyof typeof VARIANT_MAPS;

/** Look up a payment label; returns undefined for unknown or missing values. */
export function paymentLabel(
  value: string | null | undefined,
  variant: PaymentLabelVariant = 'customer'
): string | undefined {
  if (!value) return undefined;
  return VARIANT_MAPS[variant][value];
}

/** DB enum values → the ids the customer UI speaks. */
export const ENUM_TO_CLIENT: Record<string, string> = {
  cod: 'cash-on-delivery',
  bank_transfer: 'bank-transfer',
  easypaisa: 'easypaisa',
  jazzcash: 'jazzcash',
  card: 'card',
};

/** Admin status badge styling (orders list + order detail). */
export const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    bg: string;
    text: string;
    border: string;
    icon: ComponentType<{ className?: string }>;
  }
> = {
  new: {
    label: 'New',
    bg: 'bg-amber-500/10',
    text: 'text-amber-500',
    border: 'border-amber-500/30',
    icon: Clock,
  },
  confirmed: {
    label: 'Confirmed',
    bg: 'bg-neutral-800',
    text: 'text-neutral-200',
    border: 'border-neutral-700',
    icon: CheckCircle2,
  },
  shipped: {
    label: 'Shipped',
    bg: 'bg-sky-500/10',
    text: 'text-sky-400',
    border: 'border-sky-500/30',
    icon: Truck,
  },
  delivered: {
    label: 'Delivered',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    icon: CheckCircle2,
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'bg-neutral-900',
    text: 'text-neutral-500 line-through',
    border: 'border-neutral-800',
    icon: XCircle,
  },
};
