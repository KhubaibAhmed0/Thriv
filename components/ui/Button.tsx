import { type ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'small';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[#111111] text-white font-medium text-sm px-6 py-3 rounded-[9999px] shadow-[0_1px_4px_rgba(0,0,0,0.12)] hover:bg-[#2a2a2a] active:scale-[0.98] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
  outline:
    'bg-transparent text-[#111111] font-medium text-sm px-6 py-3 rounded-[9999px] border border-[#111111] hover:bg-[#111111] hover:text-white active:scale-[0.98] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
  ghost:
    'bg-white/10 text-white font-medium text-sm px-6 py-3 rounded-[9999px] border border-white/60 hover:bg-white/20 active:scale-[0.98] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed',
  small:
    'bg-[#111111] text-white font-medium text-xs px-3 py-1.5 rounded-[9999px] shadow-[0_1px_4px_rgba(0,0,0,0.12)] hover:bg-[#2a2a2a] active:scale-[0.98] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', fullWidth = false, className = '', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={[
          variantClasses[variant],
          fullWidth ? 'w-full' : '',
          'inline-flex items-center justify-center gap-2 cursor-pointer',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
