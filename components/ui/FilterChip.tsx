interface FilterChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  href?: string;
}

export function FilterChip({ label, active = false, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center px-4 py-2 rounded-[9999px] text-sm font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.97]',
        active
          ? 'bg-[#111111] text-white shadow-[0_1px_4px_rgba(0,0,0,0.12)]'
          : 'bg-white text-[#111111] border border-[#E2E0DC] hover:border-[#111111]',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}
