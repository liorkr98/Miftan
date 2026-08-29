import { cn } from '@/lib/utils';

/** A single proportion bar. Used for collection rate and occupancy — one
 *  honest bar beats four identical stat cards. */
export function Meter({
  value,
  max,
  tone = 'ink',
  className,
  label,
}: {
  value: number;
  max: number;
  tone?: 'ink' | 'open' | 'signal' | 'alert';
  className?: string;
  label?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fill = {
    ink: 'bg-ink',
    open: 'bg-open',
    signal: 'bg-signal',
    alert: 'bg-alert',
  }[tone];

  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-sunk', className)}
      role="meter"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out-quint)]', fill)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
