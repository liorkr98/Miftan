import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore, useStoreShallow } from '@/data/store';
import { t } from '@/i18n/he';
import {
  availabilityKind,
  leadsForProperty,
  leaseForProperty,
  rentComparison,
  ticketsForProperty,
} from '@/data/selectors';
import { DepartureTrack } from '@/components/shared/departure-track';
import { ProtocolPanel } from '@/components/shared/protocol';
import { OfferRail } from '@/components/shared/revenue';
import { Money, Num, PageHeader, Phone, SectionTitle } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import {
  AvailabilityChip,
  LeadStageBadge,
  SeverityBadge,
  TicketStatusBadge,
  UnitStatusBadge,
} from '@/components/shared/status';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field, Input, Switch } from '@/components/ui/field';
import { Meter } from '@/components/shared/meter';
import {
  expenseCategoryLabel,
  formatAge,
  formatDate,
  formatFloor,
  formatMonthYear,
  formatRooms,
  formatSqm,
  formatUntil,
  daysUntil,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { addMonths, parseISO, subDays } from 'date-fns';
import type { TrackRow } from '@/types';
import {
  ArrowRight,
  CalendarClock,
  FileText,
  Receipt,
  Users,
  Wrench,
  MapPin,
  ShieldCheck,
} from 'lucide-react';

export function OwnerUnitDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { properties, leases, tenants, tickets, expenses, leads, seekers } = useStoreShallow((s) => ({
    properties: s.properties,
    leases: s.leases,
    tenants: s.tenants,
    tickets: s.tickets,
    expenses: s.expenses,
    leads: s.leads,
    seekers: s.seekers,
  }));
  const setListed = useStore((s) => s.setListed);
  const askRenewal = useStore((s) => s.askRenewal);
  const pushToast = useStore((s) => s.pushToast);

  const property = properties.find((p) => p.id === id);
  const lease = property ? leaseForProperty(leases, property.id) : undefined;
  const tenant = lease ? tenants.find((x) => x.id === lease.tenant_id) : undefined;

  if (!property) {
    return (
      <EmptyState
        icon={MapPin}
        title={t.seeker.listing.notFound}
        hint={t.seeker.listing.notFoundHint}
        action={t.properties.title}
        onAction={() => navigate('/owner/properties')}
      />
    );
  }

  const unitTickets = ticketsForProperty(tickets, property.id);
  const unitExpenses = expenses
    .filter((e) => e.property_id === property.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const unitLeads = leadsForProperty(leads, property.id);
  const kind = availabilityKind(property, lease);

  const trackRows: TrackRow[] = lease
    ? [
        {
          id: lease.id,
          property_id: property.id,
          label: `${property.address.street} ${property.address.number}`,
          sublabel: tenant?.name,
          from: new Date().toISOString().slice(0, 10),
          until: lease.end_date,
          tone: kind === 'dated' ? 'signal' : kind === 'extending' ? 'live' : 'muted',
          confidence: property.availability_confidence,
          marks: [
            {
              at: subDays(parseISO(lease.end_date), lease.notice_period_days).toISOString().slice(0, 10),
              kind: 'decision',
              label: t.track.decisionPoint,
            },
          ],
        },
      ]
    : [];

  return (
    <div className="space-y-5">
      <div>
        <Button variant="quiet" size="sm" className="-ms-2 mb-1" onClick={() => navigate('/owner/properties')}>
          <ArrowRight className="h-3.5 w-3.5" />
          {t.properties.title}
        </Button>
        <PageHeader
          title={`${property.address.street} ${property.address.number}`}
          subtitle={`${property.address.neighborhood} · ${property.address.city}`}
          actions={
            <>
              <label className="flex items-center gap-2 rounded-[var(--radius-control)] border border-line px-3 py-2 text-xs font-semibold text-ink-soft">
                <Switch
                  checked={property.listed}
                  onCheckedChange={(v) => {
                    setListed([property.id], v);
                    pushToast(v ? t.properties.bulkMarkListed : t.properties.bulkUnlist, 'success');
                  }}
                  aria-label={t.properties.listed}
                />
                {property.listed ? t.properties.listed : t.properties.notListed}
              </label>
              <Button variant="secondary" onClick={() => navigate(`/search/${property.id}`)}>
                {t.unit.openInSearch}
              </Button>
            </>
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <UnitStatusBadge status={property.status} />
        <AvailabilityChip kind={kind} date={property.available_from}
              confidence={property.availability_confidence} withCountdown />
        <Money value={property.monthly_rent} board className="text-lg font-bold text-ink" />
        <span className="text-xs text-muted">{t.ui.perMonth}</span>
      </div>

      {trackRows.length > 0 ? (
        <DepartureTrack rows={trackRows} months={Math.max(6, Math.ceil(daysUntil(lease!.end_date) / 30) + 3)} dense />
      ) : null}

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">{t.unit.tabs.details}</TabsTrigger>
          <TabsTrigger value="lease">{t.unit.tabs.lease}</TabsTrigger>
          <TabsTrigger value="tickets">
            {t.unit.tabs.tickets}
            {unitTickets.length ? <Num className="ms-1.5 text-2xs text-muted">{unitTickets.length}</Num> : null}
          </TabsTrigger>
          <TabsTrigger value="expenses">
            {t.unit.tabs.expenses}
            {unitExpenses.length ? <Num className="ms-1.5 text-2xs text-muted">{unitExpenses.length}</Num> : null}
          </TabsTrigger>
          <TabsTrigger value="protocol">{t.protocol.tab}</TabsTrigger>
          <TabsTrigger value="leads">
            {t.unit.tabs.leads}
            {unitLeads.length ? <Num className="ms-1.5 text-2xs text-muted">{unitLeads.length}</Num> : null}
          </TabsTrigger>
        </TabsList>

        {/* ── פרטים ─────────────────────────────────── */}
        <TabsContent value="details" className="space-y-5">
          {property.photos.length ? (
            <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              {property.photos.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  loading={i === 0 ? 'eager' : 'lazy'}
                  className="h-40 w-56 shrink-0 rounded-[var(--radius-card)] object-cover"
                />
              ))}
            </div>
          ) : (
            <EmptyState title={t.unit.noPhotos} hint={t.unit.noPhotosHint} compact />
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-[var(--radius-card)] border border-line p-4">
              <SectionTitle>{t.unit.specs}</SectionTitle>
              <dl className="grid grid-cols-2 gap-y-2.5 text-sm">
                <Spec label={t.properties.rooms} value={formatRooms(property.rooms)} />
                <Spec label={t.properties.sqm} value={formatSqm(property.sqm)} />
                <Spec label={t.properties.floor} value={formatFloor(property.floor, property.total_floors)} />
                <Spec label={t.properties.neighborhood} value={property.address.neighborhood} />
              </dl>
              <SectionTitle className="mb-2 mt-4">{t.unit.amenities}</SectionTitle>
              <div className="flex flex-wrap gap-1.5">
                {property.amenities.map((a) => (
                  <Badge key={a} tone="outline" size="sm">
                    {t.amenity[a]}
                  </Badge>
                ))}
              </div>
              {property.notes ? (
                <p className="mt-4 rounded-[var(--radius-control)] bg-surface p-3 text-xs leading-5 text-ink-soft">
                  {property.notes}
                </p>
              ) : null}
            </section>

            <section className="rounded-[var(--radius-card)] border border-line p-4">
              <SectionTitle>{t.unit.costs}</SectionTitle>
              <dl className="space-y-2.5 text-sm">
                <Row label={t.seeker.listing.rent} value={<Money value={property.monthly_rent} board />} />
                <Row label={t.unit.arnona} value={<Money value={property.arnona_bimonthly} board />} />
                <Row label={t.unit.vaad} value={<Money value={property.vaad_monthly} board />} />
                <div className="border-t border-line pt-2.5">
                  <Row
                    label={t.unit.totalMonthly}
                    strong
                    value={
                      <Money
                        value={
                          property.monthly_rent +
                          Math.round(property.arnona_bimonthly / 2) +
                          property.vaad_monthly
                        }
                        board
                      />
                    }
                  />
                </div>
              </dl>
            </section>
          </div>

          <RentAdjuster propertyId={property.id} />
        </TabsContent>

        {/* ── חוזה ───────────────────────────────────── */}
        <TabsContent value="lease">
          {!lease ? (
            <EmptyState
              icon={FileText}
              title={t.unit.lease.noLease}
              hint={t.unit.lease.noLeaseHint}
              action={t.properties.bulkMarkListed}
              onAction={() => {
                setListed([property.id], true);
                pushToast(t.properties.bulkMarkListed, 'success');
              }}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-[var(--radius-card)] border border-line p-4">
                <SectionTitle>{t.unit.lease.title}</SectionTitle>
                <dl className="space-y-2.5 text-sm">
                  <Row
                    label={t.unit.lease.period}
                    value={
                      <Num board>
                        {formatDate(lease.start_date)} — {formatDate(lease.end_date)}
                      </Num>
                    }
                  />
                  <Row label={t.properties.tenant} value={tenant?.name ?? '—'} />
                  <Row label={t.unit.lease.monthlyRent} value={<Money value={lease.monthly_rent} board />} />
                  <Row label={t.unit.lease.deposit} value={<Money value={lease.deposit} board />} />
                  <Row label={t.unit.lease.payment} value={t.paymentMethod[lease.payment_method]} />
                  <Row
                    label={t.unit.lease.extensionOption}
                    value={
                      lease.has_extension_option
                        ? `${t.unit.lease.hasOption} · ${lease.extension_months} ${t.ui.months}`
                        : t.unit.lease.noOption
                    }
                  />
                  <Row
                    label={t.unit.lease.noticePeriod}
                    value={
                      <>
                        <Num board>{lease.notice_period_days}</Num> {t.unit.lease.noticeDays}
                      </>
                    }
                  />
                </dl>

                <SectionTitle className="mb-2 mt-4">{t.unit.lease.guarantors}</SectionTitle>
                {lease.guarantors.length ? (
                  <ul className="space-y-1.5">
                    {lease.guarantors.map((g) => (
                      <li key={g.phone} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-ink">{g.name}</span>
                        <Phone value={g.phone} className="text-xs text-muted" />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted">{t.unit.lease.noGuarantors}</p>
                )}
              </section>

              <section className="rounded-[var(--radius-card)] border border-line p-4">
                <SectionTitle>{t.unit.lease.renewalCountdown}</SectionTitle>
                <p className="flex items-baseline gap-2">
                  <Num board className="text-2xl font-semibold text-ink">
                    {Math.max(0, daysUntil(lease.end_date))}
                  </Num>
                  <span className="text-xs text-muted">{t.unit.lease.daysLeft}</span>
                </p>
                <Meter
                  value={Math.max(0, 540 - daysUntil(lease.end_date))}
                  max={540}
                  tone={daysUntil(lease.end_date) < 90 ? 'signal' : 'ink'}
                  className="mt-3"
                  label={t.unit.lease.renewalCountdown}
                />

                <p className="mt-4 flex items-start gap-2 rounded-[var(--radius-control)] bg-surface p-3 text-2xs leading-5 text-ink-soft">
                  <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
                  <span>
                    {t.unit.lease.noticeNote
                      .replace('{days}', String(lease.notice_period_days))
                      .replace(
                        '{date}',
                        formatDate(subDays(parseISO(lease.end_date), lease.notice_period_days)),
                      )}
                  </span>
                </p>

                <div className="mt-4">
                  <SectionTitle className="mb-2">{t.unit.lease.renewalIntent}</SectionTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      tone={
                        lease.renewal_intent === 'extend'
                          ? 'liveSoft'
                          : lease.renewal_intent === 'leave'
                            ? 'signalSoft'
                            : 'neutral'
                      }
                    >
                      {lease.renewal_intent
                        ? t.unit.intent[lease.renewal_intent]
                        : t.unit.intent.unasked}
                    </Badge>
                    {lease.renewal_asked_at ? (
                      <span className="text-2xs text-muted">{formatAge(lease.renewal_asked_at)}</span>
                    ) : null}
                  </div>
                  {!lease.renewal_asked_at ? (
                    <Button
                      size="sm"
                      className="mt-3"
                      onClick={() => {
                        askRenewal(lease.id);
                        pushToast(t.unit.lease.renewalAsked, 'success');
                      }}
                    >
                      {t.unit.lease.askRenewal}
                    </Button>
                  ) : null}
                </div>
              </section>

              <OfferRail placement="lease" audience="owner" className="md:col-span-2" />
            </div>
          )}
        </TabsContent>

        {/* ── פרוטוקול ───────────────────────────────── */}
        <TabsContent value="protocol">
          <ProtocolPanel propertyId={property.id} />
        </TabsContent>

        {/* ── תקלות ──────────────────────────────────── */}
        <TabsContent value="tickets">
          {unitTickets.length === 0 ? (
            <EmptyState icon={Wrench} title={t.tickets.empty} hint={t.tickets.emptyHint} />
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line">
              {unitTickets.map((ticket) => (
                <li key={ticket.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/owner/tickets?ticket=${ticket.id}`)}
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-start transition-colors duration-150 hover:bg-surface"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">{ticket.title}</span>
                      <span className="block text-2xs text-muted">
                        {t.ticketCategory[ticket.category]} · {formatAge(ticket.created_at)}
                      </span>
                    </span>
                    {ticket.receipt ? (
                      <Money value={ticket.receipt.amount} board className="text-2xs text-muted" />
                    ) : null}
                    <SeverityBadge severity={ticket.severity} size="sm" />
                    <TicketStatusBadge status={ticket.status} size="sm" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* ── הוצאות ─────────────────────────────────── */}
        <TabsContent value="expenses">
          {unitExpenses.length === 0 ? (
            <EmptyState icon={Receipt} title={t.finance.empty} hint={t.finance.emptyHint} />
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
              <table className="w-full min-w-[40rem] border-collapse">
                <thead>
                  <tr className="border-b border-line bg-surface text-2xs text-muted">
                    <th className="p-3 text-start font-bold">{t.finance.date}</th>
                    <th className="p-3 text-start font-bold">{t.finance.category}</th>
                    <th className="p-3 text-start font-bold">{t.finance.kind}</th>
                    <th className="p-3 text-start font-bold">{t.finance.vendor}</th>
                    <th className="p-3 text-start font-bold">{t.finance.document}</th>
                    <th className="p-3 text-start font-bold">{t.finance.amount}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {unitExpenses.map((e) => (
                    <tr key={e.id} className="text-sm">
                      <td className="p-3">
                        <Num board className="text-ink-soft">
                          {formatDate(e.date)}
                        </Num>
                      </td>
                      <td className="p-3 text-ink">{expenseCategoryLabel(e.category)}</td>
                      <td className="p-3">
                        <Badge tone={e.kind === 'improvement' ? 'liveSoft' : 'neutral'} size="sm">
                          {t.expenseKind[e.kind]}
                        </Badge>
                      </td>
                      <td className="p-3 text-ink-soft">{e.vendor_name ?? '—'}</td>
                      <td className="p-3">
                        <span className="flex items-center gap-2">
                          {e.receipt_file ? (
                            <img
                              src={e.receipt_file}
                              alt=""
                              loading="lazy"
                              className="h-8 w-6 shrink-0 rounded-[4px] border border-line object-cover"
                            />
                          ) : null}
                          <span className="text-2xs text-muted">{t.documentType[e.document_type]}</span>
                        </span>
                      </td>
                      <td className="p-3">
                        <Money value={e.amount} board className="font-bold text-ink" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── מועמדים ────────────────────────────────── */}
        <TabsContent value="leads">
          {unitLeads.length === 0 ? (
            <EmptyState
              icon={Users}
              title={t.crm.noLeadsOnUnit}
              hint={t.crm.noLeadsOnUnitHint}
              action={property.listed ? undefined : t.properties.bulkMarkListed}
              onAction={
                property.listed
                  ? undefined
                  : () => {
                      setListed([property.id], true);
                      pushToast(t.properties.bulkMarkListed, 'success');
                    }
              }
            />
          ) : (
            <>
              <p className="mb-3 text-xs text-muted">
                <Num board className="font-bold text-ink">
                  {unitLeads.length}
                </Num>{' '}
                {t.crm.leadsOnUnit}
                {property.available_from ? ` · ${formatUntil(property.available_from)}` : ''}
              </p>
              <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line">
                {unitLeads.map((lead) => {
                  const seeker = seekers.find((x) => x.id === lead.seeker_id);
                  const failed = lead.screening_flags.filter((f) => !f.passed);
                  return (
                    <li key={lead.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/owner/crm?lead=${lead.id}`)}
                        className="flex w-full items-center gap-3 px-3.5 py-3 text-start transition-colors duration-150 hover:bg-surface"
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-sunk">
                          <Num board className="text-xs font-bold text-ink-soft">
                            {lead.queue_position}
                          </Num>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-ink">{seeker?.name}</span>
                          <span className="block truncate text-2xs text-muted">
                            {t.crm.moveIn} {formatDate(lead.desired_move_in)} ·{' '}
                            {failed.length === 0
                              ? t.crm.flagsPassed
                              : `${failed.length} ${t.crm.flagsFailed}`}
                          </span>
                        </span>
                        <LeadStageBadge stage={lead.stage} size="sm" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── Small layout helpers ──────────────────────────────── */

function Spec({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-2xs text-muted">{label}</dt>
      <dd className="font-semibold text-ink">{value}</dd>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cn('text-sm', strong ? 'font-bold text-ink' : 'font-semibold text-ink-soft')}>
        {value}
      </dd>
    </div>
  );
}

/* ── Rent adjustment, with real neighbourhood comparison ── */

function RentAdjuster({ propertyId }: { propertyId: string }) {
  const { properties, leases } = useStoreShallow((s) => ({
    properties: s.properties,
    leases: s.leases,
  }));
  const adjustRent = useStore((s) => s.adjustRent);
  const pushToast = useStore((s) => s.pushToast);

  const property = properties.find((p) => p.id === propertyId)!;
  const lease = leaseForProperty(leases, propertyId);

  const [proposed, setProposed] = React.useState(String(property.monthly_rent));
  const [effective, setEffective] = React.useState(
    (lease?.end_date ?? addMonths(new Date(), 3).toISOString().slice(0, 10)).slice(0, 10),
  );

  const value = Number(proposed) || 0;
  const delta = value - property.monthly_rent;
  const pct = property.monthly_rent ? (delta / property.monthly_rent) * 100 : 0;
  const comparison = rentComparison(property, properties, value);

  return (
    <section className="rounded-[var(--radius-card)] border border-line p-4">
      <SectionTitle>{t.unit.rentAdjust.title}</SectionTitle>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t.unit.rentAdjust.current}>
          <Input
            readOnly
            dir="ltr"
            className="num bg-surface"
            value={property.monthly_rent}
            aria-label={t.unit.rentAdjust.current}
          />
        </Field>
        <Field label={t.unit.rentAdjust.proposed} htmlFor="proposed-rent">
          <Input
            id="proposed-rent"
            type="number"
            dir="ltr"
            className="num"
            value={proposed}
            onChange={(e) => setProposed(e.target.value)}
          />
        </Field>
        <Field label={t.unit.rentAdjust.effective} htmlFor="effective-date">
          <Input
            id="effective-date"
            type="date"
            dir="ltr"
            className="num"
            value={effective}
            onChange={(e) => setEffective(e.target.value)}
          />
        </Field>
      </div>

      {delta !== 0 ? (
        <p className="mt-3 flex items-center gap-2 text-sm">
          <span className="text-xs text-muted">{t.unit.rentAdjust.change}</span>
          <Money value={delta} board className={cn('font-bold', delta > 0 ? 'text-open' : 'text-alert')} />
          <Num board className="text-xs text-muted">
            ({pct > 0 ? '+' : ''}
            {pct.toFixed(1)}%)
          </Num>
        </p>
      ) : null}

      {/* Comparison against similar units in the same neighbourhood */}
      <div className="mt-4 rounded-[var(--radius-control)] bg-surface p-3">
        <p className="mb-2 text-2xs font-bold text-ink-soft">
          {t.unit.rentAdjust.comparison.replace('{neighborhood}', property.address.neighborhood)}
        </p>
        {!comparison ? (
          <p className="text-2xs text-muted">{t.unit.rentAdjust.noComparable}</p>
        ) : (
          <>
            <p className="mb-2.5 text-2xs text-muted">
              {t.unit.rentAdjust.comparisonHint
                .replace('{count}', String(comparison.comparables.length))
                .replace('{rooms}', String(property.rooms))}
            </p>
            <ul className="space-y-1.5">
              {comparison.comparables.map((c) => {
                const max = Math.max(...comparison.comparables.map((x) => x.rent), value);
                return (
                  <li key={c.property.id} className="flex items-center gap-2 text-2xs">
                    <span className="w-28 shrink-0 truncate text-muted">
                      {c.property.address.street} {c.property.address.number}
                    </span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                      <span
                        className="block h-full rounded-full bg-line-strong"
                        style={{ width: `${(c.rent / max) * 100}%` }}
                      />
                    </span>
                    <Money value={c.rent} board className="w-16 shrink-0 text-end text-muted" />
                  </li>
                );
              })}
              <li className="flex items-center gap-2 border-t border-line pt-1.5 text-2xs">
                <span className="w-28 shrink-0 truncate font-bold text-ink">
                  {t.unit.rentAdjust.yourUnit}
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                  <span
                    className="block h-full rounded-full bg-ink"
                    style={{
                      width: `${(value / Math.max(...comparison.comparables.map((x) => x.rent), value)) * 100}%`,
                    }}
                  />
                </span>
                <Money value={value} board className="w-16 shrink-0 text-end font-bold text-ink" />
              </li>
            </ul>
            <p className="mt-2.5 flex items-center gap-1.5 text-2xs text-muted">
              {t.unit.rentAdjust.median}: <Money value={comparison.median} board />
              <Badge
                tone={comparison.position === 'above' ? 'signalSoft' : comparison.position === 'below' ? 'openSoft' : 'neutral'}
                size="sm"
              >
                {comparison.position === 'above'
                  ? t.unit.rentAdjust.aboveMedian
                  : comparison.position === 'below'
                    ? t.unit.rentAdjust.belowMedian
                    : t.unit.rentAdjust.atMedian}
              </Badge>
            </p>
          </>
        )}
      </div>

      <p className="mt-3 flex items-start gap-2 text-2xs leading-5 text-muted">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {t.unit.rentAdjust.noticeInfo.replace('{days}', String(lease?.notice_period_days ?? 60))}
        </span>
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          onClick={() => {
            adjustRent(propertyId, value, effective);
            pushToast(t.unit.rentAdjust.saved, 'success');
          }}
          disabled={value <= 0}
        >
          {t.unit.rentAdjust.save}
        </Button>
        {lease ? (
          <Button
            variant="secondary"
            disabled={value <= 0}
            onClick={() => {
              adjustRent(propertyId, value, effective);
              pushToast(`${t.unit.rentAdjust.sendToTenant} · ${formatMonthYear(effective)}`, 'success');
            }}
          >
            {t.unit.rentAdjust.sendToTenant}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
