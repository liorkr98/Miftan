import * as React from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useStore } from '@/data/store';
import {
  t,
  DEMAND_PHASES,
  SCHEDULING_PHASES,
  daysUntil,
  expenseCategoryLabel,
  formatAge,
  formatDate,
  formatFloor,
  formatRooms,
  formatSqm,
  type Amenity,
  type ExpenseView,
  type OwnerLead,
  type OwnerProperty,
  type TicketView,
  type TrackRow,
} from '@miftan/shared';
import { AVAILABILITY_TONE } from '@/data/selectors';
import {
  useExpenses,
  useLeads,
  usePortfolioSnapshot,
  useProperty,
  useRenewals,
  useTickets,
  useUpdateProperty,
} from '@/api/hooks';
import { TurnoverPanel } from './turnover';
import { ApplicantsTab } from './applicants';
import { PropertyCalendar } from './calendar';
import { PerformanceSection } from './performance';
import { rowFor, type PortfolioRow } from './portfolio-model';
import { PhaseChip, TurnBadge } from '@/components/shared/phase';
import { DepartureTrack } from '@/components/shared/departure-track';
import { ProtocolPanel } from '@/components/shared/protocol';
import { OfferRail } from '@/components/shared/revenue';
import { InviteCard } from './invite-card';
import { Money, Num, PageHeader, Phone, SectionTitle } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { ListSkeleton } from '@/components/shared/skeleton';
import {
  AvailabilityChip,
  SeverityBadge,
  TicketStatusBadge,
} from '@/components/shared/status';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/field';
import { Meter } from '@/components/shared/meter';
import { cn } from '@/lib/utils';
import { parseISO, subDays } from 'date-fns';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  FileText,
  MapPin,
  Receipt,
  Wrench,
  Pencil,
  Share2,
} from 'lucide-react';
import { PropertyFormDialog } from './property-form';
import { PhotoManager } from './photo-manager';

function amenityLabel(key: string): string {
  return key in t.amenity ? t.amenity[key as Amenity] : key;
}

