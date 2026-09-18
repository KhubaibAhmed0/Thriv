import { type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from 'react';

// ── Input ──────────────────────────────────────────────

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-[#111111]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={[
            'w-full bg-white border rounded-[8px] px-4 py-3 text-sm text-[#111111] placeholder:text-[#9A9A9A]',
            'transition-colors duration-150',
            error
              ? 'border-[#8B2020] focus:border-[#8B2020]'
              : 'border-[#E2E0DC] focus:border-[#111111]',
            'outline-none',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        />
        {error && <p className="text-xs text-[#8B2020]">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

// ── Select ────────────────────────────────────────────

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, id, options, placeholder, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-[#111111]">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={[
            'w-full bg-white border rounded-[8px] px-4 py-3 text-sm text-[#111111]',
            'transition-colors duration-150 outline-none appearance-none',
            'bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%239A9A9A\' stroke-width=\'1.5\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")] bg-no-repeat bg-[center_right_1rem] bg-[length:16px_16px] pr-10',
            error
              ? 'border-[#8B2020]'
              : 'border-[#E2E0DC] focus:border-[#111111]',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-[#8B2020]">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';

// ── Textarea ──────────────────────────────────────────

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, id, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-[#111111]">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          rows={3}
          className={[
            'w-full bg-white border rounded-[8px] px-4 py-3 text-sm text-[#111111] placeholder:text-[#9A9A9A] resize-y',
            'transition-colors duration-150 outline-none',
            error
              ? 'border-[#8B2020]'
              : 'border-[#E2E0DC] focus:border-[#111111]',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        />
        {error && <p className="text-xs text-[#8B2020]">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
