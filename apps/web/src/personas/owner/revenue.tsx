import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/data/store';
import { t, formatMoney, type RevenueKind } from '@miftan/shared';
import { useRevenueModel } from '@/components/shared/revenue';
import { Money, Num, PageHeader, SectionTitle } from '@/components/shared/typography';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/field';
import { cn } from '@/lib/utils';
import { ArrowLeft, Banknote, Eye, ShieldOff } from 'lucide-react';

const KIND_TONE: Record<RevenueKind, string> = {
  vendor_commission: 'var(--color-ink)',
  service_affiliate: 'var(--color-signal)',
  insurance_affiliate: 'var(--color-live)',
  subscription: 'var(--color-open)',
  per_document: 'var(--color-ink-soft)',
  verification_fee: 'var(--color-line-strong)',
};

export function OwnerRevenue() {
  const navigate = useNavigate();
  const { units, rows, excluded, perUnitYear, annual } = useRevenueModel();
  const lens = useStore((s) => s.revenueLens);
  const toggleLens = useStore((s) => s.toggleRevenueLens);

  /* The portfolio in the demo is 22 units; a partner will immediately ask
     "and at 500?". Let them type it. */
  const [scenario, setScenario] = React.useState(String(units));
  const scenarioUnits = Number(scenario) || units;

  const chartData = rows.slice(0, 8).map((r) => ({
    key: r.stream.id,
    name: r.stream.name,
    kind: r.stream.kind,
    value: Math.round(r.perUnitYear * scenarioUnits),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.revenue.title}
        subtitle={t.revenue.subtitle}
        actions={
          <Button variant={lens ? 'primary' : 'secondary'} onClick={toggleLens}>
            <Eye className="h-4 w-4" />
            {lens ? t.revenue.lensOn : t.revenue.lens}
          </Button>
        }
      />

      {/* Headline numbers */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Tile
          label={t.revenue.annualPerUnit}
          value={<Money value={Math.round(perUnitYear)} board />}
          hint={t.revenue.perUnitYear}
        />
        <Tile
          label={t.revenue.annualTotal}
          value={<Money value={Math.round(annual)} board />}
          hint={t.revenue.projectionHint.replace('{units}', String(units))}
        />
        <div className="rounded-[var(--radius-card)] border border-line p-4">
          <p className="text-2xs text-muted">{t.revenue.portfolioSize}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <Input
              type="number"
              dir="ltr"
              min={1}
              className="num h-9 w-24"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              aria-label={t.revenue.portfolioSize}
            />
            <span className="text-xs text-muted">{t.revenue.unitsLabel}</span>
          </div>
          <p className="mt-2 text-sm">
            <Money
              value={Math.round(perUnitYear * scenarioUnits)}
              board
              className="text-lg font-bold text-ink"
            />
            <span className="ms-1.5 text-2xs text-muted">{t.revenue.perYear}</span>
          </p>
        </div>
      </div>

      {/* Mix. A plain bar list rather than a chart: Recharts clips long Hebrew
          category labels on a right-oriented axis, and the label is the point. */}
      <section className="rounded-[var(--radius-card)] border border-line p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold text-ink">{t.revenue.mix}</h2>
          <span className="text-2xs text-muted">
            {t.revenue.projectionHint.replace('{units}', String(scenarioUnits))}
          </span>
        </div>

        <ul className="space-y-2">
          {chartData.map((row) => {
            const max = chartData[0]?.value || 1;
            return (
              <li key={row.key} className="flex items-center gap-2.5 text-2xs">
                <span className="w-44 shrink-0 truncate text-ink-soft">{row.name}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-sunk">
                  <span
                    className="block h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out)]"
                    style={{
                      width: `${(row.value / max) * 100}%`,
                      background: KIND_TONE[row.kind as RevenueKind],
                    }}
                  />
                </span>
                <Money value={row.value} board className="w-20 shrink-0 text-end font-bold text-ink" />
              </li>
            );
          })}
        </ul>
      </section>

      {/* The streams themselves */}
      <section>
        <SectionTitle>{t.revenue.topStreams}</SectionTitle>
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[56rem] border-collapse">
            <thead>
              <tr className="border-b border-line bg-surface text-2xs text-muted">
                <th className="p-3 text-start font-bold">{t.revenue.stream}</th>
                <th className="p-3 text-start font-bold">{t.revenue.surface}</th>
                <th className="p-3 text-start font-bold">{t.revenue.audience}</th>
                <th className="p-3 text-start font-bold">{t.revenue.unitRevenue}</th>
                <th className="p-3 text-start font-bold">{t.revenue.frequency}</th>
                <th className="p-3 text-start font-bold">{t.revenue.annualPerUnit}</th>
                <th className="p-3 text-start font-bold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ stream, perUnitYear: per }) => (
                <tr key={stream.id} className="align-top text-sm">
                  <td className="p-3">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: KIND_TONE[stream.kind] }}
                        aria-hidden
                      />
                      <span>
                        <span className="block font-bold text-ink">{stream.name}</span>
                        <span className="block text-2xs text-muted">{t.revenue.kind[stream.kind]}</span>
                      </span>
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="block text-xs text-ink-soft">{stream.surface}</span>
                    <span className="block text-2xs text-muted">{stream.basis}</span>
                  </td>
                  <td className="p-3">
                    <Badge
                      tone={
                        stream.audience === 'owner'
                          ? 'liveSoft'
                          : stream.audience === 'tenant'
                            ? 'openSoft'
                            : 'signalSoft'
                      }
                      size="sm"
                    >
                      {t.revenue.audienceLabel[stream.audience]}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Money value={stream.unit_revenue} board className="font-semibold text-ink-soft" />
                  </td>
                  <td className="p-3">
                    <Num board className="text-ink-soft">
                      ×{stream.events_per_unit_year}
                    </Num>
                  </td>
                  <td className="p-3">
                    <Money value={Math.round(per)} board className="font-bold text-ink" />
                  </td>
                  <td className="p-3">
                    <Button size="sm" variant="ghost" onClick={() => navigate(stream.route)}>
                      {t.revenue.goToSurface}
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line bg-surface text-sm">
                <td className="p-3 font-bold text-ink" colSpan={5}>
                  {t.revenue.total}
                </td>
                <td className="p-3">
                  <Money value={Math.round(perUnitYear)} board className="font-bold text-ink" />
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* What we chose not to monetise — the second question a partner asks */}
      <section>
        <SectionTitle aside={<span className="text-2xs text-muted">{t.revenue.excludedHint}</span>}>
          {t.revenue.excluded}
        </SectionTitle>
        <ul className="space-y-2.5">
          {excluded.map((stream) => (
            <li
              key={stream.id}
              className="rounded-[var(--radius-card)] border border-dashed border-line-strong p-3.5"
            >
              <p className="flex items-center gap-2 text-sm font-bold text-muted">
                <ShieldOff className="h-3.5 w-3.5" />
                <span className="line-through decoration-line-strong">{stream.name}</span>
              </p>
              <p className="mt-1 text-2xs text-muted">{stream.basis}</p>
              <p className="mt-1.5 text-xs leading-5 text-ink-soft">{stream.excluded_because}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* How the commercial relationship is presented in-product */}
      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <div className="flex items-start gap-2.5">
          <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
          <div>
            <h2 className="text-sm font-bold text-ink">{t.revenue.disclosureTitle}</h2>
            <p className="mt-1 text-2xs leading-5 text-muted">{t.revenue.disclosureBody}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className={cn('rounded-[var(--radius-card)] border border-line p-4')}>
      <p className="text-2xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
      {hint ? <p className="mt-1 text-2xs text-muted">{hint}</p> : null}
    </div>
  );
}

export { formatMoney };
