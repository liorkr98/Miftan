import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { t, daysUntil, formatDate, israelToday, type Funnel, type PortfolioAnalytics } from '@miftan/shared';
import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Minus, TrendingDown } from 'lucide-react';
import { usePortfolioAnalytics } from '@/api/hooks';
import { AXIS, ChartTooltip } from '@/components/shared/charts';
import { PhaseChip } from '@/components/shared/phase';
import { Num } from '@/components/shared/typography';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PortfolioRow } from './portfolio-model';

const P = t.activity.perf;

type Period = 'd7' | 'd30' | 'm3' | 'custom';
const SPAN: Record<Exclude<Period, 'custom'>, number> = { d7: 7, d30: 30, m3: 90 };

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const spanOf = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
const shortDate = (iso: string) => `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}`;

/** Days for short ranges; weeks once a month would be a comb of single days. */
function bucket(daily: { date: string; views: number }[]) {
  if (daily.length <= 45) return daily.map((d) => ({ key: d.date, label: shortDate(d.date), views: d.views, weekly: false }));
  const out: { key: string; label: string; views: number; weekly: boolean }[] = [];
  for (let i = 0; i < daily.length; i += 7) {
    const chunk = daily.slice(i, i + 7);
    out.push({ key: chunk[0].date, label: shortDate(chunk[0].date), views: chunk.reduce((s, d) => s + d.views, 0), weekly: true });
  }
  return out;
}

function seriesFor(data: PortfolioAnalytics | undefined, propertyId: string) {
  if (!data) return [];
  if (propertyId !== 'all') return data.properties.find((p) => p.propertyId === propertyId)?.daily ?? [];
  const days = data.properties[0]?.daily.map((d) => d.date) ?? [];
  return days.map((date, i) => ({ date, views: data.properties.reduce((s, p) => s + (p.daily[i]?.views ?? 0), 0) }));
}

function funnelFor(data: PortfolioAnalytics | undefined, propertyId: string): Funnel | null {
  if (!data) return null;
  if (propertyId === 'all') return data.portfolio;
  return data.properties.find((p) => p.propertyId === propertyId)?.funnel ?? null;
}

/**
 * How interest moved, and where it stops.
 *
 * One filter row drives both charts, so "this flat, last 30 days" means the
 * same thing in the line and in the funnel. On a property page the property is
 * fixed and its selector disappears.
 */
export function PerformanceSection({
  rows,
  fixedPropertyId,
  className,
}: {
  rows: PortfolioRow[];
  fixedPropertyId?: string;
  className?: string;
}) {
  const navigate = useNavigate();
  const today = israelToday();
  const [propertyId, setPropertyId] = React.useState(fixedPropertyId ?? 'all');
  const [period, setPeriod] = React.useState<Period>('d30');
  const [custom, setCustom] = React.useState({ from: addDays(today, -59), to: today });

  const range =
    period === 'custom' ? custom : { from: addDays(today, -(SPAN[period] - 1)), to: today };
  const span = spanOf(range.from, range.to);
  const prev = { from: addDays(range.from, -span), to: addDays(range.from, -1) };

  const current = usePortfolioAnalytics(range.from, range.to);
  const previous = usePortfolioAnalytics(prev.from, prev.to);

  const series = bucket(seriesFor(current.data, propertyId));
  const total = seriesFor(current.data, propertyId).reduce((s, d) => s + d.views, 0);
  const before = seriesFor(previous.data, propertyId).reduce((s, d) => s + d.views, 0);
  const delta = before > 0 ? Math.round(((total - before) / before) * 100) : null;
  const funnel = funnelFor(current.data, propertyId);
  const row = rows.find((r) => r.property.id === propertyId) ?? null;
  const listed = rows.filter((r) => r.property.listed || r.snapshot?.views7d);

  return (
    <section aria-labelledby="perf-title" className={cn('space-y-4', className)}>
      <div>
        <h2 id="perf-title" className="text-base font-extrabold text-ink">{P.title}</h2>
        <p className="text-xs text-muted">{P.hint}</p>
      </div>

      {/* One row of filters, above both charts. */}
      <div className="flex flex-wrap items-end gap-2">
        {fixedPropertyId ? null : (
          <label className="block min-w-0 text-2xs font-bold text-ink-soft">
            {P.property}
            <select
              className="touch-field mt-1 block h-10 w-full max-w-[16rem] rounded-[var(--radius-control)] border border-line bg-bg px-3 text-sm font-semibold text-ink focus:border-ink focus:outline-none"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
            >
              <option value="all">{P.all}</option>
              {listed.map((r) => (
                <option key={r.property.id} value={r.property.id}>{r.label}</option>
              ))}
            </select>
          </label>
        )}
        <div role="group" aria-label={P.period} className="flex flex-wrap gap-1">
          {(Object.keys(P.periods) as Period[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={period === key}
              onClick={() => setPeriod(key)}
              className={cn(
                'touch-chip h-10 rounded-full border px-3 text-xs font-semibold',
                period === key ? 'border-ink bg-ink text-on-ink' : 'border-line text-ink-soft hover:border-line-strong',
              )}
            >
              {P.periods[key]}
            </button>
          ))}
        </div>
        {period === 'custom' ? (
          <div className="flex gap-2">
            <label className="text-2xs font-bold text-ink-soft">
              {P.from}
              <input
                type="date"
                dir="ltr"
                max={custom.to}
                value={custom.from}
                onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))}
                className="touch-field mt-1 block h-10 rounded-[var(--radius-control)] border border-line bg-bg px-2 text-sm text-ink num"
              />
            </label>
            <label className="text-2xs font-bold text-ink-soft">
              {P.to}
              <input
                type="date"
                dir="ltr"
                min={custom.from}
                max={today}
                value={custom.to}
                onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))}
                className="touch-field mt-1 block h-10 rounded-[var(--radius-control)] border border-line bg-bg px-2 text-sm text-ink num"
              />
            </label>
          </div>
        ) : null}
      </div>

      {row && !fixedPropertyId ? (
        <PropertyFacts row={row} onOpen={() => navigate(`/owner/properties/${row.property.id}`, { state: { from: 'activity' } })} />
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <ViewsChart
          title={propertyId === 'all' ? P.viewsTitle : P.viewsTitleOne}
          series={series}
          total={total}
          delta={delta}
          loading={current.isLoading}
        />
        <FunnelPanel funnel={funnel} />
      </div>

      {funnel && propertyId !== 'all' ? <MetricGrid funnel={funnel} /> : null}
    </section>
  );
}

