import { type ReactNode } from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppStore } from '@/stores/app.store';

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLORS = {
  success: 'border-l-studio-success text-studio-success',
  error: 'border-l-studio-error text-studio-error',
  warning: 'border-l-studio-warning text-studio-warning',
  info: 'border-l-studio-info text-studio-info',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const toasts = useAppStore((s) => s.toasts);
  const removeToast = useAppStore((s) => s.removeToast);

  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={5000}>
      {children}
      {toasts.map((toast) => {
        const Icon = ICONS[toast.type];
        const color = COLORS[toast.type];

        return (
          <ToastPrimitive.Root
            key={toast.id}
            className={clsx(
              'flex items-start gap-3 p-3 rounded-lg shadow-dropdown',
              'bg-studio-surface border border-studio-border border-l-4',
              'data-[state=open]:animate-slide-up data-[state=closed]:animate-fade-out',
              color
            )}
            onOpenChange={(open) => !open && removeToast(toast.id)}
          >
            <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <ToastPrimitive.Title className="text-sm font-medium text-studio-text">
                {toast.title}
              </ToastPrimitive.Title>
              {toast.description && (
                <ToastPrimitive.Description className="text-xs text-studio-text-muted mt-0.5">
                  {toast.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close className="flex-shrink-0 p-0.5 rounded hover:bg-studio-border text-studio-text-muted hover:text-studio-text transition-colors">
              <X className="w-3.5 h-3.5" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        );
      })}

      <ToastPrimitive.Viewport className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]" />
    </ToastPrimitive.Provider>
  );
}
