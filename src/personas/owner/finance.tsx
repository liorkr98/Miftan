import * as React from 'react';
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
import { useStore, useStoreShallow } from '@/data/store';
import { t } from '@/i18n/he';
import { expensesByCategory, expensesByUnit, rentByMonth } from '@/data/selectors';
import { Money, Num, PageHeader } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Meter } from '@/components/shared/meter';
import { AXIS, ChartFrame, ChartTooltip } from '@/components/shared/charts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/field';
import {
  expenseCategoryLabel,
  formatDate,
  formatMoneyShort,
  formatMonthTick,
  formatMonthYear,
} from '@/lib/format';
import { parseISO } from 'date-fns';
import { Download, Receipt } from 'lucide-react';

export function OwnerFinance() {
  const { properties, rentPayments, expenses, leases, tenants } = useStoreShallow((s) => ({
    properties: s.properties,
    rentPayments: s.rentPayments,
    expenses: s.expenses,
    leases: s.leases,
    tenants: s.tenants,
  }));
  const exportExpenses = useStore((s) => s.exportExpenses);

  const [year, setYear] = React.useState('all');

  const years = React.useMemo(
    () => [...new Set(expenses.map((e) => e.date.slice(0, 4)))].sort().reverse(),
    [expenses],
  );

  const scopedExpenses = React.useMemo(
    () =>
      (year === 'all' ? expenses : expenses.filter((e) => e.date.startsWith(year))).sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    [expenses, year],
  );

  const months = React.useMemo(() => rentByMonth(rentPayments, 12), [rentPayments]);
  const byCategory = React.useMemo(() => expensesByCategory(scopedExpenses), [scopedExpenses]);
  const byUnit = React.useMemo(
    () => expensesByUnit(scopedExpenses, properties).slice(0, 10),
    [scopedExpenses, properties],
  );

  const propertyById = React.useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const currentRows = rentPayments.filter((p) => p.month === thisMonth);
  const totalExpenses = scopedExpenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.finance.title}
        subtitle={t.finance.subtitle}
        actions={
          <Button variant="secondary" onClick={exportExpenses}>
            <Download className="h-3.5 w-3.5" />
            {t.finance.exportForAccountant}
          </Button>
        }
      />

      <Tabs defaultValue="rent">
        <TabsList>
          <TabsTrigger value="rent">{t.finance.rentRoll}</TabsTrigger>
          <TabsTrigger value="expenses">{t.finance.expenses}</TabsTrigger>
        </TabsList>

        {/* ── Rent roll ─────────────────────────────────── */}
        <TabsContent value="rent" className="space-y-5">
          <ChartFrame title={t.finance.byMonth}>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={months} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barGap={2}>
                  <CartesianGrid stroke="var(--color-line)" vertical={false} />
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
                    width={46}
                    tickFormatter={(v: number) => formatMoneyShort(v)}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--color-surface)' }}
                    content={({ active, label, payload }) => (
                      <ChartTooltip
                        active={active}
                        label={label ? formatMonthYear(parseISO(`${label}-01`)) : undefined}
                        rows={[
                          { key: 'due', label: t.finance.expected, value: Number(payload?.[0]?.payload?.due ?? 0), color: 'var(--color-line-strong)', money: true },
                          { key: 'paid', label: t.finance.collected, value: Number(payload?.[0]?.payload?.paid ?? 0), color: 'var(--color-ink)', money: true },
                        ]}
                      />
                    )}
                  />
                  <Bar dataKey="due" fill="var(--color-line-strong)" radius={[3, 3, 0, 0]} maxBarSize={20} isAnimationActive={false} />
                  <Bar dataKey="paid" fill="var(--color-ink)" radius={[3, 3, 0, 0]} maxBarSize={20} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartFrame>

          <section>
            <h2 className="mb-3 text-sm font-bold text-ink">
              {t.finance.rentRoll} · {formatMonthYear(`${thisMonth}-01`)}
            </h2>
            <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
              <table className="w-full min-w-[44rem] border-collapse">
                <thead>
                  <tr className="border-b border-line bg-surface text-2xs text-muted">
                    <th className="p-3 text-start font-bold">{t.finance.unit}</th>
                    <th className="p-3 text-start font-bold">{t.properties.tenant}</th>
                    <th className="p-3 text-start font-bold">{t.finance.expected}</th>
                    <th className="p-3 text-start font-bold">{t.finance.collected}</th>
                    <th className="p-3 text-start font-bold">{t.paymentMethod.standing_order}</th>
                    <th className="p-3 text-start font-bold">{t.properties.statusCol}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {currentRows.map((row) => {
                    const property = propertyById.get(row.property_id);
                    const lease = leases.find((l) => l.id === row.lease_id);
                    const tenant = tenants.find((x) => x.id === lease?.tenant_id);
                    const state = row.paid >= row.due ? 'paid' : row.paid > 0 ? 'partial' : 'unpaid';
                    return (
                      <tr key={row.id} className="text-sm">
                        <td className="p-3">
                          <span className="block font-bold text-ink">
                            {property ? `${property.address.street} ${property.address.number}` : ''}
                          </span>
                          <span className="block text-2xs text-muted">
                            {property?.address.neighborhood}
                          </span>
                        </td>
                        <td className="p-3 text-ink-soft">{tenant?.name ?? '—'}</td>
                        <td className="p-3">
                          <Money value={row.due} board className="text-ink-soft" />
                        </td>
                        <td className="p-3">
                          <Money
                            value={row.paid}
                            board
                            className={state === 'paid' ? 'font-bold text-ink' : 'font-bold text-alert'}
                          />
                        </td>
                        <td className="p-3 text-2xs text-muted">{t.paymentMethod[row.method]}</td>
                        <td className="p-3">
                          <Badge
                            tone={state === 'paid' ? 'openSoft' : state === 'partial' ? 'signalSoft' : 'alertSoft'}
                            size="sm"
                          >
                            {state === 'paid' ? t.finance.paid : state === 'partial' ? t.finance.partial : t.finance.unpaid}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line bg-surface text-sm">
                    <td className="p-3 font-bold text-ink" colSpan={2}>
                      {t.finance.total}
                    </td>
                    <td className="p-3">
                      <Money value={currentRows.reduce((s, r) => s + r.due, 0)} board className="font-bold" />
                    </td>
                    <td className="p-3" colSpan={3}>
                      <div className="flex items-center gap-3">
                        <Money
                          value={currentRows.reduce((s, r) => s + r.paid, 0)}
                          board
                          className="font-bold text-ink"
                        />
                        <Meter
                          value={currentRows.reduce((s, r) => s + r.paid, 0)}
                          max={currentRows.reduce((s, r) => s + r.due, 0)}
                          tone="open"
                          className="max-w-40"
                          label={t.finance.collected}
                        />
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </TabsContent>

        {/* ── Expenses ──────────────────────────────────── */}
        <TabsContent value="expenses" className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Field label={t.finance.year} className="w-36">
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.finance.allYears}</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <p className="pb-2.5 text-xs text-muted">
              {t.finance.total}: <Money value={totalExpenses} board className="font-bold text-ink" />
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartFrame title={t.finance.byCategory}>
              {byCategory.length ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byCategory} layout="vertical" margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                      <CartesianGrid stroke="var(--color-line)" horizontal={false} />
                      <XAxis type="number" reversed axisLine={false} tickLine={false} tick={AXIS.tick} tickFormatter={(v: number) => formatMoneyShort(v)} />
                      <YAxis
                        type="category"
                        dataKey="key"
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        width={80}
                        tick={{ fill: 'var(--color-ink-soft)', fontSize: 11 }}
                        tickFormatter={expenseCategoryLabel}
                      />
                      <Tooltip
                        cursor={{ fill: 'var(--color-surface)' }}
                        content={({ active, payload }) => (
                          <ChartTooltip
                            active={active}
                            rows={[{ key: 'a', label: t.finance.amount, value: Number(payload?.[0]?.value ?? 0), color: 'var(--color-ink)', money: true }]}
                          />
                        )}
                      />
                      <Bar dataKey="amount" radius={[0, 3, 3, 0]} maxBarSize={16} isAnimationActive={false}>
                        {byCategory.map((row, i) => (
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

            <ChartFrame title={t.finance.byUnit}>
              {byUnit.length ? (
                <ul className="space-y-2">
                  {byUnit.map((row) => {
                    const max = byUnit[0].amount;
                    return (
                      <li key={row.property.id} className="flex items-center gap-2 text-2xs">
                        <span className="w-28 shrink-0 truncate text-ink-soft">
                          {row.property.address.street} {row.property.address.number}
                        </span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunk">
                          <span
                            className="block h-full rounded-full bg-ink"
                            style={{ width: `${(row.amount / max) * 100}%` }}
                          />
                        </span>
                        <Money value={row.amount} board className="w-16 shrink-0 text-end font-bold text-ink" />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState title={t.finance.empty} hint={t.finance.emptyHint} compact />
              )}
            </ChartFrame>
          </div>

          <section>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-bold text-ink">{t.finance.expenseList}</h2>
              <span className="text-2xs text-muted">{t.finance.exportHint}</span>
            </div>
            {scopedExpenses.length === 0 ? (
              <EmptyState icon={Receipt} title={t.finance.empty} hint={t.finance.emptyHint} />
            ) : (
              <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
                <table className="w-full min-w-[48rem] border-collapse">
                  <thead>
                    <tr className="border-b border-line bg-surface text-2xs text-muted">
                      <th className="p-3 text-start font-bold">{t.finance.date}</th>
                      <th className="p-3 text-start font-bold">{t.finance.unit}</th>
                      <th className="p-3 text-start font-bold">{t.finance.category}</th>
                      <th className="p-3 text-start font-bold">{t.finance.kind}</th>
                      <th className="p-3 text-start font-bold">{t.finance.vendor}</th>
                      <th className="p-3 text-start font-bold">{t.finance.document}</th>
                      <th className="p-3 text-start font-bold">{t.finance.amount}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {scopedExpenses.map((e) => {
                      const property = propertyById.get(e.property_id);
                      return (
                        <tr key={e.id} className="text-sm">
                          <td className="p-3">
                            <Num board className="text-ink-soft">
                              {formatDate(e.date)}
                            </Num>
                          </td>
                          <td className="p-3 text-ink">
                            {property ? `${property.address.street} ${property.address.number}` : '—'}
                          </td>
                          <td className="p-3 text-ink-soft">{expenseCategoryLabel(e.category)}</td>
                          <td className="p-3">
                            <Badge tone={e.kind === 'improvement' ? 'liveSoft' : 'neutral'} size="sm">
                              {t.expenseKind[e.kind]}
                            </Badge>
                          </td>
                          <td className="p-3 text-ink-soft">{e.vendor_name ?? '—'}</td>
                          <td className="p-3 text-2xs text-muted">{t.documentType[e.document_type]}</td>
                          <td className="p-3">
                            <Money value={e.amount} board className="font-bold text-ink" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
