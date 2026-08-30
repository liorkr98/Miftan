import { daysUntil, deriveAvailability, leadScore, type AvailabilityKind, type Expense, type Lead, type Lease, type Property, type RentPayment, type ScreeningPreset, type Ticket, type TrackRow } from '@miftach/shared';
import { parseISO, subDays } from 'date-fns';

/* ── Availability, the product's central idea ──────────── */

/**
 * Re-exported from the shared package so the UI and the API cannot disagree
 * about what an apartment's status means. The whole product rests on that
 * answer being the same on both sides of the wire.
 */
export type { AvailabilityKind };

export function availabilityKind(property: Property, lease?: Lease): AvailabilityKind {
  return deriveAvailability({
    status: property.status,
    availableFrom: property.available_from ?? null,
    confidence: property.availability_confidence,
    renewalIntent: lease?.renewal_intent ?? null,
  }).kind;
}

export const AVAILABILITY_TONE: Record<AvailabilityKind, TrackRow['tone']> = {
  now: 'open',
  dated: 'signal',
  extending: 'live',
  unknown: 'muted',
};

/* ── Lookups ───────────────────────────────────────────── */

export const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));

export function leaseForProperty(leases: Lease[], propertyId: string): Lease | undefined {
  return leases.find((l) => l.property_id === propertyId);
}

/* ── Portfolio stats ───────────────────────────────────── */

export interface PortfolioStats {
  total: number;
  occupied: number;
  vacant: number;
  vacating: number;
  renovating: number;
  expiring90: number;
  occupancyRate: number;
  expectedThisMonth: number;
  collectedThisMonth: number;
  collectionRate: number;
  openTickets: number;
  urgentTickets: number;
  maintenanceYtd: number;
}

export function portfolioStats(
  properties: Property[],
  leases: Lease[],
  tickets: Ticket[],
  payments: RentPayment[],
  expenses: Expense[],
): PortfolioStats {
  const total = properties.length;
  const count = (s: Property['status']) => properties.filter((p) => p.status === s).length;

  const expiring90 = leases.filter((l) => {
    const d = daysUntil(l.end_date);
    return d >= 0 && d <= 90;
  }).length;

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthRows = payments.filter((p) => p.month === thisMonth);
  const expectedThisMonth = monthRows.reduce((sum, p) => sum + p.due, 0);
  const collectedThisMonth = monthRows.reduce((sum, p) => sum + p.paid, 0);

  const open = tickets.filter((tk) => tk.status !== 'closed');
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const maintenanceYtd = expenses
    .filter((e) => e.date >= yearStart && e.kind === 'maintenance')
    .reduce((sum, e) => sum + e.amount, 0);

  const occupied = count('occupied') + count('vacating');

  return {
    total,
    occupied: count('occupied'),
    vacant: count('vacant'),
    vacating: count('vacating'),
    renovating: count('renovating'),
    expiring90,
    occupancyRate: total ? (occupied / total) * 100 : 0,
    expectedThisMonth,
    collectedThisMonth,
    collectionRate: expectedThisMonth ? (collectedThisMonth / expectedThisMonth) * 100 : 100,
    openTickets: open.length,
    urgentTickets: open.filter((tk) => tk.severity === 'urgent').length,
    maintenanceYtd,
  };
}

/* ── The departures board ──────────────────────────────── */

export function portfolioTrackRows(properties: Property[], leases: Lease[]): TrackRow[] {
  const rows: TrackRow[] = [];

  for (const property of properties) {
    const lease = leaseForProperty(leases, property.id);
    const label = `${property.address.street} ${property.address.number}`;
    const kind = availabilityKind(property, lease);

    if (!lease) {
      rows.push({
        id: property.id,
        property_id: property.id,
        label,
        sublabel: property.address.neighborhood,
        from: new Date().toISOString().slice(0, 10),
        until: property.status === 'renovating' ? property.available_from : undefined,
        tone: property.status === 'renovating' ? 'live' : 'open',
        confidence: property.availability_confidence,
        meta: String(property.monthly_rent),
      });
      continue;
    }

    const marks: TrackRow['marks'] = [];
    const decision = subDays(parseISO(lease.end_date), lease.notice_period_days);
    if (decision > new Date()) {
      marks.push({ at: decision.toISOString().slice(0, 10), kind: 'decision', label: '' });
    }

    rows.push({
      id: lease.id,
      property_id: property.id,
      label,
      sublabel: property.address.neighborhood,
      from: new Date().toISOString().slice(0, 10),
      until: lease.end_date,
      tone: AVAILABILITY_TONE[kind],
      confidence: property.availability_confidence,
      meta: String(lease.monthly_rent),
      marks,
    });
  }

  return rows.sort((a, b) => {
    if (!a.until) return 1;
    if (!b.until) return -1;
    return a.until.localeCompare(b.until);
  });
}

