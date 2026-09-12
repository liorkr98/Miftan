import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  t,
  daysUntil,
  expenseCategoryLabel,
  formatAge,
  formatMoneyShort,
  toShekels,
  type OwnerProperty,
  type TicketView,
  type TrackRow,
} from '@miftan/shared';
import { useExpenses, useInquiries, useLeads, useProperties, useSeasonal, useTickets } from '@/api/hooks';
import { AVAILABILITY_TONE } from '@/data/selectors';
import { DepartureTrack } from '@/components/shared/departure-track';
import { Money, Num, PageHeader } from '@/components/shared/typography';
import { AXIS, ChartFrame, ChartTooltip } from '@/components/shared/charts';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { ListSkeleton } from '@/components/shared/skeleton';
import { SeverityBadge } from '@/components/shared/status';
import { Button } from '@/components/ui/button';
import { CalendarClock, CheckCircle2, ChevronLeft, MessageCircleQuestion } from 'lucide-react';

const STATUS_DOTS = [
  { key: 'occupied', color: 'var(--color-live)' },
  { key: 'vacant', color: 'var(--color-open)' },
  { key: 'vacating', color: 'var(--color-signal)' },
  { key: 'renovating', color: 'var(--color-muted)' },
] as const;

const OPEN = ['new', 'approved', 'assigned', 'in_progress', 'awaiting_receipt'];

