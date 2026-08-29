import * as React from 'react';
import { cn } from '@/lib/utils';
import { Money, Num } from './typography';

/** Recharts tooltips are LTR by default; this keeps them Hebrew and isolated. */
export function ChartTooltip({
  active,
  label,
  rows,
}: {
  active?: boolean;
  label?: React.ReactNode;
  rows: { key: string; label: string; value: number; color: string; money?: boolean }[];
}) {
  if (!active) return null;
  return (
    <div className="rounded-[var(--radius-control)] border border-line bg-bg px-3 py-2 shadow-lg">
      {label ? <p className="mb-1 text-2xs font-bold text-ink">{label}</p> : null}
      <ul className="space-y-0.5">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2 text-2xs">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: row.color }} />
            <span className="text-muted">{row.label}</span>
            <span className="ms-auto font-bold text-ink">
              {row.money ? <Money value={row.value} board /> : <Num board>{row.value}</Num>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const AXIS = {
  stroke: 'var(--color-line)',
  tick: { fill: 'var(--color-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' },
} as const;

export function ChartFrame({
  title,
  aside,
  children,
  className,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-[var(--radius-card)] border border-line p-4', className)}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
