import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@miftach/shared';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { wide?: boolean }
>(({ className, children, wide, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 bg-ink/45 backdrop-blur-[2px] transition-opacity ease-[var(--ease-out)]',
        'data-[state=open]:opacity-100 data-[state=open]:duration-[var(--dur-sheet)]',
        'data-[state=closed]:opacity-0 data-[state=closed]:duration-[var(--dur-exit)]',
      )}
      style={{ zIndex: 'var(--z-backdrop)' }}
    />
    <DialogPrimitive.Content
      ref={ref}
      style={{ zIndex: 'var(--z-modal)' }}
      className={cn(
        'fixed inset-x-0 bottom-0 mx-auto flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[var(--radius-panel)] border border-line bg-bg shadow-2xl',
        'sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:start-1/2 sm:max-h-[86dvh] sm:-translate-y-1/2 sm:translate-x-1/2 sm:rounded-[var(--radius-panel)]',
        /* Sheet from the bottom on phones, centred modal on desktop.
           Modals keep centre origin — they are not anchored to a trigger. */
        'transition-[opacity,transform] ease-[var(--ease-drawer)]',
        'data-[state=open]:duration-[var(--dur-sheet)] data-[state=closed]:duration-[var(--dur-exit)]',
        'data-[state=closed]:opacity-0 data-[state=closed]:translate-y-3 sm:data-[state=closed]:translate-y-[calc(-50%+6px)] sm:data-[state=closed]:scale-[0.985]',
        wide ? 'sm:w-[min(46rem,calc(100vw-3rem))]' : 'sm:w-[min(32rem,calc(100vw-3rem))]',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        aria-label={t.shell.close}
        className="press absolute top-3.5 end-3.5 grid h-8 w-8 place-items-center rounded-[var(--radius-control)] text-muted transition-[color,background-color,transform] duration-[var(--dur-press)] ease-[var(--ease-out)] hover:bg-surface hover:text-ink"
      >
        <X className="h-4 w-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = 'DialogContent';

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-b border-line px-5 py-4 pe-14', className)} {...props} />;
}

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-lg font-bold text-ink', className)} {...props} />
));
DialogTitle.displayName = 'DialogTitle';

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('mt-1 text-sm text-muted', className)} {...props} />
));
DialogDescription.displayName = 'DialogDescription';

export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex-1 overflow-y-auto px-5 py-4', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 border-t border-line bg-surface px-5 py-3.5 sm:flex-row sm:justify-start',
        className,
      )}
      {...props}
    />
  );
}
