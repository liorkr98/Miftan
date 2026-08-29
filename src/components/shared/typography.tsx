import * as React from 'react';
import { cn } from '@/lib/utils';
import { formatMoney, formatPhone, telHref } from '@/lib/format';

/**
 * Mixed-direction text is the single most common RTL bug. Every LTR island
 * — money, phone numbers, dates, Latin vendor names — goes through one of
 * these, which wrap it in dir="ltr" + unicode-bidi: isolate.
 */

export function Money({
  value,
  precise,
  board,
  className,
}: {
  value: number;
  precise?: boolean;
  /** Use the mono board face — tables, the departures track, tabular columns */
  board?: boolean;
  className?: string;
}) {
  return (
    <span dir="ltr" className={cn(board ? 'num-board' : 'num', className)}>
      {formatMoney(value, precise)}
    </span>
  );
}

export function Num({
  children,
  board,
  className,
}: {
  children: React.ReactNode;
  board?: boolean;
  className?: string;
}) {
  return (
    <span dir="ltr" className={cn(board ? 'num-board' : 'num', className)}>
      {children}
    </span>
  );
}

export function Phone({ value, className }: { value: string; className?: string }) {
  return (
    <a
      dir="ltr"
      href={telHref(value)}
      className={cn('num underline-offset-2 hover:underline', className)}
    >
      {formatPhone(value)}
    </a>
  );
}

/** Latin brand/vendor names inside Hebrew sentences */
export function Ltr({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span dir="ltr" className={className}>
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-extrabold tracking-[-0.01em] text-ink">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionTitle({
  children,
  aside,
  className,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-3 flex items-baseline justify-between gap-3', className)}>
      <h2 className="text-sm font-bold text-ink">{children}</h2>
      {aside}
    </div>
  );
}
