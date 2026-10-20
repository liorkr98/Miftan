import { and, eq, gte, isNull } from 'drizzle-orm';
import { ApiError, israelToday } from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';

/**
 * Who is asking, and what they hold.
 *
 * Resolved once per request and passed to every projection. Membership is a
 * set lookup rather than a query per row, so a list of 200 properties does not
 * become 200 authorization round trips.
 */
export interface Viewer {
  userId: string;
  ownedPropertyIds: ReadonlySet<string>;
  /** Properties where this user is the tenant on a lease that has not ended */
  tenantPropertyIds: ReadonlySet<string>;
  /**
   * For each of those properties, the dates this user rents it — the span
   * from their earliest current lease to their latest. A flat outlives its
   * tenants: what happened there before this person moved in, or after they
   * leave, belongs to someone else.
   */
  tenantWindows: ReadonlyMap<string, TenantWindow>;
}

export interface TenantWindow {
  /** yyyy-MM-dd */
  startDate: string;
  endDate: string;
}

/** Nobody signed in. Sees exactly what a stranger on the internet may see. */
export const ANONYMOUS: Viewer = {
  userId: '',
  ownedPropertyIds: new Set(),
  tenantPropertyIds: new Set(),
  tenantWindows: new Map(),
};

export async function resolveViewer(userId: string): Promise<Viewer> {
  const today = israelToday();

  const [owned, tenanted] = await Promise.all([
    db
      .select({ id: s.properties.id })
      .from(s.properties)
      .where(and(eq(s.properties.ownerId, userId), isNull(s.properties.deletedAt))),
    db
      .select({ id: s.leases.propertyId, startDate: s.leases.startDate, endDate: s.leases.endDate })
      .from(s.leases)
      .where(
        and(
          eq(s.leases.tenantId, userId),
          isNull(s.leases.deletedAt),
          gte(s.leases.endDate, today),
        ),
      ),
  ]);

  const tenantWindows = new Map<string, TenantWindow>();
  for (const row of tenanted) {
    const current = tenantWindows.get(row.id);
    tenantWindows.set(row.id, {
      startDate: current && current.startDate < row.startDate ? current.startDate : row.startDate,
      endDate: current && current.endDate > row.endDate ? current.endDate : row.endDate,
    });
  }

  return {
    userId,
    ownedPropertyIds: new Set(owned.map((r) => r.id)),
    tenantPropertyIds: new Set(tenanted.map((r) => r.id)),
    tenantWindows,
  };
}

/** A tenant whose lease has already begun, as opposed to one moving in later. */
export function isCurrentTenant(viewer: Viewer, propertyId: string, today: string = israelToday()): boolean {
  const window = viewer.tenantWindows.get(propertyId);
  return Boolean(window && window.startDate <= today);
}

/**
 * Whether a tenant may see a ticket on the flat they rent. HUMAN REVIEW.
 *
 * Their own reports, always. Work the owner logged, only if it was logged
 * while this person rents the flat. Another tenant's report, never — the
 * previous tenant's leak, and whoever reported it, are not the next
 * tenant's business, and the reverse holds for a tenant still living there
 * while their successor is invited.
 */
export function tenantMaySeeTicket(
  viewer: Viewer,
  ticket: { propertyId: string; tenantId: string | null; createdAt: Date },
): boolean {
  if (ticket.tenantId === viewer.userId) return true;
  if (ticket.tenantId !== null) return false;
  const window = viewer.tenantWindows.get(ticket.propertyId);
  if (!window) return false;
  const created = israelToday(ticket.createdAt);
  return created >= window.startDate && created <= window.endDate;
}

/**
 * What this viewer is, *for this property*.
 *
 * Deliberately per-property rather than per-user: the same person is the owner
 * of number 55, the tenant of number 12 and a stranger to everything else, and
 * a single global role would get all three wrong.
 */
export type Scope = 'owner' | 'tenant' | 'public';

export function scopeFor(viewer: Viewer, propertyId: string): Scope {
  if (viewer.ownedPropertyIds.has(propertyId)) return 'owner';
  if (viewer.tenantPropertyIds.has(propertyId)) return 'tenant';
  return 'public';
}

export function requireOwner(viewer: Viewer, propertyId: string): void {
  if (scopeFor(viewer, propertyId) !== 'owner') {
    /* 404 rather than 403: telling a stranger "that exists but is not yours"
       is itself a disclosure. */
    throw new ApiError('not_found', 'no such property');
  }
}

export function requireOwnerOrTenant(viewer: Viewer, propertyId: string): Scope {
  const scope = scopeFor(viewer, propertyId);
  if (scope === 'public') throw new ApiError('not_found', 'no such property');
  return scope;
}
