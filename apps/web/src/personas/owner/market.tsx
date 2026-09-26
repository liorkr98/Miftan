import * as React from 'react';
import {
  DISTRICTS,
  formatAgorot,
  formatRooms,
  t,
  type District,
} from '@miftan/shared';
import { useMarket } from '@/api/hooks';
import { Money, Num, PageHeader } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { ListSkeleton } from '@/components/shared/skeleton';
import {
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/field';
import { TrendingUp } from 'lucide-react';

const DISTRICTS_LIST = Object.keys(DISTRICTS) as District[];

export function OwnerMarket() {
  const [district, setDistrict] = React.useState<District | 'all'>('all');
  const { data, isLoading, isError, refetch } = useMarket(district === 'all' ? undefined : district);

  if (isError) return <ErrorState onRetry={() => void refetch()} />;
  if (isLoading) return <ListSkeleton rows={8} />;

  const rows = data?.rows ?? [];
  const minimum = data?.minimumSample ?? 5;
  const published = rows.filter((r) => r.sampleSize >= minimum);

  return (
    <div className="space-y-5">
      <PageHeader title={t.market.title} subtitle={t.market.subtitle} />

      <Field label={t.market.district} className="w-56">
        <Select value={district} onValueChange={(v) => setDistrict(v as District | 'all')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.market.allDistricts}</SelectItem>
            {DISTRICTS_LIST.map((d) => (
              <SelectItem key={d} value={d}>
                {DISTRICTS[d]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {published.length === 0 ? (
        <EmptyState icon={TrendingUp} title={t.market.empty} hint={t.market.emptyHint} />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[48rem] border-collapse">
            <thead>
              <tr className="border-b border-line bg-surface text-2xs text-muted">
                <th className="p-3 text-start font-bold">{t.market.city}</th>
                <th className="p-3 text-start font-bold">{t.market.rooms}</th>
                <th className="p-3 text-start font-bold">{t.market.medianRent}</th>
                <th className="p-3 text-start font-bold">{t.market.p25}</th>
                <th className="p-3 text-start font-bold">{t.market.p75}</th>
                <th className="p-3 text-start font-bold">{t.market.sample}</th>
                <th className="p-3 text-start font-bold">{t.market.demand}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {published.map((row) => (
                <tr key={`${row.city}-${row.rooms}`} className="text-sm">
                  <td className="p-3">
                    <span className="block font-bold text-ink">{row.city}</span>
                    <span className="block text-2xs text-muted">{DISTRICTS[row.district]}</span>
                  </td>
                  <td className="p-3 text-ink-soft">{formatRooms(row.rooms)}</td>
                  <td className="p-3">
                    <Money agorot={row.medianRentAgorot} board className="font-bold text-ink" />
                  </td>
                  <td className="p-3 text-ink-soft">
                    <span dir="ltr" className="num-board">
                      {formatAgorot(row.p25RentAgorot)}
                    </span>
                  </td>
                  <td className="p-3 text-ink-soft">
                    <span dir="ltr" className="num-board">
                      {formatAgorot(row.p75RentAgorot)}
                    </span>
                  </td>
                  <td className="p-3">
                    <Num board className="text-ink">
                      {row.sampleSize}
                    </Num>
                  </td>
                  <td className="p-3 text-ink-soft">
                    <Num board>{row.demandCount}</Num>
                    {row.demandPerUnit != null ? (
                      <span className="ms-1 text-2xs text-muted">
                        ({row.demandPerUnit.toFixed(1)})
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
