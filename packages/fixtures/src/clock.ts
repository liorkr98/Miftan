/**
 * The demo is anchored to whatever "today" is when it boots, so lease
 * timelines, ticket ages and queue dates stay alive no matter when
 * someone opens it. Seed data is written as offsets from this date.
 */

export const DEMO_TODAY = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
})();

const DAY = 86_400_000;

export function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * DAY);
}

/**
 * Add months, clamping to the end of the target month rather than rolling over.
 *
 * `setMonth` alone overflows: 29 January minus one month asks for 29 February,
 * which in a non-leap year silently becomes 1 March. That produced a rent roll
 * with no February in it and two Marches — invisible in a chart that aggregates
 * by month, and a duplicate-key error the moment it hit a real database.
 */
export function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDayOfTarget = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDayOfTarget));
  return d;
}

export function addHours(base: Date, hours: number): Date {
  return new Date(base.getTime() + hours * 3_600_000);
}

/** yyyy-MM-dd */
export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Full ISO datetime */
export function isoAt(d: Date): string {
  return d.toISOString();
}

/** n months from today, snapped to a plausible day of month */
export function monthsOut(months: number, day = 1): string {
  const d = addMonths(DEMO_TODAY, months);
  d.setDate(Math.min(day, 28));
  return isoDate(d);
}

/** n days from today (negative = past) */
export function daysOut(days: number): string {
  return isoDate(addDays(DEMO_TODAY, days));
}

/** n hours ago, as a full timestamp */
export function hoursAgo(hours: number): string {
  return isoAt(addHours(new Date(), -hours));
}

export function daysAgo(days: number): string {
  return isoAt(addDays(new Date(), -days));
}

/** A future datetime at a given hour, n days out */
export function slotAt(days: number, hour: number): string {
  const d = addDays(DEMO_TODAY, days);
  d.setHours(hour, 0, 0, 0);
  return isoAt(d);
}

/** yyyy-MM for rent-roll months */
export function monthKey(offset: number): string {
  const d = addMonths(DEMO_TODAY, offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Stable photo URLs so reloads don't reshuffle the demo */
export function photo(seed: string, w = 800, h = 600): string {
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
}
