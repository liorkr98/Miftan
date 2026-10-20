import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { t, formatTime, israelToday, type Appointment } from '@miftan/shared';
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, RefreshCw } from 'lucide-react';
import { dayLabel } from '@/components/shared/scheduling';
import { cn } from '@/lib/utils';
import type { AttentionItem } from './portfolio-model';

const A = t.activity.attention;

/**
 * What the owner has to do, most urgent first. Each line is one sentence and
 * one verb, so a glance is enough to decide which to open.
 */
export function AttentionList({
  items,
  limit = 4,
  className,
  footer,
  from = 'activity',
}: {
  items: AttentionItem[];
  limit?: number;
  className?: string;
  footer?: React.ReactNode;
  /** Where the property page's back link should return to. */
  from?: 'activity' | 'dashboard';
}) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = React.useState(false);
  const shown = expanded ? items : items.slice(0, limit);

  return (
    <section
      aria-labelledby="attention-title"
      className={cn('rounded-[var(--radius-card)] border p-4', items.length ? 'border-ink' : 'border-line', className)}
    >
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 id="attention-title" className="text-base font-extrabold text-ink">
          {A.title}
          {items.length ? <span className="ms-2 num text-sm font-bold text-muted">{items.length}</span> : null}
        </h2>
        {items.length > 1 ? <span className="text-2xs text-muted">{A.hint}</span> : null}
      </div>

      {items.length === 0 ? (
        <div className="flex items-start gap-2.5 py-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-open" aria-hidden />
          <div>
            <p className="text-sm font-bold text-ink">{A.none}</p>
            <p className="text-xs text-muted">{A.noneHint}</p>
          </div>
        </div>
      ) : (
        <ol className="divide-y divide-line">
          {shown.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => navigate(item.href, { state: { from } })}
                className="group flex w-full items-center gap-3 py-3 text-start"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {item.urgent ? (
                      <span className="inline-flex items-center gap-1 text-2xs font-bold text-alert-deep">
                        <AlertCircle className="h-3 w-3" aria-hidden />
                        {A.urgent}
                      </span>
                    ) : null}
                    <span className="text-sm font-bold text-ink">{item.title}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted">{item.detail}</span>
                </span>
                <span className="press-sm flex shrink-0 items-center gap-1 rounded-[var(--radius-control)] bg-ink px-3 py-2 text-xs font-bold text-on-ink group-hover:bg-ink-soft">
                  {item.action}
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}

      {items.length > limit ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-bold text-ink-soft underline-offset-2 hover:underline"
          aria-expanded={expanded}
        >
          {expanded ? A.less : A.more.replace('{n}', String(items.length - limit))}
        </button>
      ) : null}
      {footer}
    </section>
  );
}

/** Booked appointments for the next seven days, grouped by day. */
export function WeekAgenda({ agenda, className }: { agenda: Appointment[]; className?: string }) {
  const navigate = useNavigate();
  const W = t.activity.week;
  const byDay = new Map<string, Appointment[]>();
  for (const a of agenda) {
    const day = israelToday(new Date(a.startsAt));
    byDay.set(day, [...(byDay.get(day) ?? []), a]);
  }

  return (
    <section aria-labelledby="week-title" className={cn('rounded-[var(--radius-card)] border border-line p-4', className)}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id="week-title" className="text-base font-extrabold text-ink">{W.title}</h2>
        <span className="text-2xs text-muted">{W.hint}</span>
      </div>
      {agenda.length === 0 ? (
        <p className="py-2 text-sm text-muted">{W.empty}</p>
      ) : (
        <div className="space-y-3">
          {[...byDay.entries()].map(([day, list]) => {
            const { top, bottom } = dayLabel(day);
            return (
              <div key={day}>
                <h3 className="mb-1 text-xs font-bold text-ink-soft">
                  {top} <span className="num font-semibold text-muted">{bottom}</span>
                </h3>
                <ul className="space-y-1">
                  {list.map((a) => {
                    const Icon = a.kind === 'renewal_meeting' ? RefreshCw : Eye;
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => navigate(`/owner/properties/${a.propertyId}?tab=schedule`, { state: { from: 'activity' } })}
                          className="flex w-full items-center gap-2.5 rounded-[var(--radius-control)] px-2 py-1.5 text-start hover:bg-surface"
                        >
                          <span className="num w-11 shrink-0 text-sm font-bold text-ink">{formatTime(a.startsAt)}</span>
                          <Icon className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                          <span className="min-w-0 flex-1 truncate text-sm">
                            <span className="font-semibold text-ink">{a.personName}</span>
                            <span className="text-muted"> · {W.kinds[a.kind]} · {a.propertyLabel}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
