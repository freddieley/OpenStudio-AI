import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-accent',
    'disabled:opacity-50 disabled:pointer-events-none select-none',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-studio-accent text-white hover:bg-studio-accent-hover active:bg-studio-accent-hover',
        secondary: 'bg-studio-surface text-studio-text border border-studio-border hover:bg-studio-muted active:bg-studio-muted',
        ghost: 'text-studio-text-muted hover:bg-studio-surface hover:text-studio-text active:bg-studio-muted',
        danger: 'bg-studio-error/10 text-studio-error border border-studio-error/30 hover:bg-studio-error/20',
        success: 'bg-studio-success/10 text-studio-success border border-studio-success/30 hover:bg-studio-success/20',
        outline: 'border border-studio-border text-studio-text hover:bg-studio-surface',
        link: 'text-studio-accent hover:text-studio-accent-light underline-offset-4 hover:underline p-0',
      },
      size: {
        xs: 'text-xs px-2 py-0.5 h-6',
        sm: 'text-xs px-2.5 py-1 h-7',
        md: 'text-sm px-3 py-1.5 h-8',
        lg: 'text-sm px-4 py-2 h-9',
        xl: 'text-base px-5 py-2.5 h-11',
        icon: 'w-8 h-8 p-0',
        'icon-sm': 'w-7 h-7 p-0',
        'icon-xs': 'w-6 h-6 p-0',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  }
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(buttonVariants({ variant, size }), className)}
        disabled={disabled ?? loading}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
export { Button, buttonVariants };
