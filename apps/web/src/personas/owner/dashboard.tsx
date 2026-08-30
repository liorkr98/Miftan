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
import { useStoreShallow } from '@/data/store';
import { t, daysUntil, expenseCategoryLabel, formatAge, formatMoneyShort, formatMonthTick, formatPercent } from '@miftan/shared';
import {
  expensesByCategory,
  portfolioStats,
  portfolioTrackRows,
  rentByMonth,
  OPEN_TICKET_STATUSES,
} from '@/data/selectors';
import { DepartureTrack } from '@/components/shared/departure-track';
import { Money, Num, PageHeader } from '@/components/shared/typography';
import { Meter } from '@/components/shared/meter';
import { AXIS, ChartFrame, ChartTooltip } from '@/components/shared/charts';
import { EmptyState } from '@/components/shared/empty-state';
import { ListSkeleton, Skeleton } from '@/components/shared/skeleton';
import { SeverityBadge } from '@/components/shared/status';
import { Button } from '@/components/ui/button';
import { useDelayedReady } from '@/lib/use-delayed-ready';
import { parseISO } from 'date-fns';
import { CalendarClock, CheckCircle2, ChevronLeft, MessageCircleQuestion } from 'lucide-react';

const STATUS_DOTS = [
  { key: 'occupied', color: 'var(--color-live)' },
  { key: 'vacant', color: 'var(--color-open)' },
  { key: 'vacating', color: 'var(--color-signal)' },
  { key: 'renovating', color: 'var(--color-muted)' },
] as const;

