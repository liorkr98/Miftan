import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
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
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = 'Button';

export { buttonVariants };
