import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { t, formatDateTime } from '@miftan/shared';
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Building2,
  CalendarDays,
  ChevronLeft,
  Eye,
  RefreshCw,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useInquiries, useThreads } from '@/api/hooks';
import { PageHeader, Num } from '@/components/shared/typography';
import { ErrorState } from '@/components/shared/error-state';
import { ListSkeleton } from '@/components/shared/skeleton';
import { PhaseChip, TurnBadge } from '@/components/shared/phase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { OwnerCrm } from './crm';
import { OwnerInquiries } from './inquiries';
import { OwnerMessages } from './messages';
import { AttentionList, WeekAgenda } from './attention';
import { PerformanceSection } from './performance';
import { matchesFilter, rowSummary, usePortfolio, type ListFilter, type PortfolioRow } from './portfolio-model';

type Tab = 'overview' | 'leads' | 'inquiries' | 'messages';
const A = t.activity;

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

/**
 * The owner's activity area — what used to be "leads & inquiries".
 *
 * It opens on the portfolio: what is happening across the flats, what is
 * waiting on the owner, and how interest is moving. Applicants, availability
 * questions and messages are still here, one tab away, exactly as they were;
 * they are now the detail behind the overview rather than the whole page.
 *
 * Portfolio → property → action: every row and every attention item opens the
 * property it is about, and the property page is where the action happens.
 */
export function OwnerActivity() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab | null) ?? 'overview';
  const { data: inquiries = [] } = useInquiries();
  const { data: threads } = useThreads();
  const model = usePortfolio({ live: true });

  const inquiryCount = inquiries.filter((x) => x.scope === 'owner' && (x.status === 'new' || x.status === 'answered')).length;
  const unread = threads?.totalUnread ?? 0;
  const setTab = (v: string) => setParams({ tab: v }, { replace: true });

  return (
    <div className="space-y-5">
      <PageHeader title={t.leadsHub.title} subtitle={t.leadsHub.subtitle} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">
            {t.leadsHub.tabOverview}
            {model.attention.length ? <Num className="ms-1.5 text-2xs text-muted">{model.attention.length}</Num> : null}
          </TabsTrigger>
          <TabsTrigger value="leads">
            {t.leadsHub.tabLeads}
            {model.totals.applicants ? <Num className="ms-1.5 text-2xs text-muted">{model.totals.applicants}</Num> : null}
          </TabsTrigger>
          <TabsTrigger value="inquiries">
            {t.leadsHub.tabInquiries}
            {inquiryCount ? <Num className="ms-1.5 text-2xs text-muted">{inquiryCount}</Num> : null}
          </TabsTrigger>
          <TabsTrigger value="messages">
            {t.leadsHub.tabMessages}
            {unread ? <Num className="ms-1.5 text-2xs text-muted">{unread}</Num> : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Overview model={model} />
        </TabsContent>
        <TabsContent value="leads">
          <OwnerCrm />
        </TabsContent>
        <TabsContent value="inquiries">
          <OwnerInquiries />
        </TabsContent>
        <TabsContent value="messages">
          <OwnerMessages />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Overview({ model }: { model: ReturnType<typeof usePortfolio> }) {
  const [filter, setFilter] = React.useState<ListFilter>('all');
  const listRef = React.useRef<HTMLElement>(null);

  if (model.isError) return <ErrorState onRetry={model.refetch} />;
  if (model.isLoading) return <ListSkeleton rows={6} />;

  const { totals } = model;
  const pick = (f: ListFilter) => {
    setFilter((cur) => (cur === f ? 'all' : f));
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-5">
      {/* The portfolio in five numbers. Each one narrows the list below. */}
      <section aria-label={A.tiles.filterHint}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Tile
            Icon={Building2}
            value={totals.active}
            label={A.tiles.active}
            sub={totals.needYou ? fill(A.tiles.activeSub, { n: totals.needYou }) : A.tiles.activeCalm}
            strong={totals.needYou > 0}
            pressed={filter === 'attention'}
            onClick={() => pick('attention')}
          />
          <Tile
            Icon={RefreshCw}
            value={totals.renewals}
            label={A.tiles.renewals}
            sub={totals.renewalsInProgress ? fill(A.tiles.renewalsSub, { n: totals.renewalsInProgress }) : A.tiles.renewalsNone}
            pressed={filter === 'renewal'}
            onClick={() => pick('renewal')}
          />
          <Tile
            Icon={Users}
            value={totals.applicants}
            label={A.tiles.applicants}
            sub={fill(A.tiles.applicantsSub, { n: totals.relevant })}
            pressed={filter === 'applicants'}
            onClick={() => pick('applicants')}
          />
          <Tile
            Icon={CalendarDays}
            value={totals.upcoming}
            label={A.tiles.viewings}
            sub={fill(A.tiles.viewingsSub, { n: totals.upcomingWeek })}
            pressed={filter === 'viewings'}
            onClick={() => pick('viewings')}
          />
          <Tile
            Icon={Bell}
            value={totals.alerts}
            label={A.tiles.alerts}
            sub={A.tiles.alertsSub}
            pressed={filter === 'alerts'}
            onClick={() => pick('alerts')}
            className="col-span-2 sm:col-span-1"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <AttentionList items={model.attention} />
        <WeekAgenda agenda={model.agenda} />
      </div>

      <PropertyList ref={listRef} rows={model.rows} filter={filter} setFilter={setFilter} />

      <PerformanceSection rows={model.rows} className="border-t border-line pt-5" />
    </div>
  );
}

function Tile({
  Icon,
  value,
  label,
  sub,
  pressed,
  strong,
  onClick,
  className,
}: {
  Icon: LucideIcon;
  value: number;
  label: string;
  sub: string;
  pressed: boolean;
  strong?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'press-sm flex flex-col items-start gap-1 rounded-[var(--radius-card)] border p-3.5 text-start transition-colors',
        pressed ? 'border-ink bg-surface' : 'border-line hover:border-line-strong',
        className,
      )}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="text-xs font-bold text-ink-soft">{label}</span>
        <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      </span>
      <span className="text-3xl font-extrabold leading-none text-ink">{value.toLocaleString('he-IL')}</span>
      <span className={cn('text-2xs', strong ? 'font-bold text-ink' : 'text-muted')}>{sub}</span>
    </button>
  );
}

