import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStoreShallow } from '@/data/store';
import { t } from '@/i18n/he';
import { availabilityKind, leaseForProperty, type AvailabilityKind } from '@/data/selectors';
import { ResultsMap } from '@/components/shared/map';
import { AVAILABILITY_COLOR, AVAILABILITY_LABEL, AvailabilityChip } from '@/components/shared/status';
import { Money, Num, PageHeader } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
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
import { CardGridSkeleton } from '@/components/shared/skeleton';
import { useDelayedReady } from '@/lib/use-delayed-ready';
import { formatFloor, formatRooms, formatSqm } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Amenity, Property } from '@/types';
import { Map as MapIcon, MessageCircleQuestion, Rows3, SlidersHorizontal, SearchX } from 'lucide-react';

const AMENITY_FILTERS: Amenity[] = ['elevator', 'parking', 'balcony', 'mamad', 'furnished', 'pets_allowed'];
const KINDS: AvailabilityKind[] = ['now', 'dated', 'extending', 'unknown'];

interface Filters {
  city: string;
  neighborhood: string;
  rooms: string;
  minPrice: string;
  maxPrice: string;
  minFloor: string;
  availableFrom: string;
  amenities: Amenity[];
  showOccupied: boolean;
}

const EMPTY: Filters = {
  city: 'all',
  neighborhood: 'all',
  rooms: 'all',
  minPrice: '',
  maxPrice: '',
  minFloor: 'all',
  availableFrom: '',
  amenities: [],
  showOccupied: true,
};

type Sort = 'date' | 'price' | 'rooms';

