import { type ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[90vw]',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}: ModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/60 animate-fade-in" />
        <DialogPrimitive.Content
          className={clsx(
            'fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
            'w-full flex flex-col max-h-[85vh]',
            'bg-studio-surface border border-studio-border rounded-xl shadow-modal',
            'animate-scale-in',
            SIZE_CLASSES[size],
            className
          )}
        >
          {/* Header */}
          {(title ?? description) && (
            <div className="flex items-start justify-between p-5 border-b border-studio-border">
              <div>
                {title && (
                  <DialogPrimitive.Title className="text-base font-semibold text-studio-text">
                    {title}
                  </DialogPrimitive.Title>
                )}
                {description && (
                  <DialogPrimitive.Description className="text-sm text-studio-text-muted mt-1">
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
              <DialogPrimitive.Close
                className="p-1 rounded hover:bg-studio-border text-studio-text-muted hover:text-studio-text transition-colors"
                onClick={onClose}
              >
                <X className="w-4 h-4" />
              </DialogPrimitive.Close>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="flex items-center justify-end gap-2 p-4 border-t border-studio-border">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