export function OwnerDashboard() {
  const navigate = useNavigate();
  const {
    data: properties,
    isLoading: propertiesLoading,
    isError: propertiesError,
    refetch: refetchProperties,
  } = useProperties();
  const { data: tickets = [] } = useTickets();
  const { data: inquiries = [] } = useInquiries();
  const { data: leads = [] } = useLeads();
  const { data: seasonal } = useSeasonal();
  const { data: expenseData } = useExpenses();

  const owned = React.useMemo(
    () => (properties ?? []).filter((p): p is OwnerProperty => p.scope === 'owner'),
    [properties],
  );
  const ownerTickets = React.useMemo(
    () => tickets.filter((tk): tk is TicketView & { scope: 'owner' } => tk.scope === 'owner'),
    [tickets],
  );
  const ownerInquiries = inquiries.filter((x) => x.scope === 'owner');
  const queueCount = leads.filter((l) => l.scope === 'owner').length;

  const stats = React.useMemo(() => {
    const counts = { occupied: 0, vacant: 0, vacating: 0, renovating: 0 };
    let expiring90 = 0;
    for (const p of owned) {
      counts[p.status] += 1;
      if (p.lease && daysUntil(p.lease.endDate) <= 90 && daysUntil(p.lease.endDate) >= 0) {
        expiring90 += 1;
      }
    }
    const open = ownerTickets.filter((tk) => OPEN.includes(tk.status));
    const year = new Date().getFullYear();
    const maintenanceYtdAgorot = (expenseData?.expenses ?? [])
      .filter((e) => e.kind === 'maintenance' && e.date.startsWith(String(year)))
      .reduce((sum, e) => sum + e.amountAgorot, 0);

    return {
      total: owned.length,
      ...counts,
      expiring90,
      openTickets: open.length,
      urgentTickets: open.filter((tk) => tk.severity === 'urgent').length,
      maintenanceYtdAgorot,
    };
  }, [owned, ownerTickets, expenseData]);

  const trackRows: TrackRow[] = React.useMemo(
    () =>
      owned
        .map((p) => ({
          id: p.id,
          property_id: p.id,
          label: `${p.address.street} ${p.address.number}`,
          sublabel: p.address.neighborhood,
          from: new Date().toISOString().slice(0, 10),
          until: p.availability.date ?? undefined,
          tone: AVAILABILITY_TONE[p.availability.kind],
          confidence: p.availability.confidence,
          meta: String(toShekels(p.monthlyRentAgorot)),
        }))
        .sort((a, b) => {
          if (!a.until) return 1;
          if (!b.until) return -1;
          return a.until.localeCompare(b.until);
        }),
    [owned],
  );

  const spend = React.useMemo(() => {
    const byKey = new Map<string, number>();
    for (const expense of expenseData?.expenses ?? []) {
      if (expense.kind !== 'maintenance') continue;
      byKey.set(expense.category, (byKey.get(expense.category) ?? 0) + toShekels(expense.amountAgorot));
    }
    return [...byKey.entries()]
      .map(([key, amount]) => ({ key, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [expenseData]);

  const attention = React.useMemo(
    () =>
      ownerTickets
        .filter((tk) => OPEN.includes(tk.status))
        .slice()
        .sort(
          (a, b) =>
            (b.severity === 'urgent' ? 1 : 0) - (a.severity === 'urgent' ? 1 : 0) ||
            a.createdAt.localeCompare(b.createdAt),
        )
        .slice(0, 5),
    [ownerTickets],
  );

  const waitingInquiries = ownerInquiries.filter(
    (x) => x.status === 'new' || x.status === 'answered',
  ).length;
  const dueSoon = (seasonal?.tasks ?? []).filter(
    (x) => x.status === 'due' && daysUntil(x.dueDate) <= 45,
  ).length;
  const outstandingExpectedSaving = seasonal?.outstandingExpectedSaving ?? 0;

  if (propertiesError) return <ErrorState onRetry={() => void refetchProperties()} />;
  if (propertiesLoading) return <ListSkeleton rows={8} />;

  return (
    <div className="space-y-6">
      <PageHeader title={t.dashboard.title} />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3">
        <span className="flex items-baseline gap-1.5">
          <Num board className="text-2xl font-semibold text-ink">
            {stats.total}
          </Num>
          <span className="text-xs font-bold text-ink-soft">{t.dashboard.unitsOwned}</span>
        </span>
        <span className="h-6 w-px bg-line-strong" aria-hidden />
        {STATUS_DOTS.map((dot) => (
          <span key={dot.key} className="flex items-center gap-1.5 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ background: dot.color }} aria-hidden />
            <Num board className="font-semibold text-ink">
              {stats[dot.key]}
            </Num>
            <span className="text-muted">{t.status[dot.key]}</span>
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-xs">
          <Num board className="font-semibold text-ink">
            {queueCount}
          </Num>
          <span className="text-muted">{t.crm.inQueue}</span>
        </span>
        <span className="h-6 w-px bg-line-strong max-sm:hidden" aria-hidden />
        <span className="flex items-center gap-1.5 text-xs">
          <Num board className="font-semibold text-signal-deep">
            {stats.expiring90}
          </Num>
          <span className="text-muted">{t.dashboard.expiringSoon}</span>
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Collection rate needs rent payments, which do not exist yet.
            A live dashboard must not mix in a fixture figure. The seasonal
            expected saving is the number we actually have. */}
        <section className="rounded-[var(--radius-card)] border border-line p-4">
          <h2 className="mb-1 text-sm font-bold text-ink">{t.seasonal.potentialSaving}</h2>
          <Money value={outstandingExpectedSaving} board className="text-2xl font-semibold text-ink" />
          <p className="mt-1.5 text-2xs leading-4 text-muted">{t.seasonal.potentialSavingHint}</p>
          <Button
            variant="quiet"
            size="sm"
            className="mt-3"
            onClick={() => navigate('/owner/maintenance')}
          >
            {t.seasonal.title}
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
        </section>

        <section className="rounded-[var(--radius-card)] border border-line p-4">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-bold text-ink">{t.dashboard.openTickets}</h2>
            <Button variant="quiet" size="sm" onClick={() => navigate('/owner/tickets')}>
              {t.dashboard.viewAll}
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-baseline gap-4">
            <Num board className="text-2xl font-semibold text-ink">
              {stats.openTickets}
            </Num>
            {stats.urgentTickets > 0 ? (
              <span className="flex items-center gap-1.5 text-xs">
                <SeverityBadge severity="urgent" size="sm" />
                <Num board className="font-bold text-ink">
                  {stats.urgentTickets}
                </Num>
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-xs text-muted">
            {t.dashboard.maintenanceYtd}:{' '}
            <Money agorot={stats.maintenanceYtdAgorot} board className="font-bold text-ink" />
          </p>
        </section>
      </div>

      {(waitingInquiries > 0 || dueSoon > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {waitingInquiries > 0 ? (
            <button
              type="button"
              onClick={() => navigate('/owner/inquiries')}
              className="press-sm flex items-center gap-3 rounded-[var(--radius-card)] border border-signal/50 bg-signal-soft/40 p-3.5 text-start transition-[border-color,transform] duration-150 ease-[var(--ease-out)] hover:border-signal"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-signal text-ink">
                <MessageCircleQuestion className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink">{t.inquiries.title}</span>
                <span className="block text-2xs text-muted">{t.inquiries.subtitle}</span>
              </span>
              <Num board className="text-xl font-semibold text-ink">
                {waitingInquiries}
              </Num>
            </button>
          ) : null}

          {dueSoon > 0 ? (
            <button
              type="button"
              onClick={() => navigate('/owner/maintenance')}
              className="press-sm flex items-center gap-3 rounded-[var(--radius-card)] border border-line p-3.5 text-start transition-[border-color,transform] duration-150 ease-[var(--ease-out)] hover:border-line-strong"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-surface">
                <CalendarClock className="h-4 w-4 text-ink-soft" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink">{t.seasonal.title}</span>
                <span className="block text-2xs text-muted">{t.seasonal.subtitle}</span>
              </span>
              <Num board className="text-xl font-semibold text-ink">
                {dueSoon}
              </Num>
            </button>
          ) : null}
        </div>
      )}

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold tracking-[-0.01em] text-ink">{t.track.title}</h2>
            <p className="text-xs text-muted">{t.track.subtitle}</p>
          </div>
          <span className="text-2xs text-muted">
            <Num board>{trackRows.length}</Num> {t.track.rowsShown}
          </span>
        </div>
        {trackRows.length ? (
          <DepartureTrack
            rows={trackRows}
            months={18}
            showRent
            onRowClick={(row) => navigate(`/owner/properties/${row.property_id}`)}
          />
        ) : (
          <EmptyState icon={CheckCircle2} title={t.properties.empty} hint={t.properties.emptyHint} />
        )}
      </section>

      <ChartFrame title={t.dashboard.spendByCategory}>
        {spend.length ? (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={spend} layout="vertical" margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--color-line)" horizontal={false} />
                <XAxis
                  type="number"
                  reversed
                  axisLine={false}
                  tickLine={false}
                  tick={AXIS.tick}
                  tickFormatter={(v: number) => formatMoneyShort(v)}
                />
                <YAxis
                  type="category"
                  dataKey="key"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  width={78}
                  tick={{ fill: 'var(--color-ink-soft)', fontSize: 11 }}
                  tickFormatter={expenseCategoryLabel}
                />
                <Tooltip
                  cursor={{ fill: 'var(--color-surface)' }}
                  content={({ active, payload }) => (
                    <ChartTooltip
                      active={active}
                      rows={[
                        {
                          key: 'amount',
                          label: t.finance.amount,
                          value: Number(payload?.[0]?.value ?? 0),
                          color: 'var(--color-ink)',
                          money: true,
                        },
                      ]}
                    />
                  )}
                />
                <Bar dataKey="amount" radius={[0, 3, 3, 0]} maxBarSize={18} isAnimationActive={false}>
                  {spend.map((row, i) => (
                    <Cell key={row.key} fill={i === 0 ? 'var(--color-ink)' : 'var(--color-line-strong)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState title={t.finance.empty} hint={t.finance.emptyHint} compact />
        )}
      </ChartFrame>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-bold text-ink">{t.dashboard.needsAttention}</h2>
          {attention.length ? (
            <Button variant="quiet" size="sm" onClick={() => navigate('/owner/tickets')}>
              {t.dashboard.viewAll}
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
        {attention.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title={t.dashboard.nothingUrgent}
            hint={t.dashboard.nothingUrgentHint}
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line">
            {attention.map((ticket) => (
              <li key={ticket.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/owner/tickets?ticket=${ticket.id}`)}
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-start transition-colors duration-150 hover:bg-surface"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink">{ticket.title}</span>
                    <span className="block truncate text-2xs text-muted">
                      {ticket.propertyLabel} · {t.ticketCategory[ticket.category]} · {formatAge(ticket.createdAt)}
                    </span>
                  </span>
                  <SeverityBadge severity={ticket.severity} size="sm" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
