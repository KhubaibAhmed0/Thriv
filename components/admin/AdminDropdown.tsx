'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface AdminDropdownOption {
  value: string;
  label: string;
  sublabel?: string;
  /** Kept for data compatibility; native <option> rows cannot render dots. */
  dotColor?: string;
}

interface AdminDropdownProps {
  options: AdminDropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** id applied to the <select> so an external <label htmlFor> works (F-35). */
  id?: string;
  /** Renders the error styling + aria-invalid when true (F-36). */
  invalid?: boolean;
  /** id of an error message element to describe this control (F-36). */
  describedBy?: string;
}

/**
 * Admin dropdown — audit F-34/F-67: the custom listbox was replaced with a
 * native styled <select>. Keyboard support, screen-reader semantics and
 * mobile pickers come from the platform instead of hand-rolled ARIA.
 */
export function AdminDropdown({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  className = '',
  disabled = false,
  id,
  invalid = false,
  describedBy,
}: AdminDropdownProps) {
  const hasValue = options.some((option) => option.value === value);

  return (
    <div className={`relative w-full ${className}`}>
      <select
        id={id}
        value={hasValue ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid && describedBy ? describedBy : undefined}
        className={`w-full appearance-none bg-admin-field border rounded-[12px] pl-3.5 pr-10 py-2.5 text-sm text-white transition-colors cursor-pointer outline-none focus:border-neutral-400 disabled:opacity-50 disabled:cursor-not-allowed ${
          invalid ? 'border-rose-500/60' : 'border-admin-line-strong'
        }`}
      >
        {!hasValue && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.sublabel ? `${option.label} — ${option.sublabel}` : option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"
        aria-hidden="true"
      />
    </div>
  );
}
