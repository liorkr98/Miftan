import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '@/data/store';
import {
  t,
  daysUntil,
  expenseCategoryLabel,
  formatAge,
  formatDate,
  formatDateTime,
  formatFloor,
  formatRooms,
  formatSqm,
  formatUntil,
  type Amenity,
  type ExpenseView,
  type OwnerLead,
  type OwnerProperty,
  type OwnerSlot,
  type TicketView,
  type TrackRow,
} from '@miftan/shared';
import { AVAILABILITY_TONE } from '@/data/selectors';
import {
  useExpenses,
  useLeads,
  useProperty,
  usePublishSlots,
  useTickets,
  useViewingAction,
  useViewings,
} from '@/api/hooks';
import { DepartureTrack } from '@/components/shared/departure-track';
import { ProtocolPanel } from '@/components/shared/protocol';
import { OfferRail } from '@/components/shared/revenue';
import { Money, Num, PageHeader, Phone, SectionTitle } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { ListSkeleton } from '@/components/shared/skeleton';
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
import { Field, Input } from '@/components/ui/field';
import { Meter } from '@/components/shared/meter';
import { cn } from '@/lib/utils';
import { parseISO, subDays } from 'date-fns';
import {
  ArrowRight,
  CalendarClock,
  FileText,
  MapPin,
  Receipt,
  Users,
  Wrench,
} from 'lucide-react';

function amenityLabel(key: string): string {
  return key in t.amenity ? t.amenity[key as Amenity] : key;
}