function PropertyFacts({ row, onOpen }: { row: PortfolioRow; onOpen: () => void }) {
  const lease = row.property.lease;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[var(--radius-card)] bg-surface px-4 py-3 text-sm">
      <span className="flex items-center gap-2">
        <span className="text-2xs text-muted">{P.status}</span>
        <PhaseChip phase={row.phase} size="sm" />
      </span>
      <span>
        <span className="text-2xs text-muted">{P.tenant} </span>
        <span className="font-semibold text-ink">{row.property.tenant?.name ?? t.control.facts.noTenant}</span>
      </span>
      {lease ? (
        <span>
          <span className="text-2xs text-muted">{P.leaseEnd} </span>
          <Num board className="font-semibold text-ink">{formatDate(lease.endDate)}</Num>
          <span className="text-2xs text-muted"> · {t.control.facts.inDays.replace('{n}', String(Math.max(0, daysUntil(lease.endDate))))}</span>
        </span>
      ) : null}
      <Button variant="quiet" size="sm" className="ms-auto" onClick={onOpen}>
        {P.openProperty}
        <ArrowLeft className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function ViewsChart({
  title,
  series,
  total,
  delta,
  loading,
}: {
  title: string;
  series: { key: string; label: string; views: number; weekly: boolean }[];
  total: number;
  delta: number | null;
  loading: boolean;
}) {
  const trend = delta === null ? null : delta >= 10 ? 'rising' : delta <= -10 ? 'falling' : 'steady';
  const TrendIcon = trend === 'rising' ? ArrowUpRight : trend === 'falling' ? ArrowDownRight : Minus;

  return (
    <div className="rounded-[var(--radius-card)] border border-line p-4">
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-4xl font-extrabold leading-none text-ink">{total.toLocaleString('he-IL')}</span>
        <span className="text-xs text-muted">{P.total}</span>
        {trend ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-bold',
              trend === 'rising' ? 'bg-open-soft text-open-deep' : trend === 'falling' ? 'bg-alert-soft text-alert-deep' : 'bg-surface-sunk text-ink-soft',
            )}
          >
            <TrendIcon className="h-3 w-3" aria-hidden />
            {P[trend]} · {P.vsPrev.replace('{sign}', delta! > 0 ? '+' : '').replace('{p}', String(delta))}
          </span>
        ) : null}
      </div>

      <div className={cn('mt-3 h-48 transition-opacity', loading && 'opacity-50')}>
        {total === 0 && !loading ? (
          <p className="grid h-full place-items-center text-sm text-muted">{P.noViews}</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="views-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-live)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--color-live)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-line)" vertical={false} />
              <XAxis
                dataKey="label"
                reversed
                axisLine={false}
                tickLine={false}
                tick={AXIS.tick}
                interval="preserveStartEnd"
                minTickGap={18}
              />
              <YAxis orientation="right" axisLine={false} tickLine={false} tick={AXIS.tick} allowDecimals={false} width={30} />
              <Tooltip
                cursor={{ stroke: 'var(--color-line-strong)', strokeWidth: 1 }}
                content={({ active, payload }) => {
                  const point = payload?.[0]?.payload as (typeof series)[number] | undefined;
                  return (
                    <ChartTooltip
                      active={active}
                      label={point ? (point.weekly ? P.weekOf.replace('{date}', formatDate(point.key)) : formatDate(point.key)) : undefined}
                      rows={[{ key: 'views', label: P.metrics.views, value: Number(payload?.[0]?.value ?? 0), color: 'var(--color-live)' }]}
                    />
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="views"
                stroke="var(--color-live)"
                strokeWidth={2}
                fill="url(#views-fill)"
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-bg)' }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* The values, for anyone who can't — or would rather not — read them off a line. */}
      <details className="mt-2">
        <summary className="cursor-pointer text-2xs font-bold text-ink-soft">{P.table}</summary>
        <div className="mt-2 max-h-48 overflow-y-auto rounded-[var(--radius-control)] border border-line">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface text-2xs text-muted">
              <tr>
                <th className="p-2 text-start font-bold">{P.tableDate}</th>
                <th className="p-2 text-start font-bold">{P.tableViews}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {series.map((d) => (
                <tr key={d.key}>
                  <td className="p-2 num text-ink-soft">{d.weekly ? P.weekOf.replace('{date}', formatDate(d.key)) : formatDate(d.key)}</td>
                  <td className="p-2 num font-semibold text-ink">{d.views}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

const STAGES = ['uniqueViewers', 'alerts', 'applications', 'relevant', 'viewingsBooked'] as const;

/**
 * Each stage as a share of the one before it — so the bar that is short is
 * the step where people stop, which is the one worth fixing.
 */
function FunnelPanel({ funnel }: { funnel: Funnel | null }) {
  const steps = STAGES.map((key, i) => {
    const value = funnel?.[key] ?? 0;
    const prevValue = i === 0 ? null : funnel?.[STAGES[i - 1]] ?? 0;
    const rate = prevValue === null ? 100 : prevValue > 0 ? Math.min(100, Math.round((value / prevValue) * 100)) : null;
    return { key, value, rate };
  });
  /* The weakest step worth acting on. Most viewers of a flat that is still
     occupied never ask for an alert — that drop is normal, not a problem —
     so the marker looks from applications onwards. */
  const candidates = steps.slice(2).filter((s) => s.rate !== null);
  const weakest = candidates.length ? candidates.reduce((a, b) => ((b.rate ?? 100) < (a.rate ?? 100) ? b : a)) : null;

  return (
    <div className="rounded-[var(--radius-card)] border border-line p-4">
      <h3 className="text-sm font-bold text-ink">{P.funnelTitle}</h3>
      <p className="mb-3 text-2xs text-muted">{P.funnelHint}</p>
      <ol className="space-y-2.5">
        {steps.map((step, i) => {
          const isWeakest = weakest?.key === step.key && (step.rate ?? 100) < 100;
          return (
            <li key={step.key}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-ink-soft">{P.stages[step.key]}</span>
                <span className="flex items-baseline gap-2">
                  {i > 0 && step.rate !== null ? (
                    <span className="text-2xs text-muted">{P.ofPrev.replace('{p}', String(step.rate))}</span>
                  ) : null}
                  <span className="text-base font-extrabold text-ink">{step.value.toLocaleString('he-IL')}</span>
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-sunk">
                <div
                  className={cn('h-full rounded-full', isWeakest ? 'bg-signal' : 'bg-live')}
                  style={{ width: `${Math.max(step.value > 0 ? 3 : 0, step.rate ?? 0)}%` }}
                />
              </div>
              {isWeakest ? (
                <p className="mt-1 flex items-start gap-1.5 text-2xs leading-4 text-signal-deep">
                  <TrendingDown className="mt-px h-3 w-3 shrink-0" aria-hidden />
                  <span>
                    <span className="font-bold">{P.drop}.</span> {P.dropHint[step.key as keyof typeof P.dropHint]}
                  </span>
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
      {funnel && funnel.viewingsCompleted > 0 ? (
        <p className="mt-3 border-t border-line pt-2 text-2xs text-muted">
          {P.completed.replace('{n}', String(funnel.viewingsCompleted))}
        </p>
      ) : null}
    </div>
  );
}

/** Every number for one flat, behind one tap — the funnel already shows the story. */
function MetricGrid({ funnel }: { funnel: Funnel }) {
  const [open, setOpen] = React.useState(false);
  const keys = ['views', 'uniqueViewers', 'alerts', 'applications', 'relevant', 'viewingsBooked', 'viewingsCompleted'] as const;
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs font-bold text-ink-soft underline-offset-2 hover:underline"
      >
        {open ? P.less : P.more}
        <ArrowRight className={cn('h-3.5 w-3.5 transition-transform', open ? '-rotate-90' : 'rotate-180')} aria-hidden />
      </button>
      {open ? (
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {keys.map((k) => (
            <div key={k} className="rounded-[var(--radius-control)] border border-line px-3 py-2">
              <dt className="text-2xs text-muted">{P.metrics[k]}</dt>
              <dd className="text-lg font-extrabold text-ink">{funnel[k].toLocaleString('he-IL')}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
