import * as React from 'react';
import {
  formatAgorot,
  formatFloor,
  formatRooms,
  formatSqm,
  t,
  type ListingInsight,
  type MatchResult,
  type ReasonKey,
  type SearchResult,
} from '@miftan/shared';
import { AvailabilityChip } from '@/components/shared/status';
import { Money, Num } from '@/components/shared/typography';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ltr } from './search-state';
import {
  Check,
  ChevronDown,
  Info,
  MessageCircleQuestion,
  Scale,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';

export interface EnrichedResult {
  row: SearchResult;
  insight: ListingInsight | null;
  match: MatchResult;
  reasons: ReasonKey[];
}

const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), template);

const REASON_LABEL: Record<ReasonKey, string> = {
  below: t.seeker.search.reasonBelow,
  now: t.seeker.search.reasonNow,
  soon: t.seeker.search.reasonSoon,
  low: t.seeker.search.reasonLow,
  match: t.seeker.search.reasonMatch,
};

function basisText(row: SearchResult, insight: ListingInsight): string {
  const s = t.seeker.search;
  const where =
    insight.basis === 'area_rooms'
      ? fill(s.basisAreaRooms, { area: insight.area, rooms: row.rooms })
      : insight.basis === 'area'
        ? fill(s.basisAreaAll, { area: insight.area })
        : insight.basis === 'city_rooms'
          ? fill(s.basisTelAviv, { rooms: row.rooms })
          : fill(s.basisTelAvivNear, { min: Math.max(1, row.rooms - 1), max: row.rooms + 1 });
  return fill(s.basedOn, { count: insight.peers, where });
}

/** Names the area when the comparison is against the area itself, so the claim is exactly as narrow as its evidence. */
function verdictText(insight: ListingInsight): string {
  const s = t.seeker.search;
  const amount = ltr(formatAgorot(Math.abs(insight.rentDiffAgorot)));
  const inArea = insight.basis === 'area_rooms' || insight.basis === 'area';
  if (insight.verdict === 'typical') return inArea ? fill(s.typicalArea, { area: insight.area }) : s.typical;
  if (insight.verdict === 'below')
    return inArea ? fill(s.belowByArea, { amount, area: insight.area }) : fill(s.belowBy, { amount });
  return inArea ? fill(s.aboveByArea, { amount, area: insight.area }) : fill(s.aboveBy, { amount });
}

