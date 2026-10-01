import { t } from '../i18n/he';
import type { SearchResult } from '../api/search';
import type { Amenity } from '../types';
import { MIN_AREA_STATS_SAMPLE, median, type ListingInsight } from './search-insight';
import type { SmartFilter } from './search-intent';

/**
 * What a listing is scored on, and why.
 *
 * The score exists to order a list, and every point of it is traceable to a
 * fact we hold: the price per m² against comparable units, when the apartment
 * frees up, how many people are already queueing, and how many of the seeker's
 * own criteria it meets. `reasons` is that trace, in words — a ranking that
 * cannot explain itself should not be shown.
 */

export interface Criteria {
  /** Any of these areas satisfies the criterion */
  areas: string[];
  minRooms?: number;
  maxRooms?: number;
  minSqm?: number;
  maxSqm?: number;
  minPrice?: number;
  maxPrice?: number;
  minFloor?: number;
  maxFloor?: number;
  availableFrom?: string;
  availableBy?: string;
  required: Amenity[];
  preferred: Amenity[];
  smart: SmartFilter[];
}

export interface MatchResult {
  met: number;
  total: number;
  missed: string[];
}

export type ReasonKey = 'below' | 'now' | 'soon' | 'low' | 'match';

const DAY = 86_400_000;
const SOON_DAYS = 30;
const LOW_COMPETITION_QUEUE = 1;

function inRange(value: number, min?: number, max?: number): boolean {
  return (min === undefined || value >= min) && (max === undefined || value <= max);
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isSoon(row: SearchResult, now: Date): boolean {
  if (row.availability.kind === 'now') return true;
  const date = row.availability.date;
  return Boolean(date) && date! <= isoOf(new Date(now.getTime() + SOON_DAYS * DAY));
}

export function isLowCompetition(row: SearchResult): boolean {
  return row.queueLength <= LOW_COMPETITION_QUEUE;
}

/** True when the listing passes a smart filter. Unknown counts as "no". */
export function passesSmart(
  row: SearchResult,
  insight: ListingInsight | null,
  filters: SmartFilter[],
  now: Date,
): boolean {
  return filters.every((f) =>
    f === 'below_market'
      ? insight?.verdict === 'below'
      : f === 'soon'
        ? isSoon(row, now)
        : isLowCompetition(row),
  );
}

export function evaluateMatch(
  row: SearchResult,
  c: Criteria,
  insight: ListingInsight | null,
  now: Date,
): MatchResult {
  const checks: [string, boolean][] = [];
  const price = row.monthlyRentAgorot / 100;
  const crit = t.seeker.search.criteria;

  if (c.areas.length) checks.push([crit.area, c.areas.includes(row.neighborhood)]);
  if (c.minRooms !== undefined || c.maxRooms !== undefined)
    checks.push([crit.rooms, inRange(row.rooms, c.minRooms, c.maxRooms)]);
  if (c.minPrice !== undefined || c.maxPrice !== undefined)
    checks.push([crit.price, inRange(price, c.minPrice, c.maxPrice)]);
  if (c.minSqm !== undefined || c.maxSqm !== undefined)
    checks.push([crit.sqm, inRange(row.sqm, c.minSqm, c.maxSqm)]);
  if (c.minFloor !== undefined || c.maxFloor !== undefined)
    checks.push([crit.floor, inRange(row.floor, c.minFloor, c.maxFloor)]);
  if (c.availableFrom || c.availableBy) {
    const date = row.availability.date;
    const ok = date
      ? (!c.availableFrom || date >= c.availableFrom) && (!c.availableBy || date <= c.availableBy)
      : row.availability.kind === 'now';
    checks.push([crit.date, ok]);
  }
  for (const a of c.required) checks.push([t.amenity[a], row.amenities.includes(a)]);
  for (const a of c.preferred) checks.push([t.amenity[a], row.amenities.includes(a)]);
  for (const f of c.smart) checks.push([crit[f], passesSmart(row, insight, [f], now)]);

  return {
    met: checks.filter(([, ok]) => ok).length,
    total: checks.length,
    missed: checks.filter(([, ok]) => !ok).map(([label]) => label),
  };
}

export function recommendedScore(
  row: SearchResult,
  insight: ListingInsight | null,
  match: MatchResult,
  now: Date,
): { score: number; reasons: ReasonKey[] } {
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

  const value = insight ? (clamp(-insight.perSqmDiffPct, -0.2, 0.2) + 0.2) / 0.4 : 0.5;

  const days = row.availability.date
    ? (new Date(`${row.availability.date}T00:00:00`).getTime() - now.getTime()) / DAY
    : null;
  const timing =
    row.availability.kind === 'now'
      ? 1
      : row.availability.kind === 'dated' && days !== null
        ? Math.max(0.3, 1 - Math.max(0, days) / 180 * 0.7)
        : row.availability.kind === 'extending'
          ? 0.1
          : 0.2;

  const competition = 1 / (1 + row.queueLength);
  const fit = match.total > 0 ? match.met / match.total : null;

  const score =
    fit === null
      ? 0.45 * value + 0.3 * timing + 0.25 * competition
      : 0.4 * fit + 0.3 * value + 0.2 * timing + 0.1 * competition;

  const reasons: ReasonKey[] = [];
  if (fit !== null && match.total >= 2 && match.met === match.total) reasons.push('match');
  if (insight?.verdict === 'below') reasons.push('below');
  if (row.availability.kind === 'now') reasons.push('now');
  else if (isSoon(row, now)) reasons.push('soon');
  if (isLowCompetition(row)) reasons.push('low');

  return { score, reasons };
}

/* ── The area view ─────────────────────────────────────── */

export interface AreaStats {
  area: string;
  /** Units listed in the area, occupied ones included */
  units: number;
  availableNow: number;
  /** Free within the next 30 days, not counting the ones free today */
  availableSoon: number;
  /** People currently queueing across the area's units — a count, never a place in line */
  interested: number;
  /** Withheld (null) below MIN_AREA_STATS_SAMPLE units; the count above is always shown */
  medianRentAgorot: number | null;
  medianPerSqmAgorot: number | null;
}

export function computeAreaStats(universe: SearchResult[], area: string, now: Date): AreaStats {
  const inArea = universe.filter((u) => u.neighborhood === area);
  const enough = inArea.length >= MIN_AREA_STATS_SAMPLE;
  return {
    area,
    units: inArea.length,
    availableNow: inArea.filter((u) => u.availability.kind === 'now').length,
    availableSoon: inArea.filter((u) => u.availability.kind !== 'now' && isSoon(u, now)).length,
    interested: inArea.reduce((n, u) => n + u.queueLength, 0),
    medianRentAgorot: enough ? Math.round(median(inArea.map((u) => u.monthlyRentAgorot))) : null,
    medianPerSqmAgorot: enough
      ? Math.round(median(inArea.filter((u) => u.sqm > 0).map((u) => u.monthlyRentAgorot / u.sqm)))
      : null,
  };
}
