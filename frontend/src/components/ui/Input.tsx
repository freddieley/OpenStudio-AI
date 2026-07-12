import { forwardRef, type InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftAddon, rightAddon, id, ...props }, ref) => {
    const inputId = id ?? `input-${Math.random().toString(36).slice(2)}`;

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-studio-text">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftAddon && (
            <div className="absolute left-2.5 flex items-center text-studio-text-muted pointer-events-none">
              {leftAddon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={clsx(
              'w-full rounded bg-studio-bg border border-studio-border',
              'text-sm text-studio-text placeholder:text-studio-text-muted',
              'px-2.5 py-1.5 h-8',
              'focus:outline-none focus:border-studio-accent focus:ring-1 focus:ring-studio-accent',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors',
              error && 'border-studio-error focus:border-studio-error focus:ring-studio-error',
              leftAddon && 'pl-8',
              rightAddon && 'pr-8',
              className
            )}
            {...props}
          />
          {rightAddon && (
            <div className="absolute right-2.5 flex items-center text-studio-text-muted">
              {rightAddon}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-studio-error">{error}</p>}
        {hint && !error && <p className="text-xs text-studio-text-muted">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
export { Input };
