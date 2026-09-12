import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  t,
  formatFloor,
  formatRooms,
  formatSqm,
  toShekels,
  CITIES,
  DISTRICTS,
  citiesByDistrict,
  type Amenity,
  type District,
  type SearchFilters,
  type SearchResult,
} from '@miftan/shared';
import { useInquiries, useLeads, useRunSearch } from '@/api/hooks';
import { ResultsMap } from '@/components/shared/map';
import { AVAILABILITY_COLOR, AVAILABILITY_LABEL, AvailabilityChip } from '@/components/shared/status';
import { Money, Num, PageHeader } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
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
import { cn } from '@/lib/utils';
import { Map as MapIcon, MessageCircleQuestion, Rows3, SlidersHorizontal, SearchX } from 'lucide-react';

const AMENITY_FILTERS: Amenity[] = [
  'elevator',
  'parking',
  'balcony',
  'mamad',
  'furnished',
  'pets_allowed',
  'ac',
  'storage',
  'accessible',
  'renovated',
];

const KINDS = ['now', 'dated', 'extending', 'unknown'] as const;

type Sort = SearchFilters['sort'];

interface FormState {
  district: District | 'all';
  city: string;
  neighborhood: string;
  minRooms: string;
  maxRooms: string;
  minSqm: string;
  maxSqm: string;
  minPrice: string;
  maxPrice: string;
  minFloor: string;
  maxFloor: string;
  availableFrom: string;
  availableBy: string;
  includeOccupied: boolean;
  confirmedOnly: boolean;
  minLeaseMonths: string;
  amenities: Amenity[];
  sort: Sort;
}

const EMPTY: FormState = {
  district: 'all',
  city: 'all',
  neighborhood: '',
  minRooms: '',
  maxRooms: '',
  minSqm: '',
  maxSqm: '',
  minPrice: '',
  maxPrice: '',
  minFloor: '',
  maxFloor: '',
  availableFrom: '',
  availableBy: '',
  includeOccupied: true,
  confirmedOnly: false,
  minLeaseMonths: '',
  amenities: [],
  sort: 'date',
};

function num(raw: string): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function toFilters(form: FormState): SearchFilters {
  return {
    district: form.district === 'all' ? undefined : form.district,
    city: form.city === 'all' ? undefined : form.city,
    neighborhood: form.neighborhood.trim() || undefined,
    minRooms: num(form.minRooms),
    maxRooms: num(form.maxRooms),
    minSqm: num(form.minSqm),
    maxSqm: num(form.maxSqm),
    minPrice: num(form.minPrice),
    maxPrice: num(form.maxPrice),
    minFloor: num(form.minFloor),
    maxFloor: num(form.maxFloor),
    amenities: form.amenities,
    availableFrom: form.availableFrom || undefined,
    availableBy: form.availableBy || undefined,
    includeOccupied: form.includeOccupied,
    confirmedOnly: form.confirmedOnly,
    minLeaseMonths: num(form.minLeaseMonths),
    sort: form.sort,
  };
}

