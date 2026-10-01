/**
 * Market insight for one listing, computed from the listings we hold.
 *
 * Nothing here is an estimate from outside data. The comparison set is the
 * other apartments in Miftan, the figure is their median asking rent, and the
 * sample size travels with every number so the UI can say what it rests on.
 * When the sample is too thin the answer is `null`, not a softer guess — the
 * same rule the /market endpoint applies.
 */

/**
 * A verdict ("below average") needs the unit plus at least three others.
 * Below that the answer is "not enough to compare", never a softer guess.
 */
export const MIN_COMPARABLE_SAMPLE = 4;

/** A plain area summary (count, median) is descriptive rather than a verdict, so it can rest on fewer. */
export const MIN_AREA_STATS_SAMPLE = 3;

/** Within ±this share of the peer median per m², a price is "typical". */
export const TYPICAL_BAND = 0.07;

export interface Comparable {
  id: string;
  city: string;
  neighborhood: string;
  rooms: number;
  sqm: number;
  monthlyRentAgorot: number;
}

export type PriceVerdict = 'below' | 'typical' | 'above';

/** How the peer group was chosen, narrowest first. */
export type ComparisonBasis = 'area_rooms' | 'area' | 'city_rooms' | 'city_near_rooms';

export interface SimilarUnit {
  id: string;
  monthlyRentAgorot: number;
  /** Positive when this unit is dearer than the one being viewed */
  diffAgorot: number;
}

export interface ListingInsight {
  basis: ComparisonBasis;
  /** The Tel Aviv area the listing is in — named in the text when the basis is the area */
  area: string;
  /** Peer units, not counting the listing itself */
  peers: number;
  medianRentAgorot: number;
  medianPerSqmAgorot: number;
  perSqmAgorot: number;
  /** Rent minus the peer median. Negative is cheaper. */
  rentDiffAgorot: number;
  rentDiffPct: number;
  perSqmDiffPct: number;
  verdict: PriceVerdict;
  /** The three closest in price, for the "similar apartments" disclosure */
  similar: SimilarUnit[];
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function peerGroups(unit: Comparable, universe: Comparable[]) {
  const others = universe.filter((u) => u.id !== unit.id && u.sqm > 0);
  const inArea = others.filter((u) => u.neighborhood === unit.neighborhood);
  return [
    { basis: 'area_rooms' as const, peers: inArea.filter((u) => u.rooms === unit.rooms) },
    /* The whole area, any size — fair because the verdict is per m². */
    { basis: 'area' as const, peers: inArea },
    { basis: 'city_rooms' as const, peers: others.filter((u) => u.rooms === unit.rooms) },
    { basis: 'city_near_rooms' as const, peers: others.filter((u) => Math.abs(u.rooms - unit.rooms) <= 1) },
  ];
}

/**
 * The verdict is made on rent per m², not on rent: a 90 m² flat and a 55 m²
 * flat with the same room count should not be judged against each other on
 * total rent.
 */
export function computeInsight(unit: Comparable, universe: Comparable[]): ListingInsight | null {
  if (unit.sqm <= 0) return null;
  const group = peerGroups(unit, universe).find((g) => g.peers.length + 1 >= MIN_COMPARABLE_SAMPLE);
  if (!group) return null;

  const perSqm = unit.monthlyRentAgorot / unit.sqm;
  const medianPerSqm = median(group.peers.map((p) => p.monthlyRentAgorot / p.sqm));
  const medianRent = median(group.peers.map((p) => p.monthlyRentAgorot));
  if (medianPerSqm <= 0 || medianRent <= 0) return null;

  const perSqmDiffPct = (perSqm - medianPerSqm) / medianPerSqm;
  const verdict: PriceVerdict =
    perSqmDiffPct <= -TYPICAL_BAND ? 'below' : perSqmDiffPct >= TYPICAL_BAND ? 'above' : 'typical';

  const similar = [...group.peers]
    .sort(
      (a, b) =>
        Math.abs(a.monthlyRentAgorot - unit.monthlyRentAgorot) -
        Math.abs(b.monthlyRentAgorot - unit.monthlyRentAgorot),
    )
    .slice(0, 3)
    .map((p) => ({
      id: p.id,
      monthlyRentAgorot: p.monthlyRentAgorot,
      diffAgorot: p.monthlyRentAgorot - unit.monthlyRentAgorot,
    }));

  return {
    basis: group.basis,
    area: unit.neighborhood,
    peers: group.peers.length,
    medianRentAgorot: Math.round(medianRent),
    medianPerSqmAgorot: Math.round(medianPerSqm),
    perSqmAgorot: Math.round(perSqm),
    rentDiffAgorot: Math.round(unit.monthlyRentAgorot - medianRent),
    rentDiffPct: (unit.monthlyRentAgorot - medianRent) / medianRent,
    perSqmDiffPct,
    verdict,
    similar,
  };
}