export function OwnerUnitDetail() {
  /* ?tab=… opens a tab directly; ?do=… opens a renewal step; ?add=1 opens
     "add times" on the calendar. Attention items link here with them. */
  const [searchParams, setSearchParams] = useSearchParams();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: property, isLoading, isError, refetch } = useProperty(id);
  const { data: tickets = [] } = useTickets({ propertyId: id });
  const { data: leads = [] } = useLeads(id);
  const { data: renewals = [] } = useRenewals({ live: true });
  const { data: snapshot } = usePortfolioSnapshot({ live: true });
  const requestedTab = searchParams.get('tab');
  const [tab, setTab] = React.useState<string | null>(requestedTab === 'viewings' ? 'schedule' : requestedTab);
  /* Read once: a step opened from a link should not reopen on every render. */
  const [autoOpen] = React.useState(() => searchParams.get('do'));
  const [autoAdd] = React.useState(() => searchParams.get('add') === '1');
  React.useEffect(() => {
    if (searchParams.has('do') || searchParams.has('add')) {
      const next = new URLSearchParams(searchParams);
      next.delete('do');
      next.delete('add');
      setSearchParams(next, { replace: true, state: location.state });
    }
  }, [searchParams, setSearchParams, location.state]);
  const { data: expenseData } = useExpenses(id);
  const updateProperty = useUpdateProperty();
  const [editOpen, setEditOpen] = React.useState(false);
  const pushToast = useStore((s) => s.pushToast);
  /* Captured on arrival: cleaning ?do= out of the URL replaces the history
     entry, and the origin would go with it. */
  const [from] = React.useState(() => (location.state as { from?: string } | null)?.from);
  const back =
    from === 'activity'
      ? { to: '/owner/activity', label: t.control.backActivity }
      : from === 'dashboard'
        ? { to: '/owner', label: t.control.backDashboard }
        : { to: '/owner/properties', label: t.control.backProperties };

  const owned = property?.scope === 'owner' ? property : undefined;
  const unitTickets = tickets.filter((tk): tk is TicketView & { scope: 'owner' } => tk.scope === 'owner');
  /* Ranked by screening score — there is no queue order. */
  const unitLeads = leads
    .filter((l): l is OwnerLead => l.scope === 'owner')
    .sort((a, b) => b.score - a.score);
  const unitExpenses = [...(expenseData?.expenses ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  /* People who applied — not the ones only waiting for an alert. */
  const applications = unitLeads.filter((l) => !l.watchOnly).length;

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

  const row = rowFor(owned, renewals, snapshot?.properties.find((x) => x.propertyId === owned.id) ?? null);
  const renewal = row.renewal;
  const showPanel = renewal && (renewal.stage !== 'upcoming' || daysUntil(renewal.opensOn) <= 30) && renewal.stage !== 'closed';
  const snap = row.snapshot;

  /* Which tabs belong here right now. The page answers to the flat's phase:
     a quiet lease keeps to the basics; a search puts applicants and the
     calendar first. */
  const hasSchedule =
    (SCHEDULING_PHASES.includes(row.phase) && (row.phase !== 'renewal' || renewal?.stage === 'staying')) ||
    (snap?.openSlots ?? 0) + (snap?.upcomingViewings ?? 0) > 0 ||
    (renewal?.meetingSlots.length ?? 0) > 0;
  const hasApplicants = DEMAND_PHASES.includes(row.phase) || unitLeads.length > 0;
  const hasPerformance = owned.listed || (snap?.views7d ?? 0) > 0;
  const lead: { value: string; label: React.ReactNode }[] = [
    ...(hasSchedule ? [{ value: 'schedule', label: t.control.tabs.schedule }] : []),
    ...(hasApplicants
      ? [{ value: 'leads', label: <>{t.unit.tabs.leads}{applications ? <Num className="ms-1.5 text-2xs text-muted">{applications}</Num> : null}</> }]
      : []),
  ];
  const demandFirst = DEMAND_PHASES.includes(row.phase) || row.phase === 'renewal_agreed';
  const tabs: { value: string; label: React.ReactNode }[] = [
    ...(demandFirst ? lead : []),
    { value: 'details', label: t.unit.tabs.details },
    { value: 'lease', label: t.unit.tabs.lease },
    ...(!demandFirst ? lead : []),
    ...(hasPerformance ? [{ value: 'performance', label: t.control.tabs.performance }] : []),
    { value: 'tickets', label: <>{t.unit.tabs.tickets}{unitTickets.length ? <Num className="ms-1.5 text-2xs text-muted">{unitTickets.length}</Num> : null}</> },
    { value: 'expenses', label: <>{t.unit.tabs.expenses}{unitExpenses.length ? <Num className="ms-1.5 text-2xs text-muted">{unitExpenses.length}</Num> : null}</> },
    { value: 'protocol', label: t.protocol.tab },
  ];
  const defaultTab =
    row.phase === 'viewings' || row.phase === 'renewal_agreed'
      ? 'schedule'
      : row.phase === 'searching'
        ? row.turn === 'you' && (snap?.openSlots ?? 0) === 0 && (snap?.relevantWithoutViewing ?? 0) > 0
          ? 'schedule'
          : 'leads'
        : row.phase === 'renewal' || row.phase === 'renewal_soon'
          ? 'lease'
          : 'details';
  const activeTab = tab && tabs.some((x) => x.value === tab) ? tab : tabs.some((x) => x.value === defaultTab) ? defaultTab : 'details';
  const goTab = (v: string) => {
    setTab(v);
    requestAnimationFrame(() => document.getElementById('unit-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

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
        {/* Where you are: one level up is the portfolio you came from. */}
        <Button
          variant="quiet"
          size="sm"
          className="-ms-2 mb-1"
          onClick={() => navigate(back.to)}
        >
          <ArrowRight className="h-3.5 w-3.5" />
          {back.label}
        </Button>
        <PageHeader
          title={`${owned.address.street} ${owned.address.number}`}
          subtitle={`${owned.address.neighborhood} · ${owned.address.city}`}
          actions={
            <>
              <label className="flex items-center gap-2 rounded-[var(--radius-control)] border border-line px-3 py-2 text-xs font-semibold text-ink-soft">
                <Switch
                  checked={owned.listed}
                  onCheckedChange={(listed) => updateProperty.mutate({ id: owned.id, listed })}
                  aria-label={t.unit.listedToggle}
                  disabled={updateProperty.isPending}
                />
                {owned.listed ? t.unit.listedOn : t.unit.listedOff}
              </label>
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5" />
                {t.properties.edit}
              </Button>
              {owned.listed ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    /* The public page, which previews properly in WhatsApp. */
                    const url = `${window.location.origin}/l/${owned.id}`;
                    const text = `${owned.address.street} · ${url}`;
                    if (navigator.share) {
                      void navigator.share({ text, url }).catch(() => undefined);
                    } else {
                      void navigator.clipboard.writeText(url).then(
                        () => pushToast(t.publicListing.shareCopied, 'success'),
                        () => undefined,
                      );
                    }
                  }}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  {t.publicListing.shareOwner}
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => navigate(`/search/${owned.id}`)}>
                {t.unit.openInSearch}
              </Button>
            </>
          }
        />
      </div>

      <PropertyFormDialog open={editOpen} onOpenChange={setEditOpen} property={owned} />

      {/* The flat at a glance: who lives here, until when, for how much, and where it is in its life. */}
      <FactStrip property={owned} row={row} />

      {/* What is happening, and the one thing to do next. */}
      {showPanel && renewal ? (
        <TurnoverPanel
          key={renewal.leaseId}
          view={renewal}
          property={owned}
          autoOpen={autoOpen}
          onShowApplicants={() => goTab('leads')}
        />
      ) : (
        <CalmCard
          row={row}
          onSchedule={() => goTab('schedule')}
          onApplicants={() => goTab('leads')}
          onPublish={() => updateProperty.mutate({ id: owned.id, listed: true })}
          publishing={updateProperty.isPending}
        />
      )}

      {trackRows.length > 0 && !DEMAND_PHASES.includes(row.phase) ? (
        <DepartureTrack
          rows={trackRows}
          months={Math.max(6, Math.ceil(daysUntil(lease!.endDate) / 30) + 3)}
          dense
        />
      ) : null}

      <Tabs value={activeTab} onValueChange={setTab} id="unit-tabs" className="scroll-mt-4">
        <TabsList>
          {tabs.map((x) => (
            <TabsTrigger key={x.value} value={x.value}>
              {x.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="schedule">
          <PropertyCalendar propertyId={owned.id} renewal={renewal} leads={unitLeads} autoAdd={autoAdd} />
        </TabsContent>
        <TabsContent value="leads">
          <ApplicantsTab property={owned} leads={unitLeads} />
        </TabsContent>
        <TabsContent value="performance">
          <PerformanceSection rows={[row]} fixedPropertyId={owned.id} />
        </TabsContent>
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
      </Tabs>
    </div>
  );
}

const F = t.control.facts;

function FactStrip({ property, row }: { property: OwnerProperty; row: PortfolioRow }) {
  const lease = property.lease;
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-4">
      <Fact label={F.status}>
        <span className="flex flex-wrap items-center gap-1.5">
          <PhaseChip phase={row.phase} size="sm" />
          <TurnBadge turn={row.turn} size="sm" />
        </span>
      </Fact>
      <Fact label={F.tenant}>
        {property.tenant ? (
          <span className="flex flex-col">
            <span className="font-bold text-ink">{property.tenant.name}</span>
            {property.tenant.phone ? <Phone value={property.tenant.phone} className="text-2xs text-muted" /> : null}
          </span>
        ) : (
          <span className="text-ink-soft">{F.noTenant}</span>
        )}
      </Fact>
      <Fact label={F.leaseEnd}>
        {lease ? (
          <span className="flex flex-col">
            <Num board className="font-bold text-ink">{formatDate(lease.endDate)}</Num>
            <span className="text-2xs text-muted">{F.inDays.replace('{n}', String(Math.max(0, daysUntil(lease.endDate))))}</span>
          </span>
        ) : (
          <AvailabilityChip
            kind={property.availability.kind}
            date={property.availability.date ?? undefined}
            confidence={property.availability.confidence}
          />
        )}
      </Fact>
      <Fact label={F.rent}>
        <span className="flex items-baseline gap-1">
          <Money agorot={lease?.monthlyRentAgorot ?? property.monthlyRentAgorot} board className="font-bold text-ink" />
          <span className="text-2xs text-muted">{t.ui.perMonth}</span>
        </span>
      </Fact>
    </dl>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-bg px-3.5 py-3">
      <dt className="mb-1 text-2xs text-muted">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

/**
 * The status card for a flat with no renewal under way — so every property
 * page still answers: what is happening, do I need to do anything, what next.
 */
function CalmCard({
  row,
  onSchedule,
  onApplicants,
  onPublish,
  publishing,
}: {
  row: PortfolioRow;
  onSchedule: () => void;
  onApplicants: () => void;
  onPublish: () => void;
  publishing: boolean;
}) {
  const K = t.control.calm;
  const p = row.property;
  const snap = row.snapshot;
  const fill = (s: string, vars: Record<string, string | number>) =>
    s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

  let title: string = K.stableTitle;
  let hint = '';
  let action: { label: string; onClick: () => void } | null = null;

  switch (row.phase) {
    case 'vacant':
      title = K.vacantTitle;
      hint = K.vacantHint;
      action = { label: K.publish, onClick: onPublish };
      break;
    case 'renovating':
      title = K.renovatingTitle;
      hint = K.renovatingHint;
      break;
    case 'searching':
    case 'viewings': {
      const needTimes = (snap?.relevantWithoutViewing ?? 0) > 0 && (snap?.openSlots ?? 0) === 0;
      const next = needTimes ? K.nextTimes : (snap?.applicants ?? 0) > 0 ? K.nextReview : K.nextWait;
      title = t.lifecycle.phase[row.phase];
      hint = fill(K.searchingHint, { applicants: snap?.applicants ?? 0, alerts: snap?.alerts ?? 0, next });
      action = needTimes
        ? { label: K.nextTimes, onClick: onSchedule }
        : row.phase === 'viewings'
          ? { label: K.openSchedule, onClick: onSchedule }
          : (snap?.applicants ?? 0) > 0
            ? { label: K.openApplicants, onClick: onApplicants }
            : null;
      break;
    }
    default: {
      const opens = row.renewal?.opensOn;
      hint = p.lease
        ? fill(K.stableHint, { tenant: p.tenant?.name ?? '', date: formatDate(p.lease.endDate), opens: opens ? formatDate(opens) : '' })
        : '';
    }
  }

  return (
    <section className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-line p-4">
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-extrabold text-ink">{title}</h2>
        {hint ? <p className="mt-0.5 text-sm leading-6 text-ink-soft">{hint}</p> : null}
      </div>
      {action ? (
        <Button size="lg" loading={publishing && action.onClick === onPublish} onClick={action.onClick}>
          {action.label}
          <ArrowLeft className="h-4 w-4" />
        </Button>
      ) : null}
    </section>
  );
}

function DetailsTab({ property }: { property: OwnerProperty }) {
  const totalMonthlyAgorot =
    property.monthlyRentAgorot +
    Math.round(property.arnonaBimonthlyAgorot / 2) +
    property.vaadMonthlyAgorot;

  return (
    <>
      <PhotoManager property={property} />

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
      <div className="grid gap-4 md:grid-cols-2">
        <EmptyState
          icon={FileText}
          title={t.unit.lease.noLease}
          hint={t.unit.lease.noLeaseHint}
          className="md:col-span-2"
        />
        <InviteCard property={property} />
      </div>
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

      <InviteCard property={property} />
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