export function ResultCard({
  item,
  active,
  queued,
  asked,
  showMatch,
  onHover,
  onOpen,
  onSimilar,
}: {
  item: EnrichedResult;
  active: boolean;
  queued: boolean;
  asked: boolean;
  showMatch: boolean;
  onHover: () => void;
  onOpen: () => void;
  onSimilar: () => void;
}) {
  const { row, insight, match, reasons } = item;
  const s = t.seeker.search;
  const [open, setOpen] = React.useState(false);
  const askable = row.availability.askable && !asked;
  const shownAmenities = row.amenities.slice(0, 4);

  return (
    <li
      onMouseEnter={onHover}
      className={cn(
        'rounded-[var(--radius-card)] border transition-colors duration-150',
        active ? 'border-ink bg-surface' : 'border-line hover:border-line-strong',
      )}
    >
      <button
        type="button"
        onFocus={onHover}
        onClick={onOpen}
        className="flex w-full flex-col gap-2 p-2.5 text-start"
      >
        <span className="flex w-full gap-3">
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
                  {row.street}
                  {row.houseNumber ? ` ${row.houseNumber}` : ''}
                </span>
                <span className="block truncate text-2xs text-muted">
                  {row.neighborhood} · {row.city}
                </span>
              </span>
              <Money agorot={row.monthlyRentAgorot} board className="shrink-0 text-base font-bold text-ink" />
            </span>

            <span className="mt-1.5 block text-2xs text-muted">
              {formatRooms(row.rooms)} · {formatSqm(row.sqm)} · {formatFloor(row.floor, row.totalFloors)}
              {shownAmenities.length > 0
                ? ` · ${shownAmenities.map((a) => t.amenity[a as keyof typeof t.amenity] ?? a).join(' · ')}`
                : ''}
            </span>
          </span>
        </span>

        {/* Below the photo row rather than beside it: a dated chip with its
            countdown is wider than the text column on a phone. */}
        <span className="flex w-full flex-wrap items-center gap-1.5">
          <AvailabilityChip
            kind={row.availability.kind}
            date={row.availability.date ?? undefined}
            confidence={row.availability.confidence}
            size="sm"
            withCountdown
          />
          {row.queueLength > 0 ? (
            <Badge tone="outline" size="sm">
              <Users className="h-3 w-3" />
              <Num board>{row.queueLength}</Num> {s.inQueue}
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
      </button>

      <div className="mx-2.5 mb-2.5 rounded-[8px] bg-surface-sunk">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 px-2.5 py-1.5 text-start"
        >
          <Scale className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
          <span className="min-w-0 flex-1 text-2xs text-ink-soft">
            {insight ? (
              <>
                <span className="inline-flex items-center gap-1 font-bold text-ink">
                  {insight.verdict === 'below' ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : insight.verdict === 'above' ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : null}
                  {verdictText(insight)}
                </span>
                <span className="text-muted">
                  {' · '}
                  {fill(s.perSqm, {
                    value: ltr(formatAgorot(insight.perSqmAgorot)),
                    median: ltr(formatAgorot(insight.medianPerSqmAgorot)),
                  })}
                </span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1 text-muted">
                <Info className="h-3 w-3" />
                {s.notEnough}
              </span>
            )}
          </span>
          {showMatch && match.total >= 2 ? (
            <Badge tone={match.met === match.total ? 'neutral' : 'outline'} size="sm" className="shrink-0">
              {match.met === match.total ? <Check className="h-3 w-3" /> : null}
              <Num board>
                {match.met}/{match.total}
              </Num>
            </Badge>
          ) : null}
          <ChevronDown
            className={cn('h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-150', open && 'rotate-180')}
            aria-hidden
          />
          <span className="sr-only">{open ? s.lessDetails : s.details}</span>
        </button>

        {open ? (
          <div className="space-y-2.5 border-t border-line px-2.5 py-2.5 text-2xs text-ink-soft">
            {insight ? (
              <p>
                {basisText(row, insight)}.
              </p>
            ) : (
              <p className="text-muted">{s.notEnough}</p>
            )}

            {showMatch && match.total >= 2 ? (
              <p>
                <span className="font-bold text-ink">
                  {fill(s.matchOf, { met: match.met, total: match.total })}
                </span>
                {match.missed.length > 0 ? (
                  <span className="text-muted"> · {fill(s.matchMissed, { list: match.missed.join(', ') })}</span>
                ) : null}
              </p>
            ) : null}

            {reasons.length > 0 ? (
              <div>
                <p className="mb-1 font-bold text-ink">{s.whyRecommended}</p>
                <ul className="flex flex-wrap gap-1.5">
                  {reasons.map((r) => (
                    <li key={r}>
                      <Badge tone="outline" size="sm">
                        {REASON_LABEL[r]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {insight && insight.similar.length > 0 ? (
              <div>
                <p className="mb-1 font-bold text-ink">{s.similarInMarket}</p>
                <ul className="space-y-0.5">
                  {insight.similar.map((sim) => (
                    <li key={sim.id} className="flex items-center gap-2">
                      <Money agorot={sim.monthlyRentAgorot} board className="font-bold text-ink" />
                      <span className="text-muted">
                        {fill(sim.diffAgorot < 0 ? s.similarCheaper : s.similarDearer, {
                          amount: ltr(formatAgorot(Math.abs(sim.diffAgorot))),
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
              <button
                type="button"
                onClick={onSimilar}
                className="font-bold text-ink underline underline-offset-2 hover:text-ink-soft"
              >
                {s.findSimilar}
              </button>
              <span className="text-muted">{s.footnote}</span>
            </div>
          </div>
        ) : null}
      </div>
    </li>
  );
}
