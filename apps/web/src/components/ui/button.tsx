import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Primary actions are ink-filled. `--signal` (amber) is deliberately absent
 * from every variant: in this system amber means "a date exists" and is
 * reserved for status, never decoration or emphasis.
 */
const buttonVariants = cva(
  'press inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] font-semibold transition-[background-color,color,border-color,box-shadow,transform] duration-[var(--dur-press)] ease-[var(--ease-out)] disabled:pointer-events-none disabled:opacity-45 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-on-ink hover:bg-ink-soft active:bg-ink',
        secondary: 'bg-surface text-ink border border-line hover:bg-surface-sunk hover:border-line-strong',
        outline: 'border border-line-strong text-ink hover:bg-surface',
        ghost: 'text-ink-soft hover:bg-surface hover:text-ink',
        danger: 'bg-alert text-white hover:brightness-95',
        quiet: 'text-muted hover:text-ink hover:bg-surface',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
        iconSm: 'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** In flight. Blocks the press and says so, without moving anything. */
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    /* `asChild` hands rendering to the caller's element, so there is nowhere to
       put the overlay. Loading is ignored rather than half-applied. */
    if (asChild) {
      return (
        <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled} {...props}>
          {children}
        </Comp>
      );
    }

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), loading && 'relative', className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {/* The label stays in the flow and keeps the button its own width, so
            nothing on the row reflows when a mutation starts. It blurs out
            rather than cutting: a crossfade between two sharp states reads as
            two objects swapping, and blur bridges them into one. */}
        <span
          className={cn(
            'inline-flex items-center gap-2 transition-[opacity,filter] duration-[var(--dur-menu)] ease-[var(--ease-out)]',
            loading && 'pointer-events-none opacity-0 blur-[3px]',
          )}
        >
          {children}
        </span>
        {loading ? (
          <span className="absolute inset-0 grid place-items-center">
            <LoaderCircle className="spin-quick size-4" aria-hidden />
          </span>
        ) : null}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
