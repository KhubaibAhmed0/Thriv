'use client';

import React, { useId } from 'react';
import { ChevronDown } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  dotColor?: string;
}

interface CustomDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  icon?: React.ReactNode;
  /** Kept for call-site compatibility; native selects need no alignment. */
  align?: 'left' | 'right';
  className?: string;
}

/**
 * Filter dropdown rendered as a styled native <select> — keyboard and
 * screen-reader accessible by default (audit F-34) and the single dropdown
 * pattern shared with checkout and admin (audit F-67). The previous custom
 * listbox popover lacked focus handling and ARIA keyboard support.
 */
export function CustomDropdown({
  options,
  value,
  onChange,
  prefix,
  icon,
  className = '',
}: CustomDropdownProps) {
  const selectId = useId();
  const selectedOption = options.find((opt) => opt.value === value) || options[0];
  const isFiltered = value !== 'all' && value !== 'newest';

  const hasLeadingMarker = Boolean(icon || selectedOption?.dotColor);
  const label = prefix ? `${prefix} filter` : 'Filter';

  return (
    <div className={`relative inline-block text-left ${className}`}>
      <label htmlFor={selectId} className="sr-only">
        {label}
      </label>

      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={[
          'inline-flex items-center rounded-full text-xs font-medium transition-all duration-150 cursor-pointer select-none appearance-none',
          'py-1.5 pr-8 pl-3.5',
          hasLeadingMarker ? 'pl-8' : '',
          isFiltered
            ? 'bg-black text-white border border-black shadow-sm'
            : 'bg-white text-black border border-border hover:border-black shadow-[0_1px_2px_rgba(0,0,0,0.03)]',
        ].join(' ')}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {prefix ? `${prefix}: ` : ''}
            {option.label}
          </option>
        ))}
      </select>

      {/* Leading marker (icon and/or grade dot) — decorative overlay */}
      {hasLeadingMarker && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5"
        >
          {icon && (
            <span className={isFiltered ? 'text-white' : 'text-muted-text'}>
              {icon}
            </span>
          )}
          {selectedOption?.dotColor && (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: selectedOption.dotColor }}
            />
          )}
        </span>
      )}

      <ChevronDown
        aria-hidden="true"
        className={[
          'pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 shrink-0',
          isFiltered ? 'text-white/80' : 'text-muted-text',
        ].join(' ')}
      />
    </div>
  );
}
