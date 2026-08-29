import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStoreShallow, useStore } from '@/data/store';
import { t, formatDate, formatFloor, formatRooms, formatSqm, type UnitStatus } from '@miftach/shared';
import { availabilityKind, leaseForProperty } from '@/data/selectors';
import { AvailabilityChip, UnitStatusBadge } from '@/components/shared/status';
import { Money, Num, PageHeader } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { CardGridSkeleton, ListSkeleton } from '@/components/shared/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Checkbox,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/field';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDelayedReady } from '@/lib/use-delayed-ready';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, Home, LayoutGrid, Rows3, TrendingUp } from 'lucide-react';

type View = 'table' | 'cards';

export function OwnerProperties() {
  const navigate = useNavigate();
  const ready = useDelayedReady();
  const { properties, leases, tenants } = useStoreShallow((s) => ({
    properties: s.properties,
    leases: s.leases,
    tenants: s.tenants,
  }));
  const setListed = useStore((s) => s.setListed);
  const bulkAdjustRent = useStore((s) => s.bulkAdjustRent);
  const pushToast = useStore((s) => s.pushToast);

  const [view, setView] = React.useState<View>('table');
  const [status, setStatus] = React.useState<UnitStatus | 'all'>('all');
  const [city, setCity] = React.useState('all');
  const [selected, setSelected] = React.useState<string[]>([]);
  const [rentOpen, setRentOpen] = React.useState(false);
  const [percent, setPercent] = React.useState('3');

  const cities = React.useMemo(
    () => [...new Set(properties.map((p) => p.address.city))],
    [properties],
  );

  const rows = React.useMemo(
    () =>
      properties.filter(
        (p) => (status === 'all' || p.status === status) && (city === 'all' || p.address.city === city),
      ),
    [properties, status, city],
  );

  const tenantFor = (propertyId: string) => {
    const lease = leaseForProperty(leases, propertyId);
    return lease ? tenants.find((x) => x.id === lease.tenant_id) : undefined;
  };

  const filtered = status !== 'all' || city !== 'all';
  const allSelected = rows.length > 0 && selected.length === rows.length;

  const toggleAll = () => setSelected(allSelected ? [] : rows.map((r) => r.id));
  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const clearFilters = () => {
    setStatus('all');
    setCity('all');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.properties.title}
        subtitle={t.properties.subtitle}
        actions={
          <div className="flex items-center gap-0.5 rounded-[var(--radius-control)] border border-line p-0.5">
            {(
              [
                ['table', Rows3, t.properties.table],
                ['cards', LayoutGrid, t.properties.cards],
              ] as const
            ).map(([id, Icon, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                aria-pressed={view === id}
                aria-label={label}
                className={cn(
                  'flex items-center gap-1.5 rounded-[7px] px-2.5 py-1.5 text-xs font-bold transition-colors duration-150',
                  view === id ? 'bg-ink text-on-ink' : 'text-muted hover:text-ink',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t.properties.filterStatus} className="w-40">
          <Select value={status} onValueChange={(v) => setStatus(v as UnitStatus | 'all')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.properties.all}</SelectItem>
              {(['occupied', 'vacant', 'vacating', 'renovating'] as UnitStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {t.status[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t.properties.filterCity} className="w-44">
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.properties.all}</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <span className="pb-2.5 text-xs text-muted">
          <Num board className="font-bold text-ink">
            {rows.length}
          </Num>{' '}
          {t.properties.unitsCount}
        </span>
        {filtered ? (
          <Button variant="quiet" size="sm" className="mb-1" onClick={clearFilters}>
            {t.properties.clearFilters}
          </Button>
        ) : null}
      </div>

      {/* Bulk action bar — appears only when something is selected */}
      {selected.length > 0 ? (
        <div className="sticky top-2 flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-ink bg-ink px-3 py-2 text-on-ink motion-safe:animate-[fade-up_180ms_var(--ease-out-quint)]" style={{ zIndex: 'var(--z-sticky)' }}>
          <span className="text-xs font-bold">
            <Num board>{selected.length}</Num> {t.properties.selected}
          </span>
          <div className="flex flex-1 flex-wrap items-center gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => setRentOpen(true)}>
              <TrendingUp className="h-3.5 w-3.5" />
              {t.properties.bulkAdjustRent}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setListed(selected, true);
                pushToast(t.properties.bulkMarkListed, 'success');
              }}
            >
              <Eye className="h-3.5 w-3.5" />
              {t.properties.bulkMarkListed}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setListed(selected, false);
                pushToast(t.properties.bulkUnlist, 'success');
              }}
            >
              <EyeOff className="h-3.5 w-3.5" />
              {t.properties.bulkUnlist}
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setSelected([])}
            className="text-xs font-semibold text-on-ink-muted underline-offset-2 hover:text-on-ink hover:underline"
          >
            {t.properties.clearSelection}
          </button>
        </div>
      ) : null}

      {!ready ? (
        view === 'table' ? (
          <ListSkeleton rows={8} />
        ) : (
          <CardGridSkeleton />
        )
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Home}
          title={filtered ? t.properties.noResults : t.properties.empty}
          hint={filtered ? t.properties.noResultsHint : t.properties.emptyHint}
          action={filtered ? t.properties.clearFilters : t.properties.emptyAction}
          onAction={filtered ? clearFilters : () => pushToast(t.properties.emptyAction)}
        />
      ) : view === 'table' ? (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[54rem] border-collapse text-start">
            <thead>
              <tr className="border-b border-line bg-surface text-2xs text-muted">
                <th className="w-10 p-3">
                  <Checkbox
                    checked={allSelected ? true : selected.length ? 'indeterminate' : false}
                    onCheckedChange={toggleAll}
                    aria-label={t.properties.selectAll}
                  />
                </th>
                <th className="p-3 text-start font-bold">{t.properties.address}</th>
                <th className="p-3 text-start font-bold">{t.properties.rooms}</th>
                <th className="p-3 text-start font-bold">{t.properties.floor}</th>
                <th className="p-3 text-start font-bold">{t.properties.rent}</th>
                <th className="p-3 text-start font-bold">{t.properties.tenant}</th>
                <th className="p-3 text-start font-bold">{t.properties.leaseEnd}</th>
                <th className="p-3 text-start font-bold">{t.properties.statusCol}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((property) => {
                const lease = leaseForProperty(leases, property.id);
                const tenant = tenantFor(property.id);
                const checked = selected.includes(property.id);
                return (
                  <tr
                    key={property.id}
                    className={cn(
                      'cursor-pointer transition-colors duration-150 hover:bg-surface',
                      checked && 'bg-surface',
                    )}
                    onClick={() => navigate(`/owner/properties/${property.id}`)}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(property.id)}
                        aria-label={`${property.address.street} ${property.address.number}`}
                      />
                    </td>
                    <td className="p-3">
                      <span className="block text-sm font-bold text-ink">
                        {property.address.street} {property.address.number}
                      </span>
                      <span className="block text-2xs text-muted">
                        {property.address.neighborhood} · {property.address.city}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-ink-soft">
                      <Num board>{property.rooms}</Num>
                      <span className="text-2xs text-muted"> · {formatSqm(property.sqm)}</span>
                    </td>
                    <td className="p-3 text-sm text-ink-soft">
                      <Num board>
                        {property.floor}/{property.total_floors}
                      </Num>
                    </td>
                    <td className="p-3">
                      <Money value={property.monthly_rent} board className="text-sm font-bold text-ink" />
                    </td>
                    <td className="p-3 text-sm text-ink-soft">{tenant?.name ?? '—'}</td>
                    <td className="p-3 text-sm">
                      {lease ? (
                        <Num board className="text-ink-soft">
                          {formatDate(lease.end_date)}
                        </Num>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <UnitStatusBadge status={property.status} size="sm" />
                        {property.listed ? (
                          <Badge tone="outline" size="sm">
                            {t.properties.listed}
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {rows.map((property) => {
            const lease = leaseForProperty(leases, property.id);
            const kind = availabilityKind(property, lease);
            return (
              <button
                key={property.id}
                type="button"
                onClick={() => navigate(`/owner/properties/${property.id}`)}
                className="group overflow-hidden rounded-[var(--radius-card)] border border-line text-start transition-colors duration-150 hover:border-line-strong"
              >
                <span className="relative block aspect-[4/3] overflow-hidden bg-surface-sunk">
                  <img
                    src={property.photos[0]}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 ease-[var(--ease-out-quart)] group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                  <span className="absolute top-2 start-2">
                    <UnitStatusBadge status={property.status} size="sm" />
                  </span>
                </span>
                <span className="block p-3.5">
                  <span className="block text-sm font-bold text-ink">
                    {property.address.street} {property.address.number}
                  </span>
                  <span className="mt-0.5 block text-2xs text-muted">
                    {property.address.neighborhood} · {formatRooms(property.rooms)} ·{' '}
                    {formatSqm(property.sqm)} · {formatFloor(property.floor, property.total_floors)}
                  </span>
                  <span className="mt-2.5 flex items-center justify-between gap-2">
                    <Money value={property.monthly_rent} board className="text-base font-bold text-ink" />
                    <AvailabilityChip
                      kind={kind}
                      date={property.available_from}
              confidence={property.availability_confidence}
                      size="sm"
                    />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Bulk rent adjustment */}
      <Dialog open={rentOpen} onOpenChange={setRentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.properties.bulkAdjustRent}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label={`${t.unit.rentAdjust.change} (%)`} htmlFor="bulk-pct">
              <Input
                id="bulk-pct"
                type="number"
                dir="ltr"
                className="num"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
              />
            </Field>
            <p className="rounded-[var(--radius-control)] bg-surface p-3 text-2xs leading-5 text-muted">
              {t.unit.rentAdjust.noticeInfo.replace('{days}', '60')}
            </p>
          </DialogBody>
          <DialogFooter>
            <Button
              onClick={() => {
                bulkAdjustRent(selected, Number(percent) || 0);
                setRentOpen(false);
                setSelected([]);
                pushToast(t.unit.rentAdjust.saved, 'success');
              }}
            >
              {t.unit.rentAdjust.save}
            </Button>
            <DialogClose asChild>
              <Button variant="secondary">{t.ui.cancel}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
