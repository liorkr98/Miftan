import * as React from 'react';
import { useStore, useStoreShallow } from '@/data/store';
import { t, daysUntil, formatDate, formatAge, type RenewalIntent } from '@miftan/shared';
import { availabilityKind } from '@/data/selectors';
import { Money, Num, PageHeader, SectionTitle } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { AvailabilityChip } from '@/components/shared/status';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { addMonths, parseISO, subDays } from 'date-fns';
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
  const { properties, leases, inquiries, currentTenantId } = useStoreShallow((s) => ({
    properties: s.properties,
    leases: s.leases,
    inquiries: s.inquiries,
    currentTenantId: s.currentTenantId,
  }));
  const setRenewalIntent = useStore((s) => s.setRenewalIntent);
  const answerInquiryAsTenant = useStore((s) => s.answerInquiryAsTenant);
  const acceptRenewalProposal = useStore((s) => s.acceptRenewalProposal);
  const pushToast = useStore((s) => s.pushToast);

  const lease = leases.find((l) => l.tenant_id === currentTenantId);
  const property = lease ? properties.find((p) => p.id === lease.property_id) : undefined;
  const [changing, setChanging] = React.useState(false);
  const [note, setNote] = React.useState('');

  /* An inquiry the owner has forwarded. The tenant sees a question about
     their own lease — never a seeker, never a name. */
  const pendingInquiry = inquiries.find(
    (x) => x.property_id === property?.id && x.status === 'asked_tenant',
  );

  if (!lease || !property) {
    return <EmptyState icon={CalendarCheck2} title={t.unit.lease.noLease} hint={t.unit.lease.noLeaseHint} />;
  }

  /* A standing answer must not hide a fresh question. When the owner has
     explicitly asked again — because someone is interested — the options are
     open regardless of what the tenant said last time. Intentions change. */
  const answered = Boolean(lease.renewal_intent) && !changing && !pendingInquiry;
  const proposal = lease.proposed_renewal;
  const deadline = subDays(parseISO(lease.end_date), lease.notice_period_days);
  const kind = availabilityKind(property, lease);

  const choose = (intent: RenewalIntent) => {
    if (pendingInquiry) {
      answerInquiryAsTenant(pendingInquiry.id, intent, note.trim() || undefined);
      setNote('');
      pushToast(t.inquiries.tenantPrompt.answered, 'success');
    } else {
      setRenewalIntent(lease.id, intent);
      pushToast(t.tenant.renewalPage.answered, 'success');
    }
    setChanging(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.tenant.renewalPage.title}
        subtitle={`${property.address.street} ${property.address.number}`}
      />

      {/* The owner has forwarded a question because someone is interested */}
      {pendingInquiry ? (
        <section className="rounded-[var(--radius-card)] border border-signal/50 bg-signal-soft p-4 motion-safe:animate-[fade-up_260ms_var(--ease-out)_both]">
          <div className="flex items-start gap-2.5">
            <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-signal-deep" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-ink">{t.inquiries.tenantPrompt.title}</h2>
              <p className="mt-1 text-xs leading-5 text-ink-soft">{t.inquiries.tenantPrompt.body}</p>
              <p className="mt-1 text-2xs text-muted">
                {t.inquiries.asked} {formatAge(pendingInquiry.asked_tenant_at ?? pendingInquiry.created_at)}
              </p>

              <div className="mt-3">
                <label
                  htmlFor="renewal-note"
                  className="mb-1.5 block text-2xs font-bold text-ink-soft"
                >
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

      {/* The question */}
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
                lease.renewal_intent === 'extend'
                  ? 'openSoft'
                  : lease.renewal_intent === 'leave'
                    ? 'signalSoft'
                    : 'neutral'
              }
              size="lg"
            >
              {t.unit.intent[lease.renewal_intent!]}
            </Badge>
            <span className="text-xs text-muted">{t.tenant.renewalPage.answered}</span>
            <Button variant="quiet" size="sm" onClick={() => setChanging(true)}>
              {t.tenant.renewalPage.changeAnswer}
            </Button>
          </div>
        ) : (
          <>
            {pendingInquiry && lease.renewal_intent ? (
              <p className="mt-3 flex items-center gap-2 text-xs text-muted">
                {t.unit.lease.renewalIntent}:
                <Badge tone="neutral" size="sm">
                  {t.unit.intent[lease.renewal_intent]}
                </Badge>
              </p>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => choose(option.id)}
                  className={cn(
                    'press flex flex-col items-center gap-2 rounded-[var(--radius-card)] border p-4 text-center',
                    'transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-out)]',
                    lease.renewal_intent === option.id
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
        )}
      </section>

      {/* Terms */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-[var(--radius-card)] border border-line p-4">
          <SectionTitle>{t.tenant.renewalPage.currentTerms}</SectionTitle>
          <dl className="space-y-2 text-sm">
            <Line label={t.unit.lease.monthlyRent} value={<Money value={lease.monthly_rent} board />} />
            <Line
              label={t.unit.lease.period}
              value={
                <Num board>
                  {formatDate(lease.start_date)} — {formatDate(lease.end_date)}
                </Num>
              }
            />
            <Line label={t.unit.lease.payment} value={t.paymentMethod[lease.payment_method]} />
            <Line
              label={t.unit.lease.extensionOption}
              value={lease.has_extension_option ? t.unit.lease.hasOption : t.unit.lease.noOption}
            />
          </dl>
        </section>

        <section
          className={cn(
            'rounded-[var(--radius-card)] border p-4',
            proposal ? 'border-signal/45 bg-signal-soft' : 'border-line',
          )}
        >
          <SectionTitle>{t.tenant.renewalPage.proposedTerms}</SectionTitle>
          {!proposal ? (
            <>
              <p className="text-sm text-ink-soft">{t.tenant.renewalPage.noProposal}</p>
              <p className="mt-1 text-2xs leading-5 text-muted">{t.tenant.renewalPage.noProposalHint}</p>
            </>
          ) : (
            <>
              <dl className="space-y-2 text-sm">
                <Line
                  label={t.tenant.renewalPage.newRent}
                  value={<Money value={proposal.monthly_rent} board />}
                />
                <Line
                  label={t.tenant.renewalPage.newPeriod}
                  value={
                    <Num board>
                      {formatDate(proposal.start_date)} —{' '}
                      {formatDate(addMonths(parseISO(proposal.start_date), proposal.months))}
                    </Num>
                  }
                />
                <Line
                  label={t.tenant.renewalPage.changeFromCurrent}
                  value={
                    <span
                      className={cn(
                        'font-bold',
                        proposal.monthly_rent > lease.monthly_rent ? 'text-alert' : 'text-open',
                      )}
                    >
                      <Money value={proposal.monthly_rent - lease.monthly_rent} board />
                    </span>
                  }
                />
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    acceptRenewalProposal(lease.id);
                    pushToast(t.tenant.renewalPage.accepted, 'success');
                  }}
                >
                  {t.tenant.renewalPage.accept}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => pushToast(t.tenant.renewalPage.negotiate)}
                >
                  {t.tenant.renewalPage.negotiate}
                </Button>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Privacy — what the seeker side actually sees */}
      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <div className="flex items-start gap-2.5">
          <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
          <div className="flex-1">
            <h2 className="text-sm font-bold text-ink">{t.tenant.renewalPage.privacyTitle}</h2>
            <p className="mt-1 text-2xs leading-5 text-muted">{t.tenant.renewalPage.privacyBody}</p>

            <div className="mt-3 rounded-[var(--radius-control)] border border-line bg-bg p-3">
              <p className="mb-1.5 text-2xs font-bold text-ink-soft">
                {t.tenant.renewalPage.publishedAs}
              </p>
              <AvailabilityChip kind={kind} date={property.available_from}
              confidence={property.availability_confidence} withCountdown />
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