/* ── Tickets ───────────────────────────────────────────── */

export const OPEN_TICKET_STATUSES: Ticket['status'][] = [
  'new',
  'approved',
  'assigned',
  'in_progress',
  'awaiting_receipt',
];

export function ticketsForProperty(tickets: Ticket[], propertyId: string): Ticket[] {
  return tickets
    .filter((tk) => tk.property_id === propertyId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/* ── Leads ─────────────────────────────────────────────── */

export interface ScoredLead extends Lead {
  score: number;
  failedFlags: number;
}

export function scoreLeads(leads: Lead[], preset?: ScreeningPreset): ScoredLead[] {
  const criteria = preset?.criteria ?? [];
  return leads.map((lead) => ({
    ...lead,
    score: leadScore(lead.screening_flags, criteria),
    failedFlags: lead.screening_flags.filter((f) => !f.passed).length,
  }));
}

export function leadsForProperty(leads: Lead[], propertyId: string): Lead[] {
  return leads
    .filter((l) => l.property_id === propertyId)
    .sort((a, b) => a.queue_position - b.queue_position);
}

/* ── Money ─────────────────────────────────────────────── */

export interface MonthRollup {
  month: string;
  due: number;
  paid: number;
}

export function rentByMonth(payments: RentPayment[], months = 12): MonthRollup[] {
  const map = new Map<string, MonthRollup>();
  for (const p of payments) {
    const row = map.get(p.month) ?? { month: p.month, due: 0, paid: 0 };
    row.due += p.due;
    row.paid += p.paid;
    map.set(p.month, row);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-months);
}

export function expensesByCategory(expenses: Expense[]): { key: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const e of expenses) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  return [...map.entries()]
    .map(([key, amount]) => ({ key, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function expensesByUnit(
  expenses: Expense[],
  properties: Property[],
): { property: Property; amount: number }[] {
  const map = new Map<string, number>();
  for (const e of expenses) map.set(e.property_id, (map.get(e.property_id) ?? 0) + e.amount);
  return properties
    .map((property) => ({ property, amount: map.get(property.id) ?? 0 }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

/* ── Rent comparison ───────────────────────────────────── */

export interface Comparable {
  property: Property;
  rent: number;
}

export interface RentComparison {
  comparables: Comparable[];
  median: number;
  position: 'above' | 'below' | 'at';
}

/** Similar units are same neighbourhood, ±0.5 rooms. Small n is normal here —
 *  the UI says so rather than inventing a market average. */
export function rentComparison(
  property: Property,
  properties: Property[],
  proposed: number,
): RentComparison | null {
  const comparables = properties
    .filter(
      (p) =>
        p.id !== property.id &&
        p.address.neighborhood === property.address.neighborhood &&
        Math.abs(p.rooms - property.rooms) <= 0.5,
    )
    .map((p) => ({ property: p, rent: p.monthly_rent }))
    .sort((a, b) => a.rent - b.rent);

  if (comparables.length < 2) return null;

  const mid = Math.floor(comparables.length / 2);
  const median =
    comparables.length % 2 === 0
      ? Math.round((comparables[mid - 1].rent + comparables[mid].rent) / 2)
      : comparables[mid].rent;

  const delta = proposed - median;
  return {
    comparables,
    median,
    position: Math.abs(delta) < median * 0.03 ? 'at' : delta > 0 ? 'above' : 'below',
  };
}