export function OwnerDashboard() {
  const navigate = useNavigate();
  const ready = useDelayedReady();
  const { properties, leases, tickets, rentPayments, expenses, inquiries, seasonalTasks } =
    useStoreShallow((s) => ({
      properties: s.properties,
      leases: s.leases,
      tickets: s.tickets,
      rentPayments: s.rentPayments,
      expenses: s.expenses,
      inquiries: s.inquiries,
      seasonalTasks: s.seasonalTasks,
    }));

  const stats = React.useMemo(
    () => portfolioStats(properties, leases, tickets, rentPayments, expenses),
    [properties, leases, tickets, rentPayments, expenses],
  );

  const trackRows = React.useMemo(
    () => portfolioTrackRows(properties, leases),
    [properties, leases],
  );

  const months = React.useMemo(() => rentByMonth(rentPayments, 9), [rentPayments]);
  const spend = React.useMemo(
    () => expensesByCategory(expenses.filter((e) => e.kind === 'maintenance')).slice(0, 6),
    [expenses],
  );

  const attention = React.useMemo(
    () =>
      tickets
        .filter((tk) => OPEN_TICKET_STATUSES.includes(tk.status))
        .sort(
          (a, b) =>
            (b.severity === 'urgent' ? 1 : 0) - (a.severity === 'urgent' ? 1 : 0) ||
            a.created_at.localeCompare(b.created_at),
        )
        .slice(0, 5),
    [tickets],
  );

  const propertyById = React.useMemo(
    () => new Map(properties.map((p) => [p.id, p])),
    [properties],
  );

  const outstanding = stats.expectedThisMonth - stats.collectedThisMonth;
  const waitingInquiries = inquiries.filter(
    (x) => x.status === 'new' || x.status === 'answered',
  ).length;
  const dueSoon = seasonalTasks.filter(
    (x) => x.status === 'due' && daysUntil(x.due_date) <= 45,
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader title={t.dashboard.title} subtitle={t.ui.demoNote} />

      {/* Portfolio line — an instrument reading, not four stat cards */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3">
        <span className="flex items-baseline gap-1.5">
          <Num board className="text-2xl font-semibold text-ink">
            {stats.total}
          </Num>
          <span className="text-xs font-bold text-ink-soft">{t.dashboard.unitsOwned}</span>
        </span>
        <span className="h-6 w-px bg-line-strong" aria-hidden />
        {STATUS_DOTS.map((dot) => {
          const value = stats[dot.key as keyof typeof stats] as number;
          return (
            <span key={dot.key} className="flex items-center gap-1.5 text-xs">
              <span className="h-2 w-2 rounded-full" style={{ background: dot.color }} aria-hidden />
              <Num board className="font-semibold text-ink">
                {value}
              </Num>
              <span className="text-muted">{t.status[dot.key]}</span>
            </span>
          );
        })}
        <span className="h-6 w-px bg-line-strong max-sm:hidden" aria-hidden />
        <span className="flex items-center gap-1.5 text-xs">
          <Num board className="font-semibold text-signal-deep">
            {stats.expiring90}
          </Num>
          <span className="text-muted">{t.dashboard.expiringSoon}</span>
        </span>
      </div>

      {/* Money + tickets */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-[var(--radius-card)] border border-line p-4">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-bold text-ink">{t.dashboard.collectedThisMonth}</h2>
            <span className="text-xs font-bold text-ink-soft">
              {formatPercent(stats.collectionRate)}
            </span>
          </div>
          {ready ? (
            <>
              <p className="flex items-baseline gap-2">
                <Money value={stats.collectedThisMonth} board className="text-2xl font-semibold text-ink" />
                <span className="text-xs text-muted">
                  {t.dashboard.ofExpected} <Money value={stats.expectedThisMonth} board />
                </span>
              </p>
              <Meter
                value={stats.collectedThisMonth}
                max={stats.expectedThisMonth}
                tone={stats.collectionRate > 95 ? 'open' : 'signal'}
                className="mt-3"
                label={t.dashboard.collectionRate}
              />
              {outstanding > 0 ? (
                <p className="mt-2 text-xs text-muted">
                  {t.finance.outstanding}: <Money value={outstanding} board className="font-bold text-alert" />
                </p>
              ) : null}
            </>
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-2 w-full" />
            </div>
          )}
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
            <Money value={stats.maintenanceYtd} board className="font-bold text-ink" />
          </p>
        </section>
      </div>

      {/* Two things that need the owner and have no other home on this page */}
      {(waitingInquiries > 0 || dueSoon > 0) && ready ? (
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
      ) : null}

      {/* ── The signature element ─────────────────────── */}
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
        {ready ? (
          <DepartureTrack
            rows={trackRows}
            months={18}
            showRent
            onRowClick={(row) => navigate(`/owner/properties/${row.property_id}`)}
          />
        ) : (
          <Skeleton className="h-[26rem] w-full rounded-[var(--radius-card)]" />
        )}
      </section>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame title={t.dashboard.rentByMonth}>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barGap={2}>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                {/* reversed: months read right-to-left, like everything else */}
                <XAxis
                  dataKey="month"
                  reversed
                  axisLine={{ stroke: AXIS.stroke }}
                  tickLine={false}
                  tick={AXIS.tick}
                  tickFormatter={(m: string) => formatMonthTick(parseISO(`${m}-01`))}
                />
                <YAxis
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={AXIS.tick}
                  width={44}
                  tickFormatter={(v: number) => formatMoneyShort(v)}
                />
                <Tooltip
                  cursor={{ fill: 'var(--color-surface)' }}
                  content={({ active, label, payload }) => (
                    <ChartTooltip
                      active={active}
                      label={label ? formatMonthTick(parseISO(`${label}-01`)) : undefined}
                      rows={[
                        { key: 'due', label: t.dashboard.expected, value: Number(payload?.[0]?.payload?.due ?? 0), color: 'var(--color-line-strong)', money: true },
                        { key: 'paid', label: t.dashboard.collected, value: Number(payload?.[0]?.payload?.paid ?? 0), color: 'var(--color-ink)', money: true },
                      ]}
                    />
                  )}
                />
                <Bar dataKey="due" fill="var(--color-line-strong)" radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                <Bar dataKey="paid" fill="var(--color-ink)" radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartFrame>

        <ChartFrame title={t.dashboard.spendByCategory}>
          {spend.length ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={spend}
                  layout="vertical"
                  margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
                >
                  <CartesianGrid stroke="var(--color-line)" horizontal={false} />
                  <XAxis type="number" reversed axisLine={false} tickLine={false} tick={AXIS.tick} tickFormatter={(v: number) => formatMoneyShort(v)} />
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
      </div>

      {/* Needs attention */}
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
        {!ready ? (
          <ListSkeleton rows={3} />
        ) : attention.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title={t.dashboard.nothingUrgent}
            hint={t.dashboard.nothingUrgentHint}
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line">
            {attention.map((ticket) => {
              const property = propertyById.get(ticket.property_id);
              return (
                <li key={ticket.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/owner/tickets?ticket=${ticket.id}`)}
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-start transition-colors duration-150 hover:bg-surface"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">{ticket.title}</span>
                      <span className="block truncate text-2xs text-muted">
                        {property ? `${property.address.street} ${property.address.number}` : ''} ·{' '}
                        {t.ticketCategory[ticket.category]} · {formatAge(ticket.created_at)}
                      </span>
                    </span>
                    <SeverityBadge severity={ticket.severity} size="sm" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
