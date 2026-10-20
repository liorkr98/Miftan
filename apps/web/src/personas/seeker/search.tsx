import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  t,
  toShekels,
  TEL_AVIV_AREAS,
  computeAreaStats,
  computeInsight,
  evaluateMatch,
  parseSearchIntent,
  passesSmart,
  recommendedScore,
  type AreaStats,
  type Amenity,
  type IntentSort,
  type SearchIntent,
  type SearchResult,
  type SmartFilter,
  type UnsupportedConcept,
} from '@miftan/shared';
import {
  useInquiries,
  useInterpretSearch,
  useLeads,
  useRenterProfile,
  useRunSearch,
  useSearchUniverse,
} from '@/api/hooks';
import { Onboarding } from '@/components/shared/onboarding';
import { ResultsMap } from '@/components/shared/map';
import { AVAILABILITY_COLOR, AVAILABILITY_LABEL } from '@/components/shared/status';
import { Money, Num, PageHeader } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
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
import { CardGridSkeleton } from '@/components/shared/skeleton';
import { cn } from '@/lib/utils';
import {
  ArrowUpLeft,
  ChevronDown,
  Columns2,
  Map as MapIcon,
  Rows3,
  SearchX,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { ResultCard, type EnrichedResult } from './search-card';
import { EMPTY, applyIntent, buildChips, toCriteria, toFilters, type FormState } from './search-state';

const AMENITY_FILTERS: Amenity[] = [
  'elevator', 'parking', 'balcony', 'mamad', 'furnished',
  'pets_allowed', 'ac', 'storage', 'accessible', 'renovated',
];

const KINDS = ['now', 'dated', 'extending', 'unknown'] as const;

const SMART_PILLS: { key: SmartFilter; label: string; hint: string }[] = [
  { key: 'below_market', label: t.seeker.search.smartBelow, hint: t.seeker.search.smartBelowHint },
  { key: 'soon', label: t.seeker.search.smartSoon, hint: t.seeker.search.smartSoonHint },
  { key: 'low_competition', label: t.seeker.search.smartLow, hint: t.seeker.search.smartLowHint },
];

const EXAMPLES = [
  t.seeker.search.aiExample1,
  t.seeker.search.aiExample2,
  t.seeker.search.aiExample3,
  t.seeker.search.aiExample4,
];

const NO_RESULTS: SearchResult[] = [];

type View = 'list' | 'map' | 'split';
type Scored = EnrichedResult & { score: number };

interface AiNote {
  kind: 'ok' | 'nothing';
  count: number;
  unsupported: UnsupportedConcept[];
}

const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), template);

