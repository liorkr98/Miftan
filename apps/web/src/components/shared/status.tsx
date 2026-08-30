import * as React from 'react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Num } from './typography';
import { t, formatDate, formatUntil, type AvailabilityConfidence, type LeadStage, type Severity, type TicketStatus, type UnitStatus } from '@miftan/shared';
import type { AvailabilityKind } from '@/data/selectors';
import { CalendarClock, CircleDot, Clock3, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * One place decides what colour a domain concept is. The rule the whole
 * palette hangs on: warm (amber/red) = something is coming up or needs a
 * person; cool (blue) = settled, nothing to do; green = open now.
 */

const UNIT_TONE: Record<UnitStatus, BadgeProps['tone']> = {
  occupied: 'liveSoft',
  vacant: 'openSoft',
  vacating: 'signalSoft',
  renovating: 'neutral',
};

export function UnitStatusBadge({ status, size }: { status: UnitStatus; size?: BadgeProps['size'] }) {
  return (
    <Badge tone={UNIT_TONE[status]} size={size}>
      {t.status[status]}
    </Badge>
  );
}

const TICKET_TONE: Record<TicketStatus, BadgeProps['tone']> = {
  new: 'alertSoft',
  approved: 'neutral',
  assigned: 'liveSoft',
  in_progress: 'liveSoft',
  awaiting_receipt: 'signalSoft',
  closed: 'openSoft',
};

export function TicketStatusBadge({ status, size }: { status: TicketStatus; size?: BadgeProps['size'] }) {
  return (
    <Badge tone={TICKET_TONE[status]} size={size}>
      {t.ticketStatus[status]}
    </Badge>
  );
}

const SEVERITY_TONE: Record<Severity, BadgeProps['tone']> = {
  low: 'neutral',
  medium: 'liveSoft',
  urgent: 'alert',
};

export function SeverityBadge({ severity, size }: { severity: Severity; size?: BadgeProps['size'] }) {
  return (
    <Badge tone={SEVERITY_TONE[severity]} size={size}>
      {severity === 'urgent' ? <CircleDot className="h-3 w-3" /> : null}
      {t.severity[severity]}
    </Badge>
  );
}

const STAGE_TONE: Record<LeadStage, BadgeProps['tone']> = {
  new: 'signalSoft',
  screening: 'neutral',
  viewing_scheduled: 'liveSoft',
  viewed: 'liveSoft',
  offer: 'signal',
  signed: 'openSoft',
  rejected: 'outline',
};

export function LeadStageBadge({ stage, size }: { stage: LeadStage; size?: BadgeProps['size'] }) {
  return (
    <Badge tone={STAGE_TONE[stage]} size={size}>
      {t.leadStage[stage]}
    </Badge>
  );
}

/* ── The availability chip — the product's signature status ─── */

export const AVAILABILITY_LABEL: Record<AvailabilityKind, string> = {
  now: t.availability.now,
  dated: t.availability.dated,
  extending: t.availability.likelyExtending,
  unknown: t.availability.occupiedUnknown,
};

export const AVAILABILITY_COLOR: Record<AvailabilityKind, string> = {
  now: 'var(--color-open)',
  dated: 'var(--color-signal)',
  extending: 'var(--color-live)',
  unknown: 'var(--color-muted)',
};

const AVAILABILITY_TONE: Record<AvailabilityKind, BadgeProps['tone']> = {
  now: 'openSoft',
  dated: 'signal',
  extending: 'liveSoft',
  unknown: 'neutral',
};

const AVAILABILITY_ICON: Record<AvailabilityKind, React.ComponentType<{ className?: string }>> = {
  now: CircleDot,
  dated: CalendarClock,
  extending: Clock3,
  unknown: Wrench,
};

/**
 * "מתפנה 30/09" carries the loudest colour in the system — louder than
 * "פנוי עכשיו". That inversion is the whole argument of the product: an
 * occupied apartment with a date is the thing worth looking at.
 */
export function AvailabilityChip({
  kind,
  date,
  confidence,
  size = 'md',
  withCountdown,
  className,
}: {
  kind: AvailabilityKind;
  date?: string;
  /** 'likely' renders as a projection rather than a commitment */
  confidence?: AvailabilityConfidence;
  size?: BadgeProps['size'];
  withCountdown?: boolean;
  className?: string;
}) {
  const Icon = AVAILABILITY_ICON[kind];

  if (kind === 'dated' && date) {
    /* A confirmed departure and a projected one must not look identical —
       the whole product rests on the difference. Confirmed is the solid amber
       chip; projected is outlined and says "expected", not "is". */
    const projected = confidence === 'likely';
    return (
      <Badge
        tone={projected ? 'signalSoft' : 'signal'}
        size={size}
        className={cn('font-bold', projected && 'border border-dashed border-signal', className)}
      >
        <Icon className="h-3 w-3" />
        <span>{projected ? t.availability.expectedFrom : t.availability.availableFrom}</span>
        <Num board>{formatDate(date)}</Num>
        {withCountdown ? <span className="font-medium opacity-70">· {formatUntil(date)}</span> : null}
      </Badge>
    );
  }

  return (
    <Badge tone={AVAILABILITY_TONE[kind]} size={size} className={className}>
      <Icon className="h-3 w-3" />
      {AVAILABILITY_LABEL[kind]}
    </Badge>
  );
}
