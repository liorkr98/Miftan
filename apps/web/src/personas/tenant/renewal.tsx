import * as React from 'react';
import { t, formatDate, type TenantProperty } from '@miftan/shared';
import { useInquiries, useProperties, useRenewals } from '@/api/hooks';
import { Money, Num, PageHeader, SectionTitle } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { ListSkeleton } from '@/components/shared/skeleton';
import { AvailabilityChip } from '@/components/shared/status';
import { CalendarCheck2, EyeOff, MessageCircleQuestion } from 'lucide-react';
import { TenantTurnover } from './turnover';

/**
 * The tenant's lease ending, as a single guided card — plus the two things
 * that help answer it: the current terms, and exactly what a seeker sees
 * about this flat (never who the tenant is).
 */
export function TenantRenewal() {
  const properties = useProperties();
  const renewals = useRenewals();
  const { data: inquiries = [] } = useInquiries();

  if (properties.isError || renewals.isError) {
    return (
      <ErrorState
        onRetry={() => {
          void properties.refetch();
          void renewals.refetch();
        }}
      />
    );
  }
  if (properties.isLoading || renewals.isLoading) return <ListSkeleton rows={5} />;

  const home = properties.data?.find((p): p is TenantProperty => p.scope === 'tenant');
  if (!home) {
    return <EmptyState icon={CalendarCheck2} title={t.unit.lease.noLease} hint={t.unit.lease.noLeaseHint} />;
  }

  const { lease, address, availability } = home;
  const view = renewals.data?.find((r) => r.role === 'tenant' && r.leaseId === lease.id);
  /* A seeker asked about this flat before the renewal opened. Answering the
     card below answers that question too. */
  const pendingInquiry = inquiries.find((x) => x.scope === 'tenant' && !x.answered);

  return (
    <div className="space-y-6">
      <PageHeader title={t.tenant.renewalPage.title} subtitle={`${address.street} ${address.number}`} />

      {pendingInquiry && view?.stage === 'upcoming' ? (
        <p className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-line bg-surface p-4 text-sm leading-6 text-ink-soft">
          <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
          <span>
            <span className="font-bold text-ink">{t.inquiries.tenantPrompt.title}</span> {t.inquiries.tenantPrompt.body}
          </span>
        </p>
      ) : null}

      {view ? <TenantTurnover view={view} /> : null}

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