const FILTERS: ListFilter[] = ['all', 'attention', 'renewal', 'applicants', 'viewings', 'alerts'];

const PropertyList = React.forwardRef<
  HTMLElement,
  { rows: PortfolioRow[]; filter: ListFilter; setFilter: (f: ListFilter) => void }
>(function PropertyList({ rows, filter, setFilter }, ref) {
  const shown = rows.filter((r) => matchesFilter(r, filter));
  return (
    <section ref={ref} aria-labelledby="props-title" className="scroll-mt-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="props-title" className="text-base font-extrabold text-ink">{A.list.title}</h2>
      </div>
      <div role="group" aria-label={A.list.title} className="hide-scrollbar mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const n = rows.filter((r) => matchesFilter(r, f)).length;
          return (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                'touch-chip shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold',
                filter === f ? 'border-ink bg-ink text-on-ink' : 'border-line text-ink-soft hover:border-line-strong',
              )}
            >
              {A.list.filters[f]} <span className="num opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-line p-5 text-center">
          <p className="text-sm text-muted">{A.list.empty}</p>
          <button type="button" onClick={() => setFilter('all')} className="mt-1 text-xs font-bold text-ink underline-offset-2 hover:underline">
            {A.list.showAll}
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line">
          {shown.map((row) => (
            <PropertyRow key={row.property.id} row={row} />
          ))}
        </ul>
      )}
    </section>
  );
});

function PropertyRow({ row }: { row: PortfolioRow }) {
  const navigate = useNavigate();
  const p = row.property;
  const snap = row.snapshot;
  const views = snap?.views7d ?? 0;
  const before = snap?.viewsPrev7d ?? 0;
  const change = before > 0 ? Math.round(((views - before) / before) * 100) : null;
  const photo = p.photos?.[0];

  return (
    <li>
      <button
        type="button"
        onClick={() => navigate(`/owner/properties/${p.id}`, { state: { from: 'activity' } })}
        className="flex w-full items-start gap-3 px-3.5 py-3 text-start transition-colors duration-150 hover:bg-surface"
      >
        {photo ? (
          <img src={photo} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-[var(--radius-control)] object-cover" />
        ) : (
          <span className="h-14 w-14 shrink-0 rounded-[var(--radius-control)] bg-surface-sunk" aria-hidden />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-bold text-ink">{row.label}</span>
            <span className="text-2xs text-muted">{p.address.neighborhood} · {p.address.city}</span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <PhaseChip phase={row.phase} size="sm" />
            <TurnBadge turn={row.turn} size="sm" />
          </span>
          <span className={cn('mt-1 block text-xs', row.turn === 'you' ? 'font-semibold text-ink' : 'text-ink-soft')}>
            {rowSummary(row)}
          </span>
          {p.listed || (snap?.applicants ?? 0) > 0 || (snap?.alerts ?? 0) > 0 ? (
            <span className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-2xs text-muted">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" aria-hidden />
                {fill(A.list.views, { n: views })}
                {change !== null && Math.abs(change) >= 10 ? (
                  <span
                    className={cn('flex items-center font-bold', change > 0 ? 'text-open-deep' : 'text-alert-deep')}
                    title={fill(change > 0 ? A.list.up : A.list.down, { p: Math.abs(change) })}
                  >
                    {change > 0 ? <ArrowUpRight className="h-3 w-3" aria-hidden /> : <ArrowDownRight className="h-3 w-3" aria-hidden />}
                    <span className="sr-only">{fill(change > 0 ? A.list.up : A.list.down, { p: Math.abs(change) })}</span>
                    <span aria-hidden>{Math.abs(change)}%</span>
                  </span>
                ) : null}
              </span>
              {snap && snap.applicants > 0 ? (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" aria-hidden />
                  {fill(A.list.applicants, { n: snap.applicants, m: snap.relevant })}
                </span>
              ) : null}
              {snap && snap.alerts > 0 ? (
                <span className="flex items-center gap-1">
                  <Bell className="h-3 w-3" aria-hidden />
                  {fill(A.list.alerts, { n: snap.alerts })}
                </span>
              ) : null}
              {snap?.nextAppointmentAt ? (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" aria-hidden />
                  {fill(A.list.next, { date: formatDateTime(snap.nextAppointmentAt) })}
                </span>
              ) : null}
            </span>
          ) : null}
        </span>
        <ChevronLeft className="mt-1 h-4 w-4 shrink-0 text-muted" aria-hidden />
      </button>
    </li>
  );
}
