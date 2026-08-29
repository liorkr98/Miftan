import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-sunk text-ink-soft',
        /* ink text on amber — 8.1:1. White on amber would fail. */
        signal: 'bg-signal text-ink',
        signalSoft: 'bg-signal-soft text-signal-deep',
        live: 'bg-live text-white',
        liveSoft: 'bg-live-soft text-live',
        open: 'bg-open text-white',
        openSoft: 'bg-open-soft text-open',
        alert: 'bg-alert text-white',
        alertSoft: 'bg-alert-soft text-alert',
        outline: 'border border-line text-muted',
      },
      size: {
        sm: 'h-5 px-2 text-2xs',
        md: 'h-6 px-2.5 text-xs',
        lg: 'h-7 px-3 text-sm',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}

export { badgeVariants };
