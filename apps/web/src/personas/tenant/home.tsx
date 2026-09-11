import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  t,
  daysUntil,
  formatDate,
  formatRooms,
  formatSqm,
  formatFloor,
  type TenantProperty,
  type TrackRow,
} from '@miftan/shared';
import { useProperties, useTickets } from '@/api/hooks';
import { DepartureTrack } from '@/components/shared/departure-track';
import { OfferRail } from '@/components/shared/revenue';
import { Money, Num, PageHeader, Phone, SectionTitle } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Meter } from '@/components/shared/meter';
import { Skeleton } from '@/components/shared/skeleton';
import { addMonths, parseISO, subDays } from 'date-fns';
import { CalendarCheck2, FileText, KeyRound, ListChecks, Wrench } from 'lucide-react';

/** Statuses that still want the tenant's attention. */
const OPEN = ['new', 'approved', 'assigned', 'in_progress', 'awaiting_receipt'];

export function TenantHome() {
  const navigate = useNavigate();
  const { data: properties, isLoading, isError, refetch } = useProperties();
  const { data: tickets = [] } = useTickets();

  if (isLoading) return <HomeSkeleton />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  /**
   * `/properties` answers with every unit you have a relationship to, each
   * projected for the relationship you hold. The one you live in is the row
   * scoped `tenant` — which is also why an account that both lets flats and
   * rents one lands here on the right flat rather than on one of its own.
   */
  const home = properties?.find((p): p is TenantProperty => p.scope === 'tenant');

  if (!home) {
    return (
      <EmptyState
        icon={KeyRound}
        title={t.unit.lease.noLease}
        hint={t.unit.lease.noLeaseHint}
        action={t.seekerNav.search}
        onAction={() => navigate('/search')}
      />
    );
  }

  const { lease, owner, address } = home;
  const openTickets = tickets.filter((tk) => OPEN.includes(tk.status));

  const daysLeft = Math.max(0, daysUntil(lease.endDate));
  const leaseLengthDays = Math.max(1, daysUntil(lease.endDate, parseISO(lease.startDate)));

  const nextPayment = (() => {
    const d = new Date();
    d.setDate(1);
    return addMonths(d, 1);
  })();

  const trackRows: TrackRow[] = [
    {
      id: lease.id,
      property_id: home.id,
      label: `${address.street} ${address.number}`,
      sublabel: t.track.myLease,
      from: new Date().toISOString().slice(0, 10),
      until: lease.endDate,
      tone: lease.renewalIntent === 'extend' ? 'live' : 'signal',
      confidence: 'confirmed',
      marks: [
        {
          at: subDays(parseISO(lease.endDate), lease.noticePeriodDays).toISOString().slice(0, 10),
          kind: 'decision',
          label: t.track.decisionPoint,
        },
      ],
    },
  ];

  const quick = [
    { to: '/tenant/report', label: t.tenant.reportProblem, Icon: Wrench },
    { to: '/tenant/tickets', label: t.tenant.myTickets, Icon: ListChecks, count: openTickets.length },
    { to: '/tenant/renewal', label: t.tenant.renewal, Icon: CalendarCheck2 },
    { to: '/tenant/documents', label: t.tenant.documentsLink, Icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${address.street} ${address.number}`}
        subtitle={`${address.neighborhood} · ${address.city}`}
      />

      {home.photos[0] ? (
        <img
          src={home.photos[0]}
          alt=""
          className="h-44 w-full rounded-[var(--radius-card)] object-cover sm:h-56"
        />
      ) : null}

      <section className="rounded-[var(--radius-card)] border border-line p-4">
        <SectionTitle
          aside={
            <Badge tone={daysLeft < 90 ? 'signalSoft' : 'neutral'} size="sm">
              {t.availability.availableFrom} <Num board>{formatDate(lease.endDate)}</Num>
            </Badge>
          }
        >
          {t.tenant.myLease}
        </SectionTitle>

        <p className="flex items-baseline gap-2">
          <Num board className="text-3xl font-semibold text-ink">
            {daysLeft}
          </Num>
          <span className="text-xs text-muted">{t.tenant.daysRemaining}</span>
        </p>
        <Meter
          value={leaseLengthDays - daysLeft}
          max={leaseLengthDays}
          tone={daysLeft < 90 ? 'signal' : 'ink'}
          className="mt-3"
          label={t.tenant.daysRemaining}
        />

        <dl className="mt-4 grid grid-cols-2 gap-y-3 text-sm sm:grid-cols-4">
          <Stat label={t.tenant.monthlyRent} value={<Money agorot={lease.monthlyRentAgorot} board />} />
          <Stat label={t.tenant.nextPayment} value={<Num board>{formatDate(nextPayment)}</Num>} />
          <Stat label={t.tenant.paidVia} value={t.paymentMethod[lease.paymentMethod]} />
          <Stat label={t.unit.lease.deposit} value={<Money agorot={lease.depositAgorot} board />} />
        </dl>
      </section>

      <section>
        <SectionTitle aside={<span className="text-2xs text-muted">{t.track.axisHint}</span>}>
          {t.track.title}
        </SectionTitle>
        <DepartureTrack rows={trackRows} months={Math.max(6, Math.ceil(daysLeft / 30) + 2)} dense />
        <p className="mt-2 text-2xs text-muted">{t.track.decisionPoint}</p>
      </section>

      <section>
        <SectionTitle>{t.tenant.quickActions}</SectionTitle>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {quick.map((action) => (
            <button
              key={action.to}
              type="button"
              onClick={() => navigate(action.to)}
              className="press-sm flex items-center gap-3 rounded-[var(--radius-card)] border border-line p-4 text-start transition-colors duration-150 hover:border-line-strong hover:bg-surface"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-control)] bg-surface">
                <action.Icon className="h-4.5 w-4.5 text-ink" />
              </span>
              <span className="flex-1 text-sm font-bold text-ink">{action.label}</span>
              {action.count ? (
                <Badge tone="alertSoft" size="sm">
                  <Num board>{action.count}</Num>
                </Badge>
              ) : null}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-[var(--radius-card)] border border-line p-4">
          <SectionTitle>{t.tenant.landlord}</SectionTitle>
          <p className="text-sm font-bold text-ink">{owner.name}</p>
          {owner.phone ? (
            <Phone value={owner.phone} className="mt-1.5 block text-xs text-ink-soft" />
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => navigate('/tenant/report')}
          >
            {t.tenant.reportProblem}
          </Button>
        </section>

        <section className="rounded-[var(--radius-card)] border border-line p-4">
          <SectionTitle>{t.tenant.building}</SectionTitle>
          <dl className="space-y-2 text-sm">
            <Line label={t.properties.rooms} value={formatRooms(home.rooms)} />
            <Line label={t.properties.sqm} value={formatSqm(home.sqm)} />
            <Line label={t.properties.floor} value={formatFloor(home.floor, home.totalFloors)} />
            <Line label={t.unit.vaad} value={<Money agorot={home.vaadMonthlyAgorot} board />} />
            <Line label={t.unit.arnona} value={<Money agorot={home.arnonaBimonthlyAgorot} board />} />
          </dl>
        </section>
      </div>

      <OfferRail placement="tenant_home" audience="tenant" />
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-44 w-full rounded-[var(--radius-card)] sm:h-56" />
      <Skeleton className="h-40 w-full rounded-[var(--radius-card)]" />
      <Skeleton className="h-28 w-full rounded-[var(--radius-card)]" />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-2xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-bold text-ink">{value}</dd>
    </div>
  );
}

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm font-semibold text-ink-soft">{value}</dd>
    </div>
  );
}
