import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  formatDate,
  formatDateTime,
  t,
  type OwnerLead,
  type OwnerProperty,
  type OwnerSlot,
} from '@miftan/shared';
import { useViewings } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { LeadStageBadge } from '@/components/shared/status';
import { Num, Phone } from '@/components/shared/typography';
import { cn } from '@/lib/utils';
import { CalendarClock, Check, ChevronDown, Users, X } from 'lucide-react';

/**
 * Applicants live on the apartment, because every decision about them is
 * about this apartment: its requirements, its viewing times. Ranked by how
 * well each meets those requirements, with the reasons spelled out — and
 * never filtered out. Someone who misses a requirement drops down the list
 * with the reason shown; they do not disappear.
 */

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
const A = t.turnover.applicants;

function employmentLabel(key: string): string {
  return (t.seeker.profile.employmentOptions as Record<string, string>)[key] ?? key;
}

export function ApplicantsTab({ property, leads }: { property: OwnerProperty; leads: OwnerLead[] }) {
  const { data } = useViewings(property.id);
  const viewingByLead = new Map(
    (data?.slots ?? [])
      .filter((s): s is OwnerSlot => s.scope === 'owner' && s.status === 'booked' && Boolean(s.leadId))
      .map((s) => [s.leadId!, s.startsAt]),
  );

  const applicants = leads.filter((l) => !l.watchOnly).sort((a, b) => b.score - a.score);
  const strong = applicants.filter((l) => l.flags.every((f) => f.passed));
  const partial = applicants.filter((l) => !l.flags.every((f) => f.passed));
  const [showPartial, setShowPartial] = React.useState(false);

  if (applicants.length === 0) {
    return <EmptyState icon={Users} title={A.empty} hint={A.emptyHint} />;
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-base font-bold text-ink">{fill(A.summary, { n: applicants.length, strong: strong.length })}</p>
        <p className="text-xs text-muted">{A.neverHidden}</p>
      </div>

      {strong.length ? (
        <ul className="space-y-2">
          {strong.map((l) => (
            <ApplicantCard key={l.id} lead={l} viewingAt={viewingByLead.get(l.id)} />
          ))}
        </ul>
      ) : null}

      {partial.length ? (
        <section>
          <button
            type="button"
            onClick={() => setShowPartial((v) => !v)}
            aria-expanded={showPartial || strong.length === 0}
            className="flex w-full items-center justify-between rounded-[var(--radius-control)] bg-surface px-3 py-2.5 text-sm font-bold text-ink"
          >
            {fill(A.othersTitle, { n: partial.length })}
            <ChevronDown className={cn('h-4 w-4 transition-transform', (showPartial || strong.length === 0) && 'rotate-180')} />
          </button>
          {showPartial || strong.length === 0 ? (
            <ul className="mt-2 space-y-2">
              {partial.map((l) => (
                <ApplicantCard key={l.id} lead={l} viewingAt={viewingByLead.get(l.id)} />
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function ApplicantCard({ lead, viewingAt }: { lead: OwnerLead; viewingAt?: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const meets = lead.flags.filter((f) => f.passed);
  const misses = lead.flags.filter((f) => !f.passed);
  const isStrong = misses.length === 0;
  const s = lead.screening;

  const facts = [
    fill(A.income, { x: s.incomeToRentRatio.toFixed(1) }),
    employmentLabel(s.employment),
    fill(A.people, { n: s.occupants }),
    fill(A.moveIn, { date: formatDate(lead.desiredMoveIn) }),
  ];

  return (
    <li className={cn('overflow-hidden rounded-[var(--radius-card)] border', isStrong ? 'border-line-strong' : 'border-line')}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-start gap-3 p-3 text-start">
        <span
          className={cn(
            'grid h-12 w-12 shrink-0 place-items-center rounded-full border-2',
            isStrong ? 'border-ink' : 'border-line-strong',
          )}
          aria-label={`${A.matchLabel} ${lead.score}%`}
        >
          <Num board className="text-sm font-bold text-ink">{lead.score}%</Num>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-base font-bold text-ink">{lead.seeker.name}</span>
            <LeadStageBadge stage={lead.stage} size="sm" />
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-ink-soft">
            {isStrong ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
            {isStrong ? A.strong : `${A.partial} · ${misses.length} ${t.crm.flagsFailed}`}
          </span>
          <span className="mt-1 block text-xs text-muted">{facts.join(' · ')}</span>
          {viewingAt ? (
            <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-ink">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
              {fill(A.viewing, { date: formatDateTime(viewingAt) })}
            </span>
          ) : null}
        </span>
        <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open ? (
        <div className="space-y-3 border-t border-line bg-surface p-3 text-sm">
          {meets.length ? (
            <div>
              <p className="mb-1 text-xs font-bold text-ink-soft">{A.meets}</p>
              <ul className="space-y-1">
                {meets.map((f) => (
                  <li key={f.criterion} className="flex items-start gap-1.5 text-ink">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    {t.screening.criterion[f.criterion]}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {misses.length ? (
            <div>
              <p className="mb-1 text-xs font-bold text-ink-soft">{A.misses}</p>
              <ul className="space-y-1">
                {misses.map((f) => (
                  <li key={f.criterion} className="flex items-start gap-1.5 text-ink">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-alert" aria-hidden />
                    <span>
                      <span className="font-semibold">{t.screening.criterion[f.criterion]}</span>
                      <span className="text-muted"> — {f.note}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {lead.about ? <p className="rounded-[var(--radius-control)] bg-bg p-2.5 text-ink-soft">“{lead.about}”</p> : null}
          <div className="flex flex-wrap items-center gap-3">
            {lead.seeker.phone ? <Phone value={lead.seeker.phone} className="text-sm text-ink" /> : null}
            <Button variant="secondary" size="sm" onClick={() => navigate(`/owner/crm?lead=${lead.id}`)}>
              {A.fullCard}
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
