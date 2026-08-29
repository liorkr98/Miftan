import { and, count, eq, gte, isNull, sql } from 'drizzle-orm';
import type { Capabilities } from '@miftach/shared';
import { db, schema as s } from '../db/client.ts';

/**
 * What a user is, derived from what they hold.
 *
 * There is no role column anywhere. A landlord who rents a flat of their own
 * and is queueing on a third gets all three capabilities, and the app picks a
 * shell from this rather than from a field somebody has to remember to update.
 */
export async function capabilitiesFor(userId: string): Promise<Capabilities> {
  const today = new Date().toISOString().slice(0, 10);

  const [[owned], activeLeases, [leads]] = await Promise.all([
    db
      .select({ n: count() })
      .from(s.properties)
      .where(and(eq(s.properties.ownerId, userId), isNull(s.properties.deletedAt))),

    db
      .select({ id: s.leases.id })
      .from(s.leases)
      .where(
        and(
          eq(s.leases.tenantId, userId),
          isNull(s.leases.deletedAt),
          gte(s.leases.endDate, today),
        ),
      ),

    db
      .select({ n: count() })
      .from(s.leads)
      .where(
        and(
          eq(s.leads.seekerId, userId),
          isNull(s.leads.deletedAt),
          sql`${s.leads.stage} not in ('signed', 'rejected')`,
        ),
      ),
  ]);

  return {
    isOwner: (owned?.n ?? 0) > 0,
    ownedPropertyCount: owned?.n ?? 0,
    isTenant: activeLeases.length > 0,
    activeLeaseIds: activeLeases.map((l) => l.id),
    isSeeker: (leads?.n ?? 0) > 0,
    openLeadCount: leads?.n ?? 0,
  };
}