export function SeekerSearch() {
  const navigate = useNavigate();
  const runSearch = useRunSearch();
  const universeQuery = useSearchUniverse();
  const interpret = useInterpretSearch();
  const { data: leads = [] } = useLeads();
  const { data: inquiries = [] } = useInquiries();
  const { data: renterProfile } = useRenterProfile();
  const mineSeeker = leads.filter((l) => l.scope === 'seeker');

  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [aiText, setAiText] = React.useState('');
  const [aiNote, setAiNote] = React.useState<AiNote | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [view, setView] = React.useState<View>('split');
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [manualOpen, setManualOpen] = React.useState(false);
  const now = React.useMemo(() => new Date(), []);
  const scroller = React.useRef<HTMLDivElement>(null);

  /* Keyed on the filters the server actually sees. Sorting, smart filters and
     soft preferences are applied here, and must not write a demand row. First
     open is a search the user performed; later keystrokes debounce so we do
     not record every digit of a price. */
  const filtersKey = JSON.stringify(toFilters(form));
  React.useEffect(() => {
    const handle = window.setTimeout(() => runSearch.mutate(toFilters(form)), 400);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the serialised filters on purpose.
  }, [filtersKey]);

  const results = runSearch.data?.results ?? NO_RESULTS;
  const total = runSearch.data?.total ?? 0;
  const later = runSearch.data?.totalIgnoringDate ?? 0;
  const universe = universeQuery.data?.results ?? NO_RESULTS;

  const areaStats = React.useMemo<AreaStats[]>(
    () => form.areas.map((area) => computeAreaStats(universe, area, now)),
    [form.areas, universe, now],
  );

  const queuedIds = React.useMemo(
    () => new Set(leads.filter((l) => l.scope === 'seeker').map((l) => l.propertyId)),
    [leads],
  );
  const askedIds = React.useMemo(
    () => new Set(inquiries.filter((x) => x.scope === 'seeker').map((x) => x.propertyId)),
    [inquiries],
  );

  const chips = React.useMemo(() => buildChips(form), [form]);
  const criteria = React.useMemo(() => toCriteria(form), [form]);

  const enriched = React.useMemo<Scored[]>(
    () =>
      results.map((row) => {
        const insight = computeInsight(row, universe);
        const match = evaluateMatch(row, criteria, insight, now);
        const { score, reasons } = recommendedScore(row, insight, match, now);
        return { row, insight, match, reasons, score };
      }),
    [results, universe, criteria, now],
  );

  const visible = React.useMemo(() => {
    const kept = enriched.filter((e) => passesSmart(e.row, e.insight, form.smart, now));
    switch (form.sort) {
      case 'recommended':
        return [...kept].sort((a, b) => b.score - a.score);
      case 'best_match':
        return [...kept].sort(
          (a, b) =>
            (b.match.total ? b.match.met / b.match.total : 0) - (a.match.total ? a.match.met / a.match.total : 0) ||
            b.score - a.score,
        );
      case 'ppsqm':
        return [...kept].sort(
          (a, b) => a.row.monthlyRentAgorot / a.row.sqm - b.row.monthlyRentAgorot / b.row.sqm,
        );
      default:
        return kept;
    }
  }, [enriched, form.smart, form.sort, now]);

  const noComparison = form.smart.includes('below_market') ? enriched.filter((e) => !e.insight).length : 0;
  const reset = () => {
    setForm(EMPTY);
    setAiNote(null);
  };

  const applyResult = (intent: SearchIntent) => {
    if (intent.recognized === 0) {
      setAiNote({ kind: 'nothing', count: 0, unsupported: intent.unsupported });
      return;
    }
    setForm(applyIntent(intent));
    setAiNote({ kind: 'ok', count: intent.recognized, unsupported: intent.unsupported });
  };

  /* The server reads the text (with the language model when one is
     configured). If the request fails, the same rules run here instead, so
     the box never goes dead. */
  const submitAi = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || interpret.isPending) return;
    interpret.mutate(trimmed, {
      onSuccess: (res) => applyResult(res.intent),
      onError: () => applyResult(parseSearchIntent(trimmed, { now })),
    });
  };

  const findSimilar = (item: EnrichedResult) => {
    const { row } = item;
    setForm({
      ...EMPTY,
      areas: [row.neighborhood],
      minRooms: String(row.rooms),
      maxRooms: String(row.rooms),
      maxPrice: String(Math.max(0, Math.floor(toShekels(row.monthlyRentAgorot)) - 1)),
      sort: 'price_asc',
    });
    setAiNote(null);
    scroller.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const mapListings = visible.map(({ row }) => ({
    id: row.id,
    lat: row.lat,
    lng: row.lng,
    monthlyRentShekels: toShekels(row.monthlyRentAgorot),
    availabilityKind: row.availability.kind,
    availableDate: row.availability.date,
  }));

  const range = (
    label: string,
    lo: keyof FormState,
    hi: keyof FormState,
    opts: { placeholderLo?: string; placeholderHi?: string; className?: string } = {},
  ) => (
    <Field label={label} className={opts.className ?? 'w-40'}>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          dir="ltr"
          className="num"
          placeholder={opts.placeholderLo}
          value={form[lo] as string}
          onChange={(e) => setForm((f) => ({ ...f, [lo]: e.target.value }))}
          aria-label={`${label} — ${t.ui.less}`}
        />
        <span className="text-muted">–</span>
        <Input
          type="number"
          dir="ltr"
          className="num"
          placeholder={opts.placeholderHi}
          value={form[hi] as string}
          onChange={(e) => setForm((f) => ({ ...f, [hi]: e.target.value }))}
          aria-label={`${label} — ${t.ui.more}`}
        />
      </div>
    </Field>
  );

  const s = t.seeker.search;

  const sortLabel: Record<IntentSort, string> = {
    recommended: s.sortRecommended,
    best_match: s.sortBestMatch,
    date: s.sortDate,
    price_asc: s.sortPriceAsc,
    price_desc: s.sortPriceDesc,
    ppsqm: s.sortPpsqm,
    rooms: s.sortRooms,
    sqm: s.sortSqm,
  };

  const listing = (
    <>
      {runSearch.isError ? (
        <ErrorState onRetry={() => runSearch.mutate(toFilters(form))} />
      ) : runSearch.isPending && !runSearch.data ? (
        <CardGridSkeleton cards={4} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={s.noResults}
          hint={
            noComparison > 0
              ? fill(s.smartHidden, { count: noComparison })
              : later > 0
                ? s.laterResults.replace('{count}', String(later))
                : s.noResultsHint
          }
          action={s.clearFilters}
          onAction={reset}
        />
      ) : (
        <>
          <ul className={cn('grid grid-cols-1 gap-2.5', view === 'list' && 'lg:grid-cols-2')}>
            {visible.map((item) => (
              <ResultCard
                key={item.row.id}
                item={item}
                active={activeId === item.row.id}
                queued={queuedIds.has(item.row.id)}
                asked={askedIds.has(item.row.id)}
                showMatch={chips.length > 0}
                onHover={() => setActiveId(item.row.id)}
                onOpen={() => navigate(`/search/${item.row.id}`)}
                onSimilar={() => findSimilar(item)}
              />
            ))}
          </ul>
          {noComparison > 0 ? (
            <p className="mt-3 text-2xs text-muted">{fill(s.smartHidden, { count: noComparison })}</p>
          ) : null}
        </>
      )}
    </>
  );

  const map = (
    <div className="relative h-full w-full">
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
        <p className="mb-1.5 text-2xs font-bold text-ink">{s.mapLegend}</p>
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
        <p className="mt-1.5 max-w-44 border-t border-line pt-1.5 text-2xs leading-4 text-muted">
          {t.availability.askableHint}
        </p>
      </div>
    </div>
  );

  return (
    <div ref={scroller} className="h-full min-h-0 overflow-y-auto">
      {/* Workspace: describe it, or filter it, or both */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <PageHeader title={s.title} subtitle={s.thesis} />

          <Onboarding
            role="seeker"
            className="mt-4"
            steps={[
              { key: 'profile', done: Boolean(renterProfile?.complete), to: '/search/profile' },
              {
                key: 'search',
                done: mineSeeker.length > 0 || inquiries.some((x) => x.scope === 'seeker'),
                to: '/search',
              },
              { key: 'apply', done: mineSeeker.length > 0, to: '/search/queue' },
            ]}
          />

          <form
            className="mt-4 rounded-[var(--radius-panel)] border border-line-strong bg-bg p-3 shadow-[0_1px_0_rgba(0,0,0,0.02)] focus-within:border-ink"
            onSubmit={(e) => {
              e.preventDefault();
              submitAi(aiText);
            }}
          >
            <label htmlFor="ai-search" className="flex items-center gap-2 text-sm font-extrabold text-ink">
              <Sparkles className="h-4 w-4" aria-hidden />
              {s.aiTitle}
            </label>
            <p className="mt-0.5 text-xs text-muted">{s.aiSubtitle}</p>
            <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-end">
              <textarea
                id="ai-search"
                rows={2}
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submitAi(aiText);
                  }
                }}
                placeholder={s.aiPlaceholder}
                className="min-h-14 flex-1 resize-none rounded-[var(--radius-control)] border border-line bg-bg px-3 py-2 text-base text-ink placeholder:text-muted focus:border-ink focus:outline-none"
              />
              <Button
                type="submit"
                size="lg"
                disabled={!aiText.trim()}
                loading={interpret.isPending}
                className="max-sm:w-full"
              >
                {interpret.isPending ? s.aiWorking : s.aiSubmit}
              </Button>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {EXAMPLES.map((example, i) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => {
                    setAiText(example);
                    submitAi(example);
                  }}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-2xs font-semibold text-ink-soft transition-colors duration-150 hover:border-line-strong hover:text-ink',
                    i >= 2 && 'max-sm:hidden',
                  )}
                >
                  <ArrowUpLeft className="h-3 w-3" aria-hidden />
                  {example}
                </button>
              ))}
            </div>
            <p className="mt-2 text-2xs text-muted">{s.aiLocalNote}</p>
          </form>

          {aiNote ? (
            <div role="status" className="mt-2.5 space-y-0.5 text-xs text-ink-soft">
              <p className={cn(aiNote.kind === 'ok' ? 'font-bold text-ink' : 'text-alert')}>
                {aiNote.kind === 'ok' ? fill(s.aiUnderstood, { count: aiNote.count }) : s.aiNothing}
              </p>
              {aiNote.unsupported.length > 0 ? (
                <p className="text-muted">
                  {fill(s.aiUnsupported, {
                    list: aiNote.unsupported.map((k) => s.unsupported[k]).join(' · '),
                  })}
                </p>
              ) : null}
            </div>
          ) : null}

          {chips.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label={s.activeFilters}>
              {chips.map((chip) => (
                <span
                  key={chip.id}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border bg-bg py-1 ps-3 pe-1.5 text-xs font-semibold text-ink',
                    chip.soft ? 'border-dashed border-line-strong' : 'border-ink',
                  )}
                >
                  {chip.flip ? (
                    <button
                      type="button"
                      title={chip.soft ? s.makeRequired : s.makePreferred}
                      onClick={() => setForm(chip.flip!)}
                      className="hover:underline"
                    >
                      {chip.label}
                    </button>
                  ) : (
                    chip.label
                  )}
                  <button
                    type="button"
                    aria-label={`${s.removeChip}: ${chip.label}`}
                    onClick={() => setForm(chip.remove)}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-muted hover:bg-surface-sunk hover:text-ink"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={reset}
                className="px-2 text-2xs font-semibold text-muted underline-offset-2 hover:text-ink hover:underline"
              >
                {s.clearFilters}
              </button>
            </div>
          ) : null}

          {/* Manual filters */}
          <div className="mt-3 border-t border-line pt-3">
            <button
              type="button"
              onClick={() => setManualOpen((v) => !v)}
              aria-expanded={manualOpen}
              className="flex w-full items-center justify-between text-xs font-bold text-ink lg:pointer-events-none"
            >
              {s.manualTitle}
              <ChevronDown
                className={cn('h-3.5 w-3.5 transition-transform duration-150 lg:hidden', manualOpen && 'rotate-180')}
              />
            </button>
            <div className={cn('mt-2', !manualOpen && 'max-lg:hidden')}>
              <div className="mb-3">
                <p className="text-xs font-bold text-ink">{s.areaTitle}</p>
                <p className="mb-1.5 text-2xs text-muted">{s.areaHint}</p>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={s.areaTitle}>
                  {TEL_AVIV_AREAS.map((area) => {
                    const on = form.areas.includes(area.name);
                    return (
                      <button
                        key={area.name}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            areas: on ? f.areas.filter((a) => a !== area.name) : [...f.areas, area.name],
                          }))
                        }
                        className={cn(
                          'touch-chip rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-150',
                          on
                            ? 'border-ink bg-ink text-on-ink'
                            : 'border-line bg-bg text-ink-soft hover:border-line-strong hover:text-ink',
                        )}
                      >
                        {area.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {areaStats.length > 0 ? <AreaOverview stats={areaStats} /> : null}

              <div className="flex flex-wrap items-end gap-3">
                {range(s.priceRange, 'minPrice', 'maxPrice', { placeholderLo: '0', placeholderHi: '∞', className: 'w-44' })}
                {range(s.rooms, 'minRooms', 'maxRooms', { placeholderLo: '1', placeholderHi: '12', className: 'w-36' })}
                {range(s.sqmRange, 'minSqm', 'maxSqm', { className: 'w-36' })}

                <Field label={s.moveIn} className="w-40" htmlFor="available-from">
                  <Input
                    id="available-from"
                    title={s.availableFromHint}
                    type="date"
                    dir="ltr"
                    className="num border-signal/60"
                    value={form.availableFrom}
                    onChange={(e) => setForm((f) => ({ ...f, availableFrom: e.target.value }))}
                  />
                </Field>

                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  aria-expanded={advancedOpen}
                  onClick={() => setAdvancedOpen((v) => !v)}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {advancedOpen ? s.advancedHide : s.advanced}
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-150', advancedOpen && 'rotate-180')} />
                </Button>
              </div>

              {advancedOpen ? (
                <div className="mt-4 space-y-3 rounded-[var(--radius-card)] border border-line bg-bg p-3">
                  <div className="flex flex-wrap items-end gap-3">
                    {range(s.floor, 'minFloor', 'maxFloor')}
                    <Field label={s.availableBy} className="w-44" htmlFor="available-by">
                      <Input
                        id="available-by"
                        type="date"
                        dir="ltr"
                        className="num"
                        value={form.availableBy}
                        onChange={(e) => setForm((f) => ({ ...f, availableBy: e.target.value }))}
                      />
                    </Field>
                    <Field label={s.minLeaseMonths} className="w-36" htmlFor="min-lease">
                      <Input
                        id="min-lease"
                        type="number"
                        dir="ltr"
                        className="num"
                        value={form.minLeaseMonths}
                        onChange={(e) => setForm((f) => ({ ...f, minLeaseMonths: e.target.value }))}
                      />
                    </Field>
                  </div>

                  <div>
                    <p className="mb-1.5 text-xs font-bold text-ink">{s.amenitiesLabel}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {AMENITY_FILTERS.map((amenity) => {
                        const required = form.amenities.includes(amenity);
                        const preferred = form.preferred.includes(amenity);
                        return (
                          <button
                            key={amenity}
                            type="button"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                amenities: required
                                  ? f.amenities.filter((a) => a !== amenity)
                                  : [...f.amenities, amenity],
                                preferred: f.preferred.filter((a) => a !== amenity),
                              }))
                            }
                            aria-pressed={required || preferred}
                            className={cn(
                              'touch-chip rounded-full border px-2.5 py-1 text-2xs font-semibold transition-colors duration-150',
                              required
                                ? 'border-ink bg-ink text-on-ink'
                                : preferred
                                  ? 'border-dashed border-ink text-ink'
                                  : 'border-line text-ink-soft hover:border-line-strong',
                            )}
                          >
                            {t.amenity[amenity]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    <label className="flex items-center gap-2 text-xs text-ink-soft">
                      <Checkbox
                        checked={form.includeOccupied}
                        onCheckedChange={(v) => setForm((f) => ({ ...f, includeOccupied: Boolean(v) }))}
                        aria-label={s.showOccupied}
                      />
                      {s.showOccupied}
                    </label>
                    <label className="flex items-center gap-2 text-xs text-ink-soft">
                      <Checkbox
                        checked={form.confirmedOnly}
                        onCheckedChange={(v) => setForm((f) => ({ ...f, confirmedOnly: Boolean(v) }))}
                        aria-label={s.confirmedOnly}
                      />
                      {s.confirmedOnly}
                    </label>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Filters computed from the system's own numbers */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-ink">{s.smartTitle}</span>
            {SMART_PILLS.map((pill) => {
              const on = form.smart.includes(pill.key);
              return (
                <button
                  key={pill.key}
                  type="button"
                  title={pill.hint}
                  aria-pressed={on}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      smart: on ? f.smart.filter((k) => k !== pill.key) : [...f.smart, pill.key],
                    }))
                  }
                  className={cn(
                    'touch-chip rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-150',
                    on ? 'border-ink bg-ink text-on-ink' : 'border-line bg-bg text-ink-soft hover:border-line-strong',
                  )}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Results controls */}
      <div
        style={{ zIndex: 'var(--z-sticky)' }}
        className="sticky top-0 border-b border-line bg-bg/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2 sm:px-6">
          <span className="text-sm text-ink-soft">
            <Num board className="font-extrabold text-ink">
              {visible.length}
            </Num>{' '}
            {s.resultsCount}
            {visible.length !== total ? (
              <span className="text-2xs text-muted">
                {' '}
                · {s.showing} {visible.length} {s.outOf} {total}
              </span>
            ) : null}
          </span>

          <div className="ms-auto flex items-center gap-2">
            <Select value={form.sort} onValueChange={(v) => setForm((f) => ({ ...f, sort: v as IntentSort }))}>
              <SelectTrigger className="h-8 w-44 text-xs" aria-label={s.sortBy}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  ['recommended', 'best_match', 'date', 'price_asc', 'price_desc', 'ppsqm', 'rooms', 'sqm'] as IntentSort[]
                ).map((k) => (
                  <SelectItem key={k} value={k}>
                    {sortLabel[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-0.5 rounded-full border border-line p-0.5">
              {(
                [
                  ['list', Rows3, s.viewList, ''],
                  ['split', Columns2, s.viewSplit, 'max-lg:hidden'],
                  ['map', MapIcon, s.viewMap, ''],
                ] as const
              ).map(([id, Icon, label, hide]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  aria-pressed={view === id}
                  title={label}
                  className={cn(
                    'touch-chip flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors duration-150',
                    view === id ? 'bg-ink text-on-ink' : 'text-muted hover:text-ink',
                    hide,
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="max-sm:sr-only">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {view === 'map' ? (
        <div className="h-[calc(100dvh-8rem)] min-h-96 border-b border-line">{map}</div>
      ) : view === 'split' ? (
        <div className="mx-auto flex max-w-[92rem] flex-col lg:flex-row">
          <div className="min-w-0 px-4 py-4 sm:px-6 lg:w-[46rem] lg:shrink-0">{listing}</div>
          <div className="hidden border-s border-line lg:sticky lg:top-12 lg:block lg:h-[calc(100dvh-3rem)] lg:flex-1">
            {map}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">{listing}</div>
      )}
    </div>
  );
}

function AreaOverview({ stats }: { stats: AreaStats[] }) {
  const s = t.seeker.search;
  return (
    <section aria-label={s.areaOverviewTitle} className="mb-3 rounded-[var(--radius-card)] border border-line bg-bg p-3">
      <p className="text-xs font-bold text-ink">{s.areaOverviewTitle}</p>
      <ul className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {stats.map((st) => (
          <li key={st.area} className="min-w-0">
            <p className="text-sm font-bold text-ink">{st.area}</p>
            {st.units === 0 ? (
              <p className="text-2xs text-muted">{s.areaEmpty}</p>
            ) : (
              <>
                <p className="mt-0.5 text-2xs text-ink-soft">
                  {[
                    fill(s.areaUnits, { n: st.units }),
                    fill(s.areaNow, { n: st.availableNow }),
                    fill(s.areaSoon, { n: st.availableSoon }),
                    fill(s.areaInterested, { n: st.interested }),
                  ].join(' · ')}
                </p>
                {st.medianRentAgorot !== null && st.medianPerSqmAgorot !== null ? (
                  <p className="mt-0.5 text-2xs text-muted">
                    {s.areaMedianRent} <Money agorot={st.medianRentAgorot} board className="font-bold text-ink" />
                    {' · '}
                    {s.areaMedianPerSqm} <Money agorot={st.medianPerSqmAgorot} board className="font-bold text-ink" />
                    {' · '}
                    {fill(s.areaSample, { n: st.units })}
                  </p>
                ) : (
                  <p className="mt-0.5 text-2xs text-muted">
                    {s.areaThin} ({fill(s.areaUnits, { n: st.units })})
                  </p>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
