/**
 * What Miftan costs, and what the work around a rental typically costs.
 *
 * Plans: the numbers match the revenue model in `packages/fixtures/revenue.ts`
 * (₪12 per unit per month, ₪89 per signed digital contract, ₪35 per applicant
 * verification). They are the working assumption, not a decided price — see
 * PLAN.md, "Pricing decision". Changing a price means changing it here and in
 * the revenue model together.
 *
 * Service guide: average price ranges published by Midrag
 * (midrag.co.il/Content/MainPriceList) for the jobs a landlord actually pays
 * for. Shown so an owner can tell a fair quote from a bad one — attributed on
 * the page, and never presented as Miftan's own price.
 */

export type PlanId = 'free' | 'pro' | 'office';

export interface PlanPrice {
  id: PlanId;
  /** ₪ per unit per month; null = free or quoted */
  perUnitMonthly: number | null;
  /** Up to how many units the plan covers; null = unlimited */
  maxUnits: number | null;
  highlighted: boolean;
}

export const OWNER_PLANS: PlanPrice[] = [
  { id: 'free', perUnitMonthly: null, maxUnits: 2, highlighted: false },
  { id: 'pro', perUnitMonthly: 12, maxUnits: null, highlighted: true },
  { id: 'office', perUnitMonthly: null, maxUnits: null, highlighted: false },
];

export type AddOnId = 'contract' | 'verification';
export const ADD_ONS: Array<{ id: AddOnId; price: number }> = [
  { id: 'contract', price: 89 },
  { id: 'verification', price: 35 },
];

export type ServiceId =
  | 'plumberVisit'
  | 'drainKitchen'
  | 'electricianVisit'
  | 'acClean'
  | 'acGas'
  | 'boilerElement'
  | 'lockDoor'
  | 'pestFlat'
  | 'paint3Empty'
  | 'paint4Empty'
  | 'movingClean4'
  | 'sofa3'
  | 'inspection3'
  | 'moving1'
  | 'moving3';

/** ₪ ranges, as published. `min === max` where only an average is given. */
export const SERVICE_PRICES: Array<{ id: ServiceId; min: number; max: number }> = [
  { id: 'plumberVisit', min: 263, max: 340 },
  { id: 'drainKitchen', min: 349, max: 494 },
  { id: 'electricianVisit', min: 293, max: 380 },
  { id: 'acClean', min: 360, max: 549 },
  { id: 'acGas', min: 481, max: 864 },
  { id: 'boilerElement', min: 361, max: 447 },
  { id: 'lockDoor', min: 295, max: 401 },
  { id: 'pestFlat', min: 333, max: 439 },
  { id: 'paint3Empty', min: 3532, max: 5328 },
  { id: 'paint4Empty', min: 4442, max: 6544 },
  { id: 'movingClean4', min: 2295, max: 3505 },
  { id: 'sofa3', min: 333, max: 448 },
  { id: 'inspection3', min: 1379, max: 1769 },
  { id: 'moving1', min: 907, max: 907 },
  { id: 'moving3', min: 2307, max: 2307 },
];

export const SERVICE_PRICES_SOURCE = 'https://www.midrag.co.il/Content/MainPriceList';

/**
 * The revenue lens, grounded in the market.
 *
 * For each earning point that sits on top of a real job, what that job costs
 * the owner at market rates (the Midrag ranges above) and what Miftan's cut
 * would be under the stream's terms in the revenue model. Streams with no
 * published market price (insurance, legal listing, the subscription) are
 * left out rather than guessed.
 */
export interface StreamMarket {
  services: ServiceId[];
  /** Commission as a share of the job, 0–1 */
  cutShare?: number;
  /** Or a fixed ₪ amount per closed job */
  cutFixed?: number;
}

export const STREAM_MARKET: Record<string, StreamMarket> = {
  'rs-vendor': { services: ['plumberVisit', 'drainKitchen', 'electricianVisit', 'lockDoor', 'boilerElement', 'acGas'], cutShare: 0.12 },
  'rs-seasonal': { services: ['acClean'], cutFixed: 85 },
  'rs-paint': { services: ['paint3Empty', 'paint4Empty'], cutShare: 0.1 },
  'rs-sofa': { services: ['sofa3'], cutFixed: 60 },
  'rs-moving': { services: ['moving1', 'moving3'], cutFixed: 180 },
};

/** Market range and cut range for a stream, or null when there is no market data. */
export function marketFor(streamId: string): { min: number; max: number; cutMin: number; cutMax: number } | null {
  const market = STREAM_MARKET[streamId];
  if (!market) return null;
  const rows = SERVICE_PRICES.filter((p) => market.services.includes(p.id));
  if (rows.length === 0) return null;
  const min = Math.min(...rows.map((r) => r.min));
  const max = Math.max(...rows.map((r) => r.max));
  if (market.cutShare !== undefined) {
    return { min, max, cutMin: Math.round(min * market.cutShare), cutMax: Math.round(max * market.cutShare) };
  }
  const fixed = market.cutFixed ?? 0;
  return { min, max, cutMin: fixed, cutMax: fixed };
}
