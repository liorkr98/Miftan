import * as React from 'react';
import { cn } from '@/lib/utils';
import { formatAgorot, formatMoney, formatPhone, telHref } from '@miftan/shared';

/**
 * Mixed-direction text is the single most common RTL bug. Every LTR island
 * — money, phone numbers, dates, Latin vendor names — goes through one of
 * these, which wrap it in dir="ltr" + unicode-bidi: isolate.
 */

/**
 * Money, in exactly one of two units.
 *
 * `value` is shekels and `agorot` is agorot, and the component takes one or the
 * other. Two named props rather than one plus a flag, because the failure this
 * guards against is passing 840000 where 8400 was meant — which renders as
 * ₪840,000 and looks entirely plausible. A name you have to choose is harder to
 * get wrong than a boolean you can forget.
 */
export function Money({
  value,
  agorot,
  precise,
  board,
  className,
}: {
  value?: number;
  agorot?: number;
  precise?: boolean;
  /** Use the mono board face — tables, the departures track, tabular columns */
  board?: boolean;
  className?: string;
} & ({ value: number } | { agorot: number })) {
  return (
    <span dir="ltr" className={cn(board ? 'num-board' : 'num', className)}>
      {agorot !== undefined ? formatAgorot(agorot) : formatMoney(value ?? 0, precise)}
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
