import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * Empty states are invitations, not shrugs: every one names what would fill
 * it and offers the action that does so.
 */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  onAction,
  className,
  compact,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  action?: string;
  onAction?: () => void;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line text-center',
        compact ? 'gap-1.5 px-4 py-6' : 'gap-2 px-6 py-12',
        className,
      )}
    >
      {Icon ? (
        <Icon className={cn('text-line-strong', compact ? 'mb-0.5 h-5 w-5' : 'mb-1 h-7 w-7')} />
      ) : null}
      <p className={cn('font-bold text-ink', compact ? 'text-xs' : 'text-sm')}>{title}</p>
      {hint ? (
        <p className={cn('max-w-sm text-muted', compact ? 'text-2xs leading-4' : 'text-xs leading-5')}>
          {hint}
        </p>
      ) : null}
      {action && onAction ? (
        <Button size="sm" className="mt-2" onClick={onAction}>
          {action}
        </Button>
      ) : null}
    </div>
  );
}