export function OwnerUnitDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: property, isLoading, isError, refetch } = useProperty(id);
  const { data: tickets = [] } = useTickets({ propertyId: id });
  const { data: leads = [] } = useLeads(id);
  const { data: expenseData } = useExpenses(id);

  const owned = property?.scope === 'owner' ? property : undefined;
  const unitTickets = tickets.filter((tk): tk is TicketView & { scope: 'owner' } => tk.scope === 'owner');
  const unitLeads = leads.filter((l): l is OwnerLead => l.scope === 'owner');
  const unitExpenses = [...(expenseData?.expenses ?? [])].sort((a, b) => b.date.localeCompare(a.date));

  if (isError) return <ErrorState onRetry={() => void refetch()} />;
  if (isLoading) return <ListSkeleton rows={8} />;
  if (!owned) {
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

  const lease = owned.lease;
  const kind = owned.availability.kind;
  const trackRows: TrackRow[] = lease
    ? [
        {
          id: lease.id,
          property_id: owned.id,
          label: `${owned.address.street} ${owned.address.number}`,
          sublabel: owned.tenant?.name,
          from: new Date().toISOString().slice(0, 10),
          until: lease.endDate,
          tone: AVAILABILITY_TONE[kind],
          confidence: owned.availability.confidence,
          marks: [
            {
              at: subDays(parseISO(lease.endDate), lease.noticePeriodDays).toISOString().slice(0, 10),
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
          title={`${owned.address.street} ${owned.address.number}`}
          subtitle={`${owned.address.neighborhood} · ${owned.address.city}`}
          actions={
            <>
              <span
                className="flex items-center gap-2 rounded-[var(--radius-control)] border border-line px-3 py-2 text-xs font-semibold text-ink-soft"
                title={t.unit.listedReadOnly}
              >
                <Badge tone={owned.listed ? 'openSoft' : 'neutral'} size="sm">
                  {owned.listed ? t.properties.listed : t.properties.notListed}
                </Badge>
              </span>
              <Button variant="secondary" onClick={() => navigate(`/search/${owned.id}`)}>
                {t.unit.openInSearch}
              </Button>
            </>
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <UnitStatusBadge status={owned.status} />
        <AvailabilityChip
          kind={kind}
          date={owned.availability.date ?? undefined}
          confidence={owned.availability.confidence}
          withCountdown
        />
        <Money agorot={owned.monthlyRentAgorot} board className="text-lg font-bold text-ink" />
        <span className="text-xs text-muted">{t.ui.perMonth}</span>
      </div>

      {trackRows.length > 0 ? (
        <DepartureTrack
          rows={trackRows}
          months={Math.max(6, Math.ceil(daysUntil(lease!.endDate) / 30) + 3)}
          dense
        />
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
          <TabsTrigger value="viewings">{t.unit.tabs.viewings}</TabsTrigger>
          <TabsTrigger value="leads">
            {t.unit.tabs.leads}
            {unitLeads.length ? <Num className="ms-1.5 text-2xs text-muted">{unitLeads.length}</Num> : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-5">
          <DetailsTab property={owned} />
        </TabsContent>
        <TabsContent value="lease">
          <LeaseTab property={owned} />
        </TabsContent>
        <TabsContent value="protocol">
          <ProtocolPanel propertyId={owned.id} />
        </TabsContent>
        <TabsContent value="tickets">
          <TicketsTab tickets={unitTickets} />
        </TabsContent>
        <TabsContent value="expenses">
          <ExpensesTab expenses={unitExpenses} />
        </TabsContent>
        <TabsContent value="viewings">
          <ViewingsTab propertyId={owned.id} />
        </TabsContent>
        <TabsContent value="leads">
          <LeadsTab property={owned} leads={unitLeads} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DetailsTab({ property }: { property: OwnerProperty }) {
  const totalMonthlyAgorot =
    property.monthlyRentAgorot +
    Math.round(property.arnonaBimonthlyAgorot / 2) +
    property.vaadMonthlyAgorot;

  return (
    <>
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
            <Spec label={t.properties.floor} value={formatFloor(property.floor, property.totalFloors)} />
            <Spec label={t.properties.neighborhood} value={property.address.neighborhood} />
          </dl>
          <SectionTitle className="mb-2 mt-4">{t.unit.amenities}</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {property.amenities.map((a) => (
              <Badge key={a} tone="outline" size="sm">
                {amenityLabel(a)}
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
            <Row label={t.seeker.listing.rent} value={<Money agorot={property.monthlyRentAgorot} board />} />
            <Row label={t.unit.arnona} value={<Money agorot={property.arnonaBimonthlyAgorot} board />} />
            <Row label={t.unit.vaad} value={<Money agorot={property.vaadMonthlyAgorot} board />} />
            <div className="border-t border-line pt-2.5">
              <Row
                label={t.unit.totalMonthly}
                strong
                value={<Money agorot={totalMonthlyAgorot} board />}
              />
            </div>
          </dl>
        </section>
      </div>
    </>
  );
}

function LeaseTab({ property }: { property: OwnerProperty }) {
  const lease = property.lease;
  const tenant = property.tenant;

  if (!lease) {
    return (
      <EmptyState icon={FileText} title={t.unit.lease.noLease} hint={t.unit.lease.noLeaseHint} />
    );
  }

  const intentTone =
    lease.renewalIntent === 'extend'
      ? 'liveSoft'
      : lease.renewalIntent === 'leave'
        ? 'signalSoft'
        : 'neutral';

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-[var(--radius-card)] border border-line p-4">
        <SectionTitle>{t.unit.lease.title}</SectionTitle>
        <dl className="space-y-2.5 text-sm">
          <Row
            label={t.unit.lease.period}
            value={
              <Num board>
                {formatDate(lease.startDate)} — {formatDate(lease.endDate)}
              </Num>
            }
          />
          <Row
            label={t.properties.tenant}
            value={
              tenant ? (
                <span className="flex items-center gap-2">
                  {tenant.name}
                  {tenant.phone ? <Phone value={tenant.phone} className="text-xs text-muted" /> : null}
                </span>
              ) : (
                '—'
              )
            }
          />
          <Row label={t.unit.lease.monthlyRent} value={<Money agorot={lease.monthlyRentAgorot} board />} />
          <Row label={t.unit.lease.deposit} value={<Money agorot={lease.depositAgorot} board />} />
          <Row label={t.unit.lease.payment} value={t.paymentMethod[lease.paymentMethod]} />
          <Row
            label={t.unit.lease.extensionOption}
            value={
              lease.hasExtensionOption
                ? `${t.unit.lease.hasOption} · ${lease.extensionMonths ?? 0} ${t.ui.months}`
                : t.unit.lease.noOption
            }
          />
          <Row
            label={t.unit.lease.noticePeriod}
            value={
              <>
                <Num board>{lease.noticePeriodDays}</Num> {t.unit.lease.noticeDays}
              </>
            }
          />
        </dl>

        <SectionTitle className="mb-2 mt-4">{t.unit.lease.guarantors}</SectionTitle>
        <p className="text-xs text-muted">{t.unit.lease.noGuarantors}</p>
      </section>

      <section className="rounded-[var(--radius-card)] border border-line p-4">
        <SectionTitle>{t.unit.lease.renewalCountdown}</SectionTitle>
        <p className="flex items-baseline gap-2">
          <Num board className="text-2xl font-semibold text-ink">
            {Math.max(0, daysUntil(lease.endDate))}
          </Num>
          <span className="text-xs text-muted">{t.unit.lease.daysLeft}</span>
        </p>
        <Meter
          value={Math.max(0, 540 - daysUntil(lease.endDate))}
          max={540}
          tone={daysUntil(lease.endDate) < 90 ? 'signal' : 'ink'}
          className="mt-3"
          label={t.unit.lease.renewalCountdown}
        />

        <p className="mt-4 flex items-start gap-2 rounded-[var(--radius-control)] bg-surface p-3 text-2xs leading-5 text-ink-soft">
          <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
          <span>
            {t.unit.lease.noticeNote
              .replace('{days}', String(lease.noticePeriodDays))
              .replace('{date}', formatDate(subDays(parseISO(lease.endDate), lease.noticePeriodDays)))}
          </span>
        </p>

        <div className="mt-4">
          <SectionTitle className="mb-2">{t.unit.lease.renewalIntent}</SectionTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={intentTone}>
              {lease.renewalIntent ? t.unit.intent[lease.renewalIntent] : t.unit.intent.unasked}
            </Badge>
            {lease.renewalAskedAt ? (
              <span className="text-2xs text-muted">{formatAge(lease.renewalAskedAt)}</span>
            ) : null}
          </div>
        </div>
      </section>

      <OfferRail placement="lease" audience="owner" className="md:col-span-2" />
    </div>
  );
}

function TicketsTab({ tickets }: { tickets: TicketView[] }) {
  const navigate = useNavigate();
  if (tickets.length === 0) {
    return <EmptyState icon={Wrench} title={t.tickets.empty} hint={t.tickets.emptyHint} />;
  }
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line">
      {tickets.map((ticket) => (
        <li key={ticket.id}>
          <button
            type="button"
            onClick={() => navigate(`/owner/tickets?ticket=${ticket.id}`)}
            className="flex w-full items-center gap-3 px-3.5 py-3 text-start transition-colors duration-150 hover:bg-surface"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-ink">{ticket.title}</span>
              <span className="block text-2xs text-muted">
                {t.ticketCategory[ticket.category]} · {formatAge(ticket.createdAt)}
              </span>
            </span>
            {ticket.receipt ? (
              <Money agorot={ticket.receipt.amountAgorot} board className="text-2xs text-muted" />
            ) : null}
            <SeverityBadge severity={ticket.severity} size="sm" />
            <TicketStatusBadge status={ticket.status} size="sm" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function ExpensesTab({ expenses }: { expenses: ExpenseView[] }) {
  if (expenses.length === 0) {
    return <EmptyState icon={Receipt} title={t.finance.empty} hint={t.finance.emptyHint} />;
  }
  return (
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
          {expenses.map((e) => (
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
              <td className="p-3 text-ink-soft">{e.vendorName ?? '—'}</td>
              <td className="p-3">
                <span className="flex items-center gap-2">
                  {e.receiptFile ? (
                    <img
                      src={e.receiptFile}
                      alt=""
                      loading="lazy"
                      className="h-8 w-6 shrink-0 rounded-[4px] border border-line object-cover"
                    />
                  ) : null}
                  <span className="text-2xs text-muted">{t.documentType[e.documentType]}</span>
                </span>
              </td>
              <td className="p-3">
                <Money agorot={e.amountAgorot} board className="font-bold text-ink" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeadsTab({ property, leads }: { property: OwnerProperty; leads: OwnerLead[] }) {
  const navigate = useNavigate();
  if (leads.length === 0) {
    return <EmptyState icon={Users} title={t.crm.noLeadsOnUnit} hint={t.crm.noLeadsOnUnitHint} />;
  }
  return (
    <>
      <p className="mb-3 text-xs text-muted">
        <Num board className="font-bold text-ink">
          {leads.length}
        </Num>{' '}
        {t.crm.leadsOnUnit}
        {property.availability.date ? ` · ${formatUntil(property.availability.date)}` : ''}
      </p>
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line">
        {leads.map((lead) => {
          const failed = lead.flags.filter((f) => !f.passed);
          return (
            <li key={lead.id}>
              <button
                type="button"
                onClick={() => navigate(`/owner/crm?lead=${lead.id}`)}
                className="flex w-full items-center gap-3 px-3.5 py-3 text-start transition-colors duration-150 hover:bg-surface"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-sunk">
                  <Num board className="text-xs font-bold text-ink-soft">
                    {lead.queuePosition}
                  </Num>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">{lead.seeker.name}</span>
                  <span className="block truncate text-2xs text-muted">
                    {t.crm.moveIn} {formatDate(lead.desiredMoveIn)} ·{' '}
                    {failed.length === 0 ? t.crm.flagsPassed : `${failed.length} ${t.crm.flagsFailed}`}
                  </span>
                </span>
                <LeadStageBadge stage={lead.stage} size="sm" />
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function ViewingsTab({ propertyId }: { propertyId: string }) {
  const pushToast = useStore((s) => s.pushToast);
  const { data, isLoading, isError, refetch } = useViewings(propertyId);
  const publish = usePublishSlots();
  const action = useViewingAction();
  const [date, setDate] = React.useState('');
  const [from, setFrom] = React.useState('16:00');
  const [until, setUntil] = React.useState('18:00');

  const slots = (data?.slots ?? []).filter((s): s is OwnerSlot => s.scope === 'owner');

  if (isError) return <ErrorState onRetry={() => void refetch()} />;
  if (isLoading) return <ListSkeleton rows={4} />;

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-card)] border border-line p-4">
        <SectionTitle>{t.viewings.publish}</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t.viewings.date} htmlFor="slot-date">
            <Input
              id="slot-date"
              type="date"
              dir="ltr"
              className="num"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label={t.viewings.from} htmlFor="slot-from">
            <Input
              id="slot-from"
              type="time"
              dir="ltr"
              className="num"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label={t.viewings.until} htmlFor="slot-until">
            <Input
              id="slot-until"
              type="time"
              dir="ltr"
              className="num"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
          </Field>
        </div>
        <Button
          className="mt-3"
          loading={publish.isPending}
          disabled={!date}
          onClick={() =>
            publish.mutate(
              { propertyId, date, from, until, durationMinutes: 15, gapMinutes: 5 },
              { onSuccess: () => pushToast(t.viewings.published, 'success') },
            )
          }
        >
          {t.viewings.publish}
        </Button>
      </section>

      {slots.length === 0 ? (
        <EmptyState icon={CalendarClock} title={t.viewings.empty} hint={t.viewings.emptyHint} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line">
          {slots.map((slot) => (
            <li key={slot.id} className="flex flex-wrap items-center gap-3 px-3.5 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink">
                  <Num board>{formatDateTime(slot.startsAt)}</Num>
                </span>
                <span className="block text-2xs text-muted">
                  {slot.applicant
                    ? `${t.viewings.applicant}: ${slot.applicant.name}`
                    : t.viewings.status.open}
                </span>
              </span>
              <Badge tone={slot.status === 'open' ? 'openSoft' : slot.status === 'cancelled' ? 'neutral' : 'liveSoft'} size="sm">
                {t.viewings.status[slot.status]}
              </Badge>
              {slot.status === 'open' || slot.status === 'booked' ? (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={action.isPending}
                  onClick={() =>
                    action.mutate(
                      { id: slot.id, action: 'cancel' },
                      { onSuccess: () => pushToast(t.viewings.cancelled, 'success') },
                    )
                  }
                >
                  {t.ui.cancel}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
      <dd className={cn('text-sm', strong ? 'font-bold text-ink' : 'font-semibold text-ink-soft')}>{value}</dd>
    </div>
  );
}
