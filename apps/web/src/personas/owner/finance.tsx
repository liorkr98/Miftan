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
import { parseISO } from 'date-fns';
import { Download, Receipt } from 'lucide-react';
import {
  expenseCategoryLabel,
  formatDate,
  formatMoneyShort,
  formatMonthTick,
  formatMonthYear,
  t,
  toShekels,
  type ExpenseView,
  type OwnerRentPayment,
  type TicketCategory,
} from '@miftan/shared';
import { useBudget, useExpenses, useRentPayments, useUpdateBudget } from '@/api/hooks';
import { useStore } from '@/data/store';
import { Money, PageHeader } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { ListSkeleton } from '@/components/shared/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Meter } from '@/components/shared/meter';
import { AXIS, ChartFrame, ChartTooltip } from '@/components/shared/charts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@/components/ui/field';

const CATEGORIES = Object.keys(t.ticketCategory) as TicketCategory[];

function rollupMonths(payments: OwnerRentPayment[], months = 12) {
  const map = new Map<string, { month: string; due: number; paid: number }>();
  for (const p of payments) {
    const row = map.get(p.month) ?? { month: p.month, due: 0, paid: 0 };
    row.due += toShekels(p.dueAgorot);
    row.paid += toShekels(p.paidAgorot);
    map.set(p.month, row);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-months);
}

