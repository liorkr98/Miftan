import { and, eq, gte, isNull } from 'drizzle-orm';
import { ApiError } from '@miftach/shared';
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
}

/** Nobody signed in. Sees exactly what a stranger on the internet may see. */
export const ANONYMOUS: Viewer = {
  userId: '',
  ownedPropertyIds: new Set(),
  tenantPropertyIds: new Set(),
};

export async function resolveViewer(userId: string): Promise<Viewer> {
  const today = new Date().toISOString().slice(0, 10);

  const [owned, tenanted] = await Promise.all([
    db
      .select({ id: s.properties.id })
      .from(s.properties)
      .where(and(eq(s.properties.ownerId, userId), isNull(s.properties.deletedAt))),
    db
      .select({ id: s.leases.propertyId })
      .from(s.leases)
      .where(
        and(
          eq(s.leases.tenantId, userId),
          isNull(s.leases.deletedAt),
          gte(s.leases.endDate, today),
        ),
      ),
  ]);

  return {
    userId,
    ownedPropertyIds: new Set(owned.map((r) => r.id)),
    tenantPropertyIds: new Set(tenanted.map((r) => r.id)),
  };
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