export function SeekerSearch() {
  const navigate = useNavigate();
  const runSearch = useRunSearch();
  const { data: leads = [] } = useLeads();
  const { data: inquiries = [] } = useInquiries();

  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [mobileView, setMobileView] = React.useState<'list' | 'map'>('list');
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  /* First open is a search the user performed. Later keystrokes debounce so
     we do not write a demand row for every digit of a price. */
  React.useEffect(() => {
    const handle = window.setTimeout(() => runSearch.mutate(toFilters(form)), 400);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the mutation function is stable enough; we key off the form.
  }, [form]);

  const results = runSearch.data?.results ?? [];
  const total = runSearch.data?.total ?? 0;
  const later = runSearch.data?.totalIgnoringDate ?? 0;

  const cities = React.useMemo(() => {
    if (form.district === 'all') return CITIES;
    return CITIES.filter((c) => c.district === form.district);
  }, [form.district]);

  const queuedIds = React.useMemo(
    () => new Set(leads.filter((l) => l.scope === 'seeker').map((l) => l.propertyId)),
    [leads],
  );
  const askedIds = React.useMemo(
    () => new Set(inquiries.filter((x) => x.scope === 'seeker').map((x) => x.propertyId)),
    [inquiries],
  );

  const dirty = JSON.stringify(form) !== JSON.stringify(EMPTY);
  const reset = () => setForm(EMPTY);

  const mapListings = results.map((row) => ({
    id: row.id,
    lat: row.lat,
    lng: row.lng,
    monthlyRentShekels: toShekels(row.monthlyRentAgorot),
    availabilityKind: row.availability.kind,
    availableDate: row.availability.date,
  }));

  const filterControls = (
    <>
      <Field label={t.seeker.search.district} className="min-w-40 flex-1">
        <Select
          value={form.district}
          onValueChange={(v) =>
            setForm((f) => ({ ...f, district: v as District | 'all', city: 'all' }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.seeker.search.allDistricts}</SelectItem>
            {citiesByDistrict().map((group) => (
              <SelectItem key={group.district} value={group.district}>
                {group.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={t.seeker.search.city} className="min-w-36 flex-1">
        <Select value={form.city} onValueChange={(v) => setForm((f) => ({ ...f, city: v }))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.properties.all}</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c.name} value={c.name}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={t.seeker.search.neighborhood} className="min-w-36 flex-1" htmlFor="neighborhood">
        <Input
          id="neighborhood"
          value={form.neighborhood}
          onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))}
        />
      </Field>

      <Field label={t.seeker.search.rooms} className="w-44">
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            dir="ltr"
            className="num"
            placeholder="1"
            value={form.minRooms}
            onChange={(e) => setForm((f) => ({ ...f, minRooms: e.target.value }))}
            aria-label={`${t.seeker.search.rooms} — ${t.ui.less}`}
          />
          <span className="text-muted">–</span>
          <Input
            type="number"
            dir="ltr"
            className="num"
            placeholder="12"
            value={form.maxRooms}
            onChange={(e) => setForm((f) => ({ ...f, maxRooms: e.target.value }))}
            aria-label={`${t.seeker.search.rooms} — ${t.ui.more}`}
          />
        </div>
      </Field>

      <Field label={t.seeker.search.sqmRange} className="w-44">
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            dir="ltr"
            className="num"
            value={form.minSqm}
            onChange={(e) => setForm((f) => ({ ...f, minSqm: e.target.value }))}
          />
          <span className="text-muted">–</span>
          <Input
            type="number"
            dir="ltr"
            className="num"
            value={form.maxSqm}
            onChange={(e) => setForm((f) => ({ ...f, maxSqm: e.target.value }))}
          />
        </div>
      </Field>

      <Field label={t.seeker.search.priceRange} className="w-44">
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            dir="ltr"
            className="num"
            placeholder="0"
            value={form.minPrice}
            onChange={(e) => setForm((f) => ({ ...f, minPrice: e.target.value }))}
          />
          <span className="text-muted">–</span>
          <Input
            type="number"
            dir="ltr"
            className="num"
            placeholder="∞"
            value={form.maxPrice}
            onChange={(e) => setForm((f) => ({ ...f, maxPrice: e.target.value }))}
          />
        </div>
      </Field>

      <Field label={t.seeker.search.floor} className="w-44">
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            dir="ltr"
            className="num"
            value={form.minFloor}
            onChange={(e) => setForm((f) => ({ ...f, minFloor: e.target.value }))}
          />
          <span className="text-muted">–</span>
          <Input
            type="number"
            dir="ltr"
            className="num"
            value={form.maxFloor}
            onChange={(e) => setForm((f) => ({ ...f, maxFloor: e.target.value }))}
          />
        </div>
      </Field>

      <Field
        label={t.seeker.search.availableFrom}
        hint={t.seeker.search.availableFromHint}
        className="w-44"
        htmlFor="available-from"
      >
        <Input
          id="available-from"
          type="date"
          dir="ltr"
          className="num border-signal/60"
          value={form.availableFrom}
          onChange={(e) => setForm((f) => ({ ...f, availableFrom: e.target.value }))}
        />
      </Field>

      <Field label={t.seeker.search.availableBy} className="w-44" htmlFor="available-by">
        <Input
          id="available-by"
          type="date"
          dir="ltr"
          className="num"
          value={form.availableBy}
          onChange={(e) => setForm((f) => ({ ...f, availableBy: e.target.value }))}
        />
      </Field>

      <Field label={t.seeker.search.minLeaseMonths} className="w-36" htmlFor="min-lease">
        <Input
          id="min-lease"
          type="number"
          dir="ltr"
          className="num"
          value={form.minLeaseMonths}
          onChange={(e) => setForm((f) => ({ ...f, minLeaseMonths: e.target.value }))}
        />
      </Field>
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
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
                {total}
              </Num>{' '}
              {t.seeker.search.resultsCount}
            </span>
            <label className="flex items-center gap-2 text-xs text-ink-soft">
              <Checkbox
                checked={form.includeOccupied}
                onCheckedChange={(v) => setForm((f) => ({ ...f, includeOccupied: Boolean(v) }))}
              />
              {t.seeker.search.showOccupied}
            </label>
            <label className="flex items-center gap-2 text-xs text-ink-soft">
              <Checkbox
                checked={form.confirmedOnly}
                onCheckedChange={(v) => setForm((f) => ({ ...f, confirmedOnly: Boolean(v) }))}
              />
              {t.seeker.search.confirmedOnly}
            </label>
            <Select value={form.sort} onValueChange={(v) => setForm((f) => ({ ...f, sort: v as Sort }))}>
              <SelectTrigger className="ms-auto h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">{t.seeker.search.sortDate}</SelectItem>
                <SelectItem value="price_asc">{t.seeker.search.sortPriceAsc}</SelectItem>
                <SelectItem value="price_desc">{t.seeker.search.sortPriceDesc}</SelectItem>
                <SelectItem value="rooms">{t.seeker.search.sortRooms}</SelectItem>
                <SelectItem value="sqm">{t.seeker.search.sortSqm}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {AMENITY_FILTERS.map((amenity) => {
              const active = form.amenities.includes(amenity);
              return (
                <button
                  key={amenity}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
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
            {runSearch.isError ? (
              <ErrorState onRetry={() => runSearch.mutate(toFilters(form))} />
            ) : runSearch.isPending && !runSearch.data ? (
              <CardGridSkeleton cards={4} />
            ) : results.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title={t.seeker.search.noResults}
                hint={
                  later > 0
                    ? t.seeker.search.laterResults.replace('{count}', String(later))
                    : t.seeker.search.noResultsHint
                }
                action={t.seeker.search.clearFilters}
                onAction={reset}
              />
            ) : (
              <ul className="space-y-2.5">
                {results.map((row) => (
                  <ResultRow
                    key={row.id}
                    row={row}
                    active={activeId === row.id}
                    queued={queuedIds.has(row.id)}
                    asked={askedIds.has(row.id)}
                    onHover={() => setActiveId(row.id)}
                    onOpen={() => navigate(`/search/${row.id}`)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>

        <div
          className={cn(
            'relative min-h-0 flex-1 border-s border-line',
            mobileView === 'list' && 'max-lg:hidden',
          )}
        >
          <ResultsMap
            listings={mapListings}
            activeId={activeId}
            onSelect={(id) => {
              setActiveId(id);
              navigate(`/search/${id}`);
            }}
            className="h-full w-full"
          />

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

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.seeker.search.filters}</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-wrap gap-3">{filterControls}</DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button>
                {t.seeker.search.applyFilters} · <Num board>{total}</Num>
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

function ResultRow({
  row,
  active,
  queued,
  asked,
  onHover,
  onOpen,
}: {
  row: SearchResult;
  active: boolean;
  queued: boolean;
  asked: boolean;
  onHover: () => void;
  onOpen: () => void;
}) {
  const askable = row.availability.askable && !asked;
  return (
    <li>
      <button
        type="button"
        onMouseEnter={onHover}
        onFocus={onHover}
        onClick={onOpen}
        className={cn(
          'flex w-full gap-3 rounded-[var(--radius-card)] border p-2.5 text-start transition-colors duration-150',
          active ? 'border-ink bg-surface' : 'border-line hover:border-line-strong',
        )}
      >
        {row.photos[0] ? (
          <img
            src={row.photos[0]}
            alt=""
            loading="lazy"
            className="h-24 w-28 shrink-0 rounded-[8px] object-cover sm:h-28 sm:w-36"
          />
        ) : (
          <span className="h-24 w-28 shrink-0 rounded-[8px] bg-surface sm:h-28 sm:w-36" />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-ink">
                {row.street} {row.houseNumber}
              </span>
              <span className="block truncate text-2xs text-muted">
                {row.neighborhood} · {row.city}
                {row.district ? ` · ${DISTRICTS[row.district]}` : ''}
              </span>
            </span>
            <Money agorot={row.monthlyRentAgorot} board className="shrink-0 text-base font-bold text-ink" />
          </span>

          <span className="mt-1.5 block text-2xs text-muted">
            {formatRooms(row.rooms)} · {formatSqm(row.sqm)} · {formatFloor(row.floor, row.totalFloors)}
          </span>

          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            <AvailabilityChip
              kind={row.availability.kind}
              date={row.availability.date ?? undefined}
              confidence={row.availability.confidence}
              size="sm"
              withCountdown
            />
            {row.queueLength > 0 ? (
              <Badge tone="outline" size="sm">
                <Num board>{row.queueLength}</Num> {t.seeker.search.inQueue}
              </Badge>
            ) : null}
            {queued ? (
              <Badge tone="openSoft" size="sm">
                {t.seeker.listing.reserved}
              </Badge>
            ) : null}
            {askable ? (
              <Badge tone="liveSoft" size="sm">
                <MessageCircleQuestion className="h-3 w-3" />
                {t.inquiries.seeker.ask}
              </Badge>
            ) : null}
            {asked ? (
              <Badge tone="neutral" size="sm">
                {t.inquiries.seeker.pending}
              </Badge>
            ) : null}
          </span>
        </span>
      </button>
    </li>
  );
}
