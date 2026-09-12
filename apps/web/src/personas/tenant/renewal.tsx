import * as React from 'react';
import { useStore } from '@/data/store';
import { t, daysUntil, formatDate, formatAge, type RenewalIntent, type TenantProperty } from '@miftan/shared';
import { useInquiries, useInquiryAction, useProperties } from '@/api/hooks';
import { Money, Num, PageHeader, SectionTitle } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { ListSkeleton } from '@/components/shared/skeleton';
import { AvailabilityChip } from '@/components/shared/status';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { parseISO, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  EyeOff,
  HelpCircle,
  LogOut,
  MessageCircleQuestion,
} from 'lucide-react';
import { Textarea } from '@/components/ui/field';

const OPTIONS: {
  id: RenewalIntent;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'extend', label: t.tenant.renewalPage.yes, Icon: CheckCircle2 },
  { id: 'leave', label: t.tenant.renewalPage.no, Icon: LogOut },
  { id: 'undecided', label: t.tenant.renewalPage.unsure, Icon: HelpCircle },
  /* "Too early" is a real answer, not a dodge: it tells the owner to ask
     again later, and it publishes as a different signal than "undecided". */
  { id: 'too_early', label: t.unit.intent.too_early, Icon: Clock3 },
];

export function TenantRenewal() {
  const {
    data: properties,
    isLoading: propertiesLoading,
    isError: propertiesError,
    refetch: refetchProperties,
  } = useProperties();
  const {
    data: inquiries = [],
    isLoading: inquiriesLoading,
    isError: inquiriesError,
    refetch: refetchInquiries,
  } = useInquiries();
  const inquiryAction = useInquiryAction();
  const pushToast = useStore((s) => s.pushToast);

  const [changing, setChanging] = React.useState(false);
  const [note, setNote] = React.useState('');

  if (propertiesError || inquiriesError) {
    return (
      <ErrorState
        onRetry={() => {
          void refetchProperties();
          void refetchInquiries();
        }}
      />
    );
  }
  if (propertiesLoading || inquiriesLoading) return <ListSkeleton rows={5} />;

  const home = properties?.find((p): p is TenantProperty => p.scope === 'tenant');

  if (!home) {
    return <EmptyState icon={CalendarCheck2} title={t.unit.lease.noLease} hint={t.unit.lease.noLeaseHint} />;
  }

  const { lease, address, availability } = home;

  /* A tenant never sees the seeker. Filter to this relationship, then take
     the unanswered question — a standing answer must not hide a fresh one. */
  const pendingInquiry = inquiries.find((x) => x.scope === 'tenant' && !x.answered);

  const answered = Boolean(lease.renewalIntent) && !changing && !pendingInquiry;
  const canAnswer = Boolean(pendingInquiry);
  const deadline = subDays(parseISO(lease.endDate), lease.noticePeriodDays);

  const choose = (intent: RenewalIntent) => {
    if (!pendingInquiry || pendingInquiry.scope !== 'tenant') return;
    inquiryAction.mutate(
      { id: pendingInquiry.id, action: 'answer', body: { answer: intent, note: note.trim() || undefined } },
      {
        onSuccess: () => {
          setNote('');
          setChanging(false);
          pushToast(t.inquiries.tenantPrompt.answered, 'success');
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t.tenant.renewalPage.title} subtitle={`${address.street} ${address.number}`} />

      {pendingInquiry && pendingInquiry.scope === 'tenant' ? (
        <section className="rounded-[var(--radius-card)] border border-signal/50 bg-signal-soft p-4 motion-safe:animate-[fade-up_260ms_var(--ease-out)_both]">
          <div className="flex items-start gap-2.5">
            <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-signal-deep" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-ink">{t.inquiries.tenantPrompt.title}</h2>
              <p className="mt-1 text-xs leading-5 text-ink-soft">{t.inquiries.tenantPrompt.body}</p>
              {pendingInquiry.askedTenantAt ? (
                <p className="mt-1 text-2xs text-muted">
                  {t.inquiries.asked} {formatAge(pendingInquiry.askedTenantAt)}
                </p>
              ) : null}

              <div className="mt-3">
                <label htmlFor="renewal-note" className="mb-1.5 block text-2xs font-bold text-ink-soft">
                  {t.inquiries.tenantPrompt.note}
                </label>
                <Textarea
                  id="renewal-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t.inquiries.tenantPrompt.notePlaceholder}
                  className="min-h-16 bg-bg"
                />
              </div>

              <p className="mt-2.5 flex items-start gap-1.5 rounded-[var(--radius-control)] bg-bg p-2.5 text-2xs leading-5 text-muted">
                <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-bold text-ink-soft">{t.inquiries.tenantPrompt.whoSees}</span>{' '}
                  {t.inquiries.tenantPrompt.whoSeesBody}
                </span>
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-[var(--radius-card)] border border-line p-5">
        <h2 className="text-lg font-extrabold text-ink">{t.tenant.renewalPage.question}</h2>
        <p className="mt-1 text-xs leading-5 text-muted">{t.tenant.renewalPage.questionHint}</p>

        <p className="mt-3 text-xs text-muted">
          {t.tenant.renewalPage.deadline}{' '}
          <Num board className="font-bold text-ink">
            {formatDate(deadline)}
          </Num>{' '}
          · <Num board>{Math.max(0, daysUntil(deadline))}</Num> {t.ui.days}
        </p>

        {answered ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Badge
              tone={
                lease.renewalIntent === 'extend'
                  ? 'openSoft'
                  : lease.renewalIntent === 'leave'
                    ? 'signalSoft'
                    : 'neutral'
              }
              size="lg"
            >
              {t.unit.intent[lease.renewalIntent!]}
            </Badge>
            <span className="text-xs text-muted">{t.tenant.renewalPage.answered}</span>
            {canAnswer ? (
              <Button variant="quiet" size="sm" onClick={() => setChanging(true)}>
                {t.tenant.renewalPage.changeAnswer}
              </Button>
            ) : null}
          </div>
        ) : canAnswer ? (
          <>
            {lease.renewalIntent ? (
              <p className="mt-3 flex items-center gap-2 text-xs text-muted">
                {t.unit.lease.renewalIntent}:
                <Badge tone="neutral" size="sm">
                  {t.unit.intent[lease.renewalIntent]}
                </Badge>
              </p>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={inquiryAction.isPending}
                  onClick={() => choose(option.id)}
                  className={cn(
                    'press flex flex-col items-center gap-2 rounded-[var(--radius-card)] border p-4 text-center',
                    'transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-out)]',
                    'disabled:pointer-events-none disabled:opacity-50',
                    lease.renewalIntent === option.id
                      ? 'border-ink bg-ink text-on-ink'
                      : 'border-line hover:border-line-strong hover:bg-surface',
                  )}
                >
                  <option.Icon className="h-5 w-5" />
                  <span className="text-sm font-bold">{option.label}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-4 text-xs leading-5 text-muted">{t.tenant.renewalPage.waitingForAsk}</p>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-[var(--radius-card)] border border-line p-4">
          <SectionTitle>{t.tenant.renewalPage.currentTerms}</SectionTitle>
          <dl className="space-y-2 text-sm">
            <Line label={t.unit.lease.monthlyRent} value={<Money agorot={lease.monthlyRentAgorot} board />} />
            <Line
              label={t.unit.lease.period}
              value={
                <Num board>
                  {formatDate(lease.startDate)} — {formatDate(lease.endDate)}
                </Num>
              }
            />
            <Line label={t.unit.lease.payment} value={t.paymentMethod[lease.paymentMethod]} />
            <Line
              label={t.unit.lease.extensionOption}
              value={lease.hasExtensionOption ? t.unit.lease.hasOption : t.unit.lease.noOption}
            />
          </dl>
        </section>

        <section className="rounded-[var(--radius-card)] border border-line p-4">
          <SectionTitle>{t.tenant.renewalPage.proposedTerms}</SectionTitle>
          <p className="text-sm text-ink-soft">{t.tenant.renewalPage.noProposal}</p>
          <p className="mt-1 text-2xs leading-5 text-muted">{t.tenant.renewalPage.noProposalHint}</p>
        </section>
      </div>

      {/* What a seeker actually sees — the derived signal, never the raw intent. */}
      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <div className="flex items-start gap-2.5">
          <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
          <div className="flex-1">
            <h2 className="text-sm font-bold text-ink">{t.tenant.renewalPage.privacyTitle}</h2>
            <p className="mt-1 text-2xs leading-5 text-muted">{t.tenant.renewalPage.privacyBody}</p>

            <div className="mt-3 rounded-[var(--radius-control)] border border-line bg-bg p-3">
              <p className="mb-1.5 text-2xs font-bold text-ink-soft">{t.tenant.renewalPage.publishedAs}</p>
              <AvailabilityChip
                kind={availability.kind}
                date={availability.date ?? undefined}
                confidence={availability.confidence}
                withCountdown
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}
