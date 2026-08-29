import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStoreShallow } from '@/data/store';
import { t, daysUntil, formatDate, formatRooms, formatSqm, formatFloor, type TrackRow } from '@miftach/shared';
import { DepartureTrack } from '@/components/shared/departure-track';
import { OfferRail } from '@/components/shared/revenue';
import { Money, Num, PageHeader, Phone, SectionTitle } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Meter } from '@/components/shared/meter';
import { OPEN_TICKET_STATUSES } from '@/data/selectors';
import { addMonths, parseISO, subDays } from 'date-fns';
import {
  CalendarCheck2,
  FileText,
  KeyRound,
  ListChecks,
  Wrench,
} from 'lucide-react';

export function TenantHome() {
  const navigate = useNavigate();
  const { properties, leases, tenants, tickets, currentTenantId, owner } = useStoreShallow((s) => ({
    properties: s.properties,
    leases: s.leases,
    tenants: s.tenants,
    tickets: s.tickets,
    currentTenantId: s.currentTenantId,
    owner: s.owner,
  }));

  const tenant = tenants.find((x) => x.id === currentTenantId);
  const lease = leases.find((l) => l.tenant_id === currentTenantId);
  const property = lease ? properties.find((p) => p.id === lease.property_id) : undefined;

  const openTickets = tickets.filter(
    (tk) => tk.tenant_id === currentTenantId && OPEN_TICKET_STATUSES.includes(tk.status),
  );

  if (!lease || !property) {
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

  const daysLeft = Math.max(0, daysUntil(lease.end_date));
  const leaseLengthDays = Math.max(
    1,
    daysUntil(lease.end_date, parseISO(lease.start_date)),
  );

  const nextPayment = (() => {
    const d = new Date();
    d.setDate(1);
    return addMonths(d, 1);
  })();

  const trackRows: TrackRow[] = [
    {
      id: lease.id,
      property_id: property.id,
      label: `${property.address.street} ${property.address.number}`,
      sublabel: t.track.myLease,
      from: new Date().toISOString().slice(0, 10),
      until: lease.end_date,
      tone: lease.renewal_intent === 'extend' ? 'live' : 'signal',
      confidence: 'confirmed',
      marks: [
        {
          at: subDays(parseISO(lease.end_date), lease.notice_period_days).toISOString().slice(0, 10),
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
        title={`${property.address.street} ${property.address.number}`}
        subtitle={`${property.address.neighborhood} · ${property.address.city}`}
      />

      {property.photos[0] ? (
        <img
          src={property.photos[0]}
          alt=""
          className="h-44 w-full rounded-[var(--radius-card)] object-cover sm:h-56"
        />
      ) : null}

      {/* Lease at a glance */}
      <section className="rounded-[var(--radius-card)] border border-line p-4">
        <SectionTitle
          aside={
            <Badge tone={daysLeft < 90 ? 'signalSoft' : 'neutral'} size="sm">
              {t.availability.availableFrom} <Num board>{formatDate(lease.end_date)}</Num>
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
          <Stat label={t.tenant.monthlyRent} value={<Money value={lease.monthly_rent} board />} />
          <Stat
            label={t.tenant.nextPayment}
            value={<Num board>{formatDate(nextPayment)}</Num>}
          />
          <Stat label={t.tenant.paidVia} value={t.paymentMethod[lease.payment_method]} />
          <Stat label={t.unit.lease.deposit} value={<Money value={lease.deposit} board />} />
        </dl>
      </section>

      {/* The same departures board, one row: your lease */}
      <section>
        <SectionTitle aside={<span className="text-2xs text-muted">{t.track.axisHint}</span>}>
          {t.track.title}
        </SectionTitle>
        <DepartureTrack rows={trackRows} months={Math.max(6, Math.ceil(daysLeft / 30) + 2)} dense />
        <p className="mt-2 text-2xs text-muted">{t.track.decisionPoint}</p>
      </section>

      {/* Quick actions */}
      <section>
        <SectionTitle>{t.tenant.quickActions}</SectionTitle>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {quick.map((action) => (
            <button
              key={action.to}
              type="button"
              onClick={() => navigate(action.to)}
              className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line p-4 text-start transition-colors duration-150 hover:border-line-strong hover:bg-surface"
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

      {/* Landlord + building */}
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-[var(--radius-card)] border border-line p-4">
          <SectionTitle>{t.tenant.landlord}</SectionTitle>
          <p className="text-sm font-bold text-ink">{owner.name}</p>
          {owner.company ? <p className="text-2xs text-muted">{owner.company}</p> : null}
          <Phone value={owner.phone} className="mt-1.5 block text-xs text-ink-soft" />
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
            <Line label={t.properties.rooms} value={formatRooms(property.rooms)} />
            <Line label={t.properties.sqm} value={formatSqm(property.sqm)} />
            <Line
              label={t.properties.floor}
              value={formatFloor(property.floor, property.total_floors)}
            />
            <Line label={t.unit.vaad} value={<Money value={property.vaad_monthly} board />} />
            <Line label={t.unit.arnona} value={<Money value={property.arnona_bimonthly} board />} />
          </dl>
        </section>
      </div>

      <OfferRail placement="tenant_home" audience="tenant" />

      {tenant ? (
        <p className="text-center text-2xs text-muted">
          {tenant.name} · {t.ui.demoNote}
        </p>
      ) : null}
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
