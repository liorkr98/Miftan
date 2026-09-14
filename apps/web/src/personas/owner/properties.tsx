import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  formatAgorot,
  formatDate,
  formatFloor,
  formatRooms,
  formatSqm,
  t,
  CITIES,
  type PropertyView,
} from '@miftan/shared';
import { useCreateProperty, useProperties } from '@/api/hooks';
import { useStore } from '@/data/store';
import { AvailabilityChip, UnitStatusBadge } from '@/components/shared/status';
import { Num, PageHeader } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { CardGridSkeleton, ListSkeleton } from '@/components/shared/skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { UnitStatus } from '@miftan/shared';
import { Home, LayoutGrid, Plus, Rows3 } from 'lucide-react';

type View = 'table' | 'cards';

/** Only a unit you own carries a status, a tenant and a lease. */
const isOwned = (p: PropertyView): p is Extract<PropertyView, { scope: 'owner' }> =>
  p.scope === 'owner';

export function OwnerProperties() {
  const navigate = useNavigate();
  const { data: properties = [], isLoading, isError, refetch, isFetching } = useProperties();
  const [addOpen, setAddOpen] = React.useState(false);

  const [view, setView] = React.useState<View>('table');
  const [status, setStatus] = React.useState<UnitStatus | 'all'>('all');
  const [city, setCity] = React.useState('all');

  /**
   * `/properties` answers with every unit you have a relationship to, each
   * projected for the relationship you hold — so an account that both lets
   * flats and rents one gets `owner` rows and a `tenant` row in the same
   * response. This page is the portfolio, so it takes only the former:
   * the flat you live in is not a unit in your ownership, and listing it
   * under a heading that says it is would be a lie about who pays whom.
   */
  const owned = React.useMemo(() => properties.filter(isOwned), [properties]);

  const cities = React.useMemo(
    () => [...new Set(owned.map((p) => p.address.city))],
    [owned],
  );

  const rows = React.useMemo(
    () =>
      owned.filter((p) => {
        if (status !== 'all' && p.status !== status) return false;
        if (city !== 'all' && p.address.city !== city) return false;
        return true;
      }),
    [owned, status, city],
  );

  const filtered = status !== 'all' || city !== 'all';
  const clearFilters = () => {
    setStatus('all');
    setCity('all');
  };

  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.properties.title}
        subtitle={t.properties.subtitle}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              {t.properties.addProperty}
            </Button>
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
                  'press-sm flex items-center gap-1.5 rounded-[7px] px-2.5 py-1.5 text-xs font-bold',
                  'transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)]',
                  view === id ? 'bg-ink text-on-ink' : 'text-muted hover:text-ink',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          </div>
        }
      />

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
          {/* Refetches are quiet: the list stays on screen and only says it is
              catching up, rather than blanking to a skeleton. */}
          {isFetching && !isLoading ? <span className="ms-2 opacity-60">{t.ui.loading}</span> : null}
        </span>

        {filtered ? (
          <Button variant="quiet" size="sm" className="mb-1" onClick={clearFilters}>
            {t.properties.clearFilters}
          </Button>
        ) : null}
      </div>

      {isLoading ? (
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
          onAction={filtered ? clearFilters : () => setAddOpen(true)}
        />
      ) : view === 'table' ? (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[52rem] border-collapse text-start">
            <thead>
              <tr className="border-b border-line bg-surface text-2xs text-muted">
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
                const owned = isOwned(property) ? property : null;
                return (
                  <tr
                    key={property.id}
                    className="cursor-pointer transition-colors duration-150 hover:bg-surface"
                    onClick={() => navigate(`/owner/properties/${property.id}`)}
                  >
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
                        {property.floor}/{property.totalFloors}
                      </Num>
                    </td>
                    <td className="p-3">
                      <Num board className="text-sm font-bold text-ink">
                        {formatAgorot(property.monthlyRentAgorot)}
                      </Num>
                    </td>
                    <td className="p-3 text-sm text-ink-soft">{owned?.tenant?.name ?? '—'}</td>
                    <td className="p-3 text-sm">
                      {owned?.lease ? (
                        <Num board className="text-ink-soft">
                          {formatDate(owned.lease.endDate)}
                        </Num>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        {owned ? <UnitStatusBadge status={owned.status} size="sm" /> : null}
                        {owned?.listed ? (
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
            const owned = isOwned(property) ? property : null;
            return (
              <button
                key={property.id}
                type="button"
                onClick={() => navigate(`/owner/properties/${property.id}`)}
                className="group overflow-hidden rounded-[var(--radius-card)] border border-line text-start transition-colors duration-150 hover:border-line-strong"
              >
                <span className="relative block aspect-[4/3] overflow-hidden bg-surface-sunk">
                  {property.photos[0] ? (
                    <img
                      src={property.photos[0]}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 ease-[var(--ease-out)] group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    />
                  ) : null}
                  {owned ? (
                    <span className="absolute top-2 start-2">
                      <UnitStatusBadge status={owned.status} size="sm" />
                    </span>
                  ) : null}
                </span>
                <span className="block p-3.5">
                  <span className="block text-sm font-bold text-ink">
                    {property.address.street} {property.address.number}
                  </span>
                  <span className="mt-0.5 block text-2xs text-muted">
                    {property.address.neighborhood} · {formatRooms(property.rooms)} ·{' '}
                    {formatSqm(property.sqm)} · {formatFloor(property.floor, property.totalFloors)}
                  </span>
                  <span className="mt-2.5 flex items-center justify-between gap-2">
                    <Num board className="text-base font-bold text-ink">
                      {formatAgorot(property.monthlyRentAgorot)}
                    </Num>
                    <AvailabilityChip
                      kind={property.availability.kind}
                      date={property.availability.date ?? undefined}
                      confidence={property.availability.confidence}
                      size="sm"
                    />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <AddPropertyDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(id) => navigate(`/owner/properties/${id}`)}
      />
    </div>
  );
}

function AddPropertyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const create = useCreateProperty();
  const pushToast = useStore((s) => s.pushToast);
  const [street, setStreet] = React.useState('');
  const [houseNumber, setHouseNumber] = React.useState('');
  const [city, setCity] = React.useState(CITIES[0]?.name ?? 'תל אביב-יפו');
  const [neighborhood, setNeighborhood] = React.useState('');
  const [rooms, setRooms] = React.useState('3');
  const [sqm, setSqm] = React.useState('70');
  const [floor, setFloor] = React.useState('2');
  const [totalFloors, setTotalFloors] = React.useState('4');
  const [rent, setRent] = React.useState('7200');
  const [listed, setListed] = React.useState(false);

  const submit = () => {
    create.mutate(
      {
        street,
        houseNumber,
        city,
        neighborhood,
        rooms: Number(rooms) || 3,
        sqm: Number(sqm) || 70,
        floor: Number(floor) || 0,
        totalFloors: Number(totalFloors) || 1,
        monthlyRentShekels: Number(rent) || 0,
        listed,
        status: 'vacant',
        amenities: [],
      },
      {
        onSuccess: (property) => {
          pushToast(t.ui.saved, 'success');
          onOpenChange(false);
          onCreated(property.id);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.properties.addPropertyTitle}</DialogTitle>
          <DialogDescription>{t.properties.addPropertyHint}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t.properties.street} htmlFor="np-street" className="sm:col-span-2">
              <Input id="np-street" value={street} onChange={(e) => setStreet(e.target.value)} />
            </Field>
            <Field label={t.properties.houseNumber} htmlFor="np-num">
              <Input id="np-num" value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.properties.city} htmlFor="np-city">
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger id="np-city">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CITIES.map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t.properties.neighborhood} htmlFor="np-hood">
              <Input id="np-hood" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label={t.properties.rooms} htmlFor="np-rooms">
              <Input id="np-rooms" dir="ltr" className="num" value={rooms} onChange={(e) => setRooms(e.target.value)} />
            </Field>
            <Field label={t.properties.sqm} htmlFor="np-sqm">
              <Input id="np-sqm" dir="ltr" className="num" value={sqm} onChange={(e) => setSqm(e.target.value)} />
            </Field>
            <Field label={t.properties.floor} htmlFor="np-floor">
              <Input id="np-floor" dir="ltr" className="num" value={floor} onChange={(e) => setFloor(e.target.value)} />
            </Field>
            <Field label={t.properties.totalFloors} htmlFor="np-tf">
              <Input id="np-tf" dir="ltr" className="num" value={totalFloors} onChange={(e) => setTotalFloors(e.target.value)} />
            </Field>
          </div>
          <Field label={t.properties.monthlyRent} htmlFor="np-rent">
            <Input id="np-rent" dir="ltr" className="num" value={rent} onChange={(e) => setRent(e.target.value)} />
          </Field>
          <label className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-line px-3.5 py-2.5">
            <span className="text-sm font-semibold text-ink">{t.properties.listedAfterSave}</span>
            <Switch checked={listed} onCheckedChange={setListed} aria-label={t.properties.listedAfterSave} />
          </label>
        </DialogBody>
        <DialogFooter>
          <Button onClick={submit} loading={create.isPending} disabled={!street || !houseNumber || !neighborhood}>
            {t.properties.saveProperty}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