export function SeekerSearch() {
  const navigate = useNavigate();
  const ready = useDelayedReady();
  const { properties, leases, leads, inquiries, currentSeekerId } = useStoreShallow((s) => ({
    properties: s.properties,
    leases: s.leases,
    leads: s.leads,
    inquiries: s.inquiries,
    currentSeekerId: s.currentSeekerId,
  }));

  const [filters, setFilters] = React.useState<Filters>(EMPTY);
  const [sort, setSort] = React.useState<Sort>('date');
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [mobileView, setMobileView] = React.useState<'list' | 'map'>('list');
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  const kindOf = React.useCallback(
    (property: Property) => availabilityKind(property, leaseForProperty(leases, property.id)),
    [leases],
  );

  const listed = React.useMemo(() => properties.filter((p) => p.listed), [properties]);

  const cities = React.useMemo(() => [...new Set(listed.map((p) => p.address.city))], [listed]);
  const neighborhoods = React.useMemo(
    () =>
      [
        ...new Set(
          listed
            .filter((p) => filters.city === 'all' || p.address.city === filters.city)
            .map((p) => p.address.neighborhood),
        ),
      ],
    [listed, filters.city],
  );

  const results = React.useMemo(() => {
    const rows = listed.filter((property) => {
      const kind = kindOf(property);
      if (!filters.showOccupied && kind !== 'now') return false;
      if (filters.city !== 'all' && property.address.city !== filters.city) return false;
      if (filters.neighborhood !== 'all' && property.address.neighborhood !== filters.neighborhood)
        return false;
      if (filters.rooms !== 'all' && Math.floor(property.rooms) !== Number(filters.rooms)) return false;
      if (filters.minPrice && property.monthly_rent < Number(filters.minPrice)) return false;
      if (filters.maxPrice && property.monthly_rent > Number(filters.maxPrice)) return false;
      if (filters.minFloor !== 'all' && property.floor < Number(filters.minFloor)) return false;
      if (filters.amenities.some((a) => !property.amenities.includes(a))) return false;
      /* The filter that carries the product: a date, not a boolean. */
      if (filters.availableFrom) {
        const from = property.status === 'vacant' ? '0000-00-00' : property.available_from;
        if (!from) return false;
        if (from > filters.availableFrom) return false;
      }
      return true;
    });

    return rows.sort((a, b) => {
      if (sort === 'price') return a.monthly_rent - b.monthly_rent;
      if (sort === 'rooms') return a.rooms - b.rooms;
      const aFrom = a.status === 'vacant' ? '0000' : (a.available_from ?? '9999');
      const bFrom = b.status === 'vacant' ? '0000' : (b.available_from ?? '9999');
      return aFrom.localeCompare(bFrom);
    });
  }, [listed, filters, sort, kindOf]);

  const askedIds = React.useMemo(
    () =>
      new Set(
        inquiries.filter((x) => x.seeker_id === currentSeekerId).map((x) => x.property_id),
      ),
    [inquiries, currentSeekerId],
  );

  const queuedIds = React.useMemo(
    () => new Set(leads.filter((l) => l.seeker_id === currentSeekerId).map((l) => l.property_id)),
    [leads, currentSeekerId],
  );

  const queueCount = React.useCallback(
    (propertyId: string) => leads.filter((l) => l.property_id === propertyId && !l.watch_only).length,
    [leads],
  );

  const dirty = JSON.stringify(filters) !== JSON.stringify(EMPTY);
  const reset = () => setFilters(EMPTY);

  const filterControls = (
    <>
      <Field label={t.seeker.search.city} className="min-w-36 flex-1">
        <Select
          value={filters.city}
          onValueChange={(v) => setFilters((f) => ({ ...f, city: v, neighborhood: 'all' }))}
        >
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

      <Field label={t.seeker.search.neighborhood} className="min-w-36 flex-1">
        <Select
          value={filters.neighborhood}
          onValueChange={(v) => setFilters((f) => ({ ...f, neighborhood: v }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.properties.all}</SelectItem>
            {neighborhoods.map((n) => (
              <SelectItem key={n} value={n}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={t.seeker.search.rooms} className="w-28">
        <Select value={filters.rooms} onValueChange={(v) => setFilters((f) => ({ ...f, rooms: v }))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.properties.all}</SelectItem>
            {['1', '2', '3', '4'].map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={t.seeker.search.priceRange} className="w-44">
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            dir="ltr"
            className="num"
            placeholder="0"
            value={filters.minPrice}
            onChange={(e) => setFilters((f) => ({ ...f, minPrice: e.target.value }))}
            aria-label={`${t.seeker.search.priceRange} — ${t.ui.less}`}
          />
          <span className="text-muted">–</span>
          <Input
            type="number"
            dir="ltr"
            className="num"
            placeholder="∞"
            value={filters.maxPrice}
            onChange={(e) => setFilters((f) => ({ ...f, maxPrice: e.target.value }))}
            aria-label={`${t.seeker.search.priceRange} — ${t.ui.more}`}
          />
        </div>
      </Field>

      {/* The product's filter */}
      <Field
        label={t.seeker.search.availableFrom}
        hint={t.seeker.search.availableFromHint}
        className="w-48"
        htmlFor="available-from"
      >
        <Input
          id="available-from"
          type="date"
          dir="ltr"
          className="num border-signal/60"
          value={filters.availableFrom}
          onChange={(e) => setFilters((f) => ({ ...f, availableFrom: e.target.value }))}
        />
      </Field>
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Desktop split view */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Results */}
        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:max-w-[46rem]',
            mobileView === 'map' && 'max-lg:hidden',
          )}
        >
          <PageHeader
            title={t.seeker.search.title}
            subtitle={t.seeker.search.thesis}
            actions={
              <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setFiltersOpen(true)}>
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {t.seeker.search.filters}
              </Button>
            }
          />

          <div className="mt-4 hidden flex-wrap items-end gap-3 lg:flex">{filterControls}</div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted">
              <Num board className="font-bold text-ink">
                {results.length}
              </Num>{' '}
              {t.seeker.search.resultsCount}
            </span>
            <label className="flex items-center gap-2 text-xs text-ink-soft">
              <Checkbox
                checked={filters.showOccupied}
                onCheckedChange={(v) => setFilters((f) => ({ ...f, showOccupied: Boolean(v) }))}
              />
              {t.seeker.search.showOccupied}
            </label>
            <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <SelectTrigger className="ms-auto h-8 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">{t.seeker.search.sortDate}</SelectItem>
                <SelectItem value="price">{t.seeker.search.sortPrice}</SelectItem>
                <SelectItem value="rooms">{t.seeker.search.sortRooms}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Amenity chips */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {AMENITY_FILTERS.map((amenity) => {
              const active = filters.amenities.includes(amenity);
              return (
                <button
                  key={amenity}
                  type="button"
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      amenities: active
                        ? f.amenities.filter((a) => a !== amenity)
                        : [...f.amenities, amenity],
                    }))
                  }
                  aria-pressed={active}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-2xs font-semibold transition-colors duration-150',
                    active
                      ? 'border-ink bg-ink text-on-ink'
                      : 'border-line text-ink-soft hover:border-line-strong',
                  )}
                >
                  {t.amenity[amenity]}
                </button>
              );
            })}
            {dirty ? (
              <button
                type="button"
                onClick={reset}
                className="px-2 text-2xs font-semibold text-muted underline-offset-2 hover:text-ink hover:underline"
              >
                {t.seeker.search.clearFilters}
              </button>
            ) : null}
          </div>

          <div className="mt-4">
            {!ready ? (
              <CardGridSkeleton cards={4} />
            ) : results.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title={t.seeker.search.noResults}
                hint={t.seeker.search.noResultsHint}
                action={t.seeker.search.clearFilters}
                onAction={reset}
              />
            ) : (
              <ul className="space-y-2.5">
                {results.map((property) => {
                  const kind = kindOf(property);
                  const queued = queuedIds.has(property.id);
                  return (
                    <li key={property.id}>
                      <button
                        type="button"
                        onMouseEnter={() => setActiveId(property.id)}
                        onFocus={() => setActiveId(property.id)}
                        onClick={() => navigate(`/search/${property.id}`)}
                        className={cn(
                          'flex w-full gap-3 rounded-[var(--radius-card)] border p-2.5 text-start transition-colors duration-150',
                          activeId === property.id
                            ? 'border-ink bg-surface'
                            : 'border-line hover:border-line-strong',
                        )}
                      >
                        <img
                          src={property.photos[0]}
                          alt=""
                          loading="lazy"
                          className="h-24 w-28 shrink-0 rounded-[8px] object-cover sm:h-28 sm:w-36"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-bold text-ink">
                                {property.address.street} {property.address.number}
                              </span>
                              <span className="block truncate text-2xs text-muted">
                                {property.address.neighborhood} · {property.address.city}
                              </span>
                            </span>
                            <Money
                              value={property.monthly_rent}
                              board
                              className="shrink-0 text-base font-bold text-ink"
                            />
                          </span>

                          <span className="mt-1.5 block text-2xs text-muted">
                            {formatRooms(property.rooms)} · {formatSqm(property.sqm)} ·{' '}
                            {formatFloor(property.floor, property.total_floors)}
                          </span>

                          <span className="mt-2 flex flex-wrap items-center gap-1.5">
                            <AvailabilityChip
                              kind={kind}
                              date={property.available_from}
              confidence={property.availability_confidence}
                              size="sm"
                              withCountdown
                            />
                            {queueCount(property.id) > 0 ? (
                              <Badge tone="outline" size="sm">
                                <Num board>{queueCount(property.id)}</Num> {t.seeker.search.inQueue}
                              </Badge>
                            ) : null}
                            {queued ? (
                              <Badge tone="openSoft" size="sm">
                                {t.seeker.listing.reserved}
                              </Badge>
                            ) : null}
                            {/* The apartments the market usually hides: no
                                date because nobody has asked yet. */}
                            {(kind === 'unknown' || kind === 'extending') && !askedIds.has(property.id) ? (
                              <Badge tone="liveSoft" size="sm">
                                <MessageCircleQuestion className="h-3 w-3" />
                                {t.inquiries.seeker.ask}
                              </Badge>
                            ) : null}
                            {askedIds.has(property.id) ? (
                              <Badge tone="neutral" size="sm">
                                {t.inquiries.seeker.pending}
                              </Badge>
                            ) : null}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Map */}
        <div
          className={cn(
            'relative min-h-0 flex-1 border-s border-line',
            mobileView === 'list' && 'max-lg:hidden',
          )}
        >
          <ResultsMap
            properties={results}
            kindOf={kindOf}
            activeId={activeId}
            onSelect={(id) => {
              setActiveId(id);
              navigate(`/search/${id}`);
            }}
            className="h-full w-full"
          />

          {/* Legend */}
          <div
            style={{ zIndex: 'var(--z-map-overlay)' }}
            className="pointer-events-none absolute bottom-3 start-3 rounded-[var(--radius-card)] border border-line bg-bg/95 p-2.5 backdrop-blur"
          >
            <p className="mb-1.5 text-2xs font-bold text-ink">{t.seeker.search.mapLegend}</p>
            <ul className="space-y-1">
              {KINDS.map((kind) => (
                <li key={kind} className="flex items-center gap-2 text-2xs text-muted">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                    style={{ background: AVAILABILITY_COLOR[kind] }}
                  />
                  {AVAILABILITY_LABEL[kind]}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 max-w-44 border-t border-line pt-1.5 text-[10px] leading-3 text-muted">
              {t.availability.askableHint}
            </p>
          </div>
        </div>
      </div>

      {/* Mobile list/map toggle */}
      <div className="flex justify-center border-t border-line bg-bg p-2 lg:hidden">
        <div className="flex items-center gap-0.5 rounded-full border border-line p-0.5">
          {(
            [
              ['list', Rows3, t.seeker.search.list],
              ['map', MapIcon, t.seeker.search.map],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMobileView(id)}
              aria-pressed={mobileView === id}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors duration-150',
                mobileView === id ? 'bg-ink text-on-ink' : 'text-muted',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile filters */}
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.seeker.search.filters}</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-wrap gap-3">{filterControls}</DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button>
                {t.seeker.search.applyFilters} · <Num board>{results.length}</Num>
              </Button>
            </DialogClose>
            <Button variant="secondary" onClick={reset}>
              {t.seeker.search.clearFilters}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
