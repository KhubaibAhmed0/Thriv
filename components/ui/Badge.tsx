import type { Condition } from '@/types';

type BadgeVariant = 'condition' | 'promo' | 'sold-out';

interface BadgeProps {
  variant: BadgeVariant;
  label: string;
}

const conditionStyles: Record<Condition, string> = {
  Premium:
    'bg-[#EDE9E0] text-[#5A4A2F]',
  Excellent:
    'bg-[#E6EDF5] text-[#1E3A5F]',
  'Very Good':
    'bg-[#EAF0EA] text-[#2E5E2E]',
};

export function Badge({ variant, label }: BadgeProps) {
  let cls = 'inline-flex items-center px-2.5 py-0.5 rounded-[9999px] text-xs font-medium ';

  if (variant === 'condition') {
    const cond = label as Condition;
    cls += conditionStyles[cond] ?? 'bg-[#EDEBE8] text-[#444444]';
  } else if (variant === 'promo') {
    cls += 'bg-[#E8F0E0] text-[#3A6B35]';
  } else if (variant === 'sold-out') {
    cls += 'bg-[#F5E6E6] text-[#8B2020]';
  }

  return <span className={cls}>{label}</span>;
}