export function OwnerFinance() {
  const {
    data: payments = [],
    isLoading: paymentsLoading,
    isError: paymentsError,
    refetch: refetchPayments,
  } = useRentPayments();
  const {
    data: expenseData,
    isLoading: expensesLoading,
    isError: expensesError,
    refetch: refetchExpenses,
  } = useExpenses();
  const { data: budget } = useBudget();
  const updateBudget = useUpdateBudget();
  const pushToast = useStore((s) => s.pushToast);

  const [year, setYear] = React.useState('all');
  const [enabled, setEnabled] = React.useState(false);
  const [ceiling, setCeiling] = React.useState('500');
  const [cap, setCap] = React.useState('2000');
  const [includeUrgent, setIncludeUrgent] = React.useState(false);
  const [categories, setCategories] = React.useState<TicketCategory[]>(['lock', 'plumbing', 'leak']);
  const [budgetHydrated, setBudgetHydrated] = React.useState(false);

  React.useEffect(() => {
    if (!budget || budgetHydrated) return;
    setEnabled(budget.enabled);
    setCeiling(String(toShekels(budget.perTicketCeilingAgorot)));
    setCap(String(toShekels(budget.monthlyCapAgorot)));
    setIncludeUrgent(budget.includeUrgent);
    setCategories(budget.categories);
    setBudgetHydrated(true);
  }, [budget, budgetHydrated]);

  const ownedPayments = React.useMemo(
    () => payments.filter((p): p is OwnerRentPayment => p.scope === 'owner'),
    [payments],
  );
  const expenses = expenseData?.expenses ?? [];

  const years = React.useMemo(
    () => [...new Set(expenses.map((e) => e.date.slice(0, 4)))].sort().reverse(),
    [expenses],
  );

  const scopedExpenses = React.useMemo(
    () =>
      (year === 'all' ? expenses : expenses.filter((e) => e.date.startsWith(year))).slice().sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    [expenses, year],
  );

  const months = React.useMemo(() => rollupMonths(ownedPayments, 12), [ownedPayments]);

  const byCategory = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const e of scopedExpenses) map.set(e.category, (map.get(e.category) ?? 0) + toShekels(e.amountAgorot));
    return [...map.entries()]
      .map(([key, amount]) => ({ key, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [scopedExpenses]);

  const byUnit = React.useMemo(() => {
    const map = new Map<string, { label: string; amount: number }>();
    for (const e of scopedExpenses) {
      const row = map.get(e.propertyId) ?? { label: e.propertyLabel, amount: 0 };
      row.amount += toShekels(e.amountAgorot);
      map.set(e.propertyId, row);
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount).slice(0, 10);
  }, [scopedExpenses]);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const currentRows = ownedPayments.filter((p) => p.month === thisMonth);
  const totalExpensesAgorot = scopedExpenses.reduce((sum, e) => sum + e.amountAgorot, 0);

  const exportCsv = () => {
    const header = ['date', 'unit', 'category', 'kind', 'vendor', 'document', 'amount_shekels'];
    /* Addresses and vendor names can contain commas and quotes; unescaped,
       they shift every column after them. */
    const cell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = scopedExpenses.map((e) =>
      [e.date, e.propertyLabel, e.category, e.kind, e.vendorName ?? '', e.documentType, String(toShekels(e.amountAgorot))]
        .map(cell)
        .join(','),
    );
    /* The BOM is what makes Excel read the Hebrew as UTF-8 rather than mojibake. */
    const blob = new Blob(['﻿', [header.join(','), ...lines].join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `miftan-expenses-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast(t.finance.exported, 'success');
  };

  const saveBudget = () => {
    updateBudget.mutate(
      {
        enabled,
        perTicketCeilingShekels: Number(ceiling) || 0,
        monthlyCapShekels: Number(cap) || 0,
        categories,
        includeUrgent,
      },
      { onSuccess: () => pushToast(t.finance.budgetSaved, 'success') },
    );
  };

  const toggleCategory = (key: TicketCategory) => {
    setCategories((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));
  };

  if (paymentsError || expensesError) {
    return (
      <ErrorState
        onRetry={() => {
          void refetchPayments();
          void refetchExpenses();
        }}
      />
    );
  }
  if (paymentsLoading || expensesLoading) return <ListSkeleton rows={8} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.finance.title}
        subtitle={t.finance.subtitle}
        actions={
          <Button variant="secondary" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" />
            {t.finance.exportForAccountant}
          </Button>
        }
      />

      <Tabs defaultValue="rent">
        <TabsList>
          <TabsTrigger value="rent">{t.finance.rentRoll}</TabsTrigger>
          <TabsTrigger value="expenses">{t.finance.expenses}</TabsTrigger>
          <TabsTrigger value="budget">{t.finance.autoApprove}</TabsTrigger>
        </TabsList>

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
            {currentRows.length === 0 ? (
              <EmptyState title={t.finance.emptyRent} hint={t.finance.emptyRentHint} compact />
            ) : (
              <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
                <table className="w-full min-w-[44rem] border-collapse">
                  <thead>
                    <tr className="border-b border-line bg-surface text-2xs text-muted">
                      <th className="p-3 text-start font-bold">{t.finance.unit}</th>
                      <th className="p-3 text-start font-bold">{t.properties.tenant}</th>
                      <th className="p-3 text-start font-bold">{t.finance.expected}</th>
                      <th className="p-3 text-start font-bold">{t.finance.collected}</th>
                      <th className="p-3 text-start font-bold">{t.finance.method}</th>
                      <th className="p-3 text-start font-bold">{t.properties.statusCol}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {currentRows.map((row) => {
                      const state = row.paidAgorot >= row.dueAgorot ? 'paid' : row.paidAgorot > 0 ? 'partial' : 'unpaid';
                      return (
                        <tr key={row.id} className="text-sm">
                          <td className="p-3">
                            <span className="block font-bold text-ink">{row.propertyLabel}</span>
                          </td>
                          <td className="p-3 text-ink-soft">{row.tenant?.name ?? '—'}</td>
                          <td className="p-3">
                            <Money agorot={row.dueAgorot} board className="text-ink-soft" />
                          </td>
                          <td className="p-3">
                            <Money
                              agorot={row.paidAgorot}
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
                        <Money agorot={currentRows.reduce((s, r) => s + r.dueAgorot, 0)} board className="font-bold" />
                      </td>
                      <td className="p-3" colSpan={3}>
                        <div className="flex items-center gap-3">
                          <Money
                            agorot={currentRows.reduce((s, r) => s + r.paidAgorot, 0)}
                            board
                            className="font-bold text-ink"
                          />
                          <Meter
                            value={currentRows.reduce((s, r) => s + r.paidAgorot, 0)}
                            max={currentRows.reduce((s, r) => s + r.dueAgorot, 0)}
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
            )}
          </section>
        </TabsContent>

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
              {t.finance.total}: <Money agorot={totalExpensesAgorot} board className="font-bold text-ink" />
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
                      <li key={row.label} className="flex items-center gap-2 text-2xs">
                        <span className="w-28 shrink-0 truncate text-ink-soft">{row.label}</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunk">
                          <span className="block h-full rounded-full bg-ink" style={{ width: `${(row.amount / max) * 100}%` }} />
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
              <ExpenseTable rows={scopedExpenses} />
            )}
          </section>
        </TabsContent>

        <TabsContent value="budget" className="space-y-5">
          <section className="rounded-[var(--radius-card)] border border-line p-4">
            <p className="text-sm font-bold text-ink">{t.finance.autoApprove}</p>
            <p className="mt-1 text-2xs leading-5 text-muted">{t.finance.autoApproveHint}</p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-ink">
                {enabled ? t.finance.autoApproveEnabled : t.finance.autoApproveOff}
              </span>
              <Switch checked={enabled} onCheckedChange={setEnabled} aria-label={t.finance.autoApprove} />
            </div>
            {budget ? (
              <p className="mt-3 text-2xs text-muted">
                {t.finance.spentThisMonth}:{' '}
                <Money agorot={budget.spentThisMonthAgorot} board className="font-bold text-ink" />
                {' · '}
                {t.finance.remainingThisMonth}:{' '}
                <Money agorot={budget.remainingThisMonthAgorot} board className="font-bold text-ink" />
              </p>
            ) : null}
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.finance.perTicketCeiling} htmlFor="b-ceiling">
              <Input id="b-ceiling" dir="ltr" className="num" value={ceiling} onChange={(e) => setCeiling(e.target.value)} />
            </Field>
            <Field label={t.finance.monthlyCap} htmlFor="b-cap">
              <Input id="b-cap" dir="ltr" className="num" value={cap} onChange={(e) => setCap(e.target.value)} />
            </Field>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-line px-3.5 py-2.5">
            <span className="text-sm font-semibold text-ink">{t.finance.includeUrgent}</span>
            <Switch checked={includeUrgent} onCheckedChange={setIncludeUrgent} aria-label={t.finance.includeUrgent} />
          </label>

          <div>
            <p className="mb-2 text-xs font-bold text-ink-soft">{t.finance.categoriesInScope}</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleCategory(key)}
                  aria-pressed={categories.includes(key)}
                  className={
                    categories.includes(key)
                      ? 'rounded-full border border-ink bg-ink px-3 py-1.5 text-xs font-bold text-on-ink'
                      : 'rounded-full border border-line px-3 py-1.5 text-xs font-bold text-ink-soft hover:border-line-strong'
                  }
                >
                  {t.ticketCategory[key]}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={saveBudget} loading={updateBudget.isPending}>
            {t.finance.saveBudget}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExpenseTable({ rows }: { rows: ExpenseView[] }) {
  return (
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
          {rows.map((e) => (
            <tr key={e.id} className="text-sm">
              <td className="p-3">
                <span dir="ltr" className="num-board text-ink-soft">
                  {formatDate(e.date)}
                </span>
              </td>
              <td className="p-3 text-ink">{e.propertyLabel}</td>
              <td className="p-3 text-ink-soft">{expenseCategoryLabel(e.category)}</td>
              <td className="p-3">
                <Badge tone={e.kind === 'improvement' ? 'liveSoft' : 'neutral'} size="sm">
                  {t.expenseKind[e.kind]}
                </Badge>
              </td>
              <td className="p-3 text-ink-soft">{e.vendorName ?? '—'}</td>
              <td className="p-3 text-2xs text-muted">{t.documentType[e.documentType]}</td>
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
