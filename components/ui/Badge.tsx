import type { Condition } from '@/types';

type BadgeVariant = 'condition' | 'promo' | 'sold-out';

interface BadgeProps {
  variant: BadgeVariant;
  label: string;
}

const conditionStyles: Record<Condition, string> = {
  Premium:
    'bg-badge-premium-bg text-badge-premium-text',
  Excellent:
    'bg-badge-excellent-bg text-badge-excellent-text',
  'Very Good':
    'bg-badge-verygood-bg text-badge-verygood-text',
};

export function Badge({ variant, label }: BadgeProps) {
  let cls = 'inline-flex items-center px-2.5 py-0.5 rounded-[9999px] text-xs font-medium ';

  if (variant === 'condition') {
    const cond = label as Condition;
    cls += conditionStyles[cond] ?? 'bg-card text-body';
  } else if (variant === 'promo') {
    cls += 'bg-badge-promo-bg text-badge-promo-text';
  } else if (variant === 'sold-out') {
    cls += 'bg-badge-sold-bg text-badge-sold-text';
  }

  return <span className={cls}>{label}</span>;
}
