import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, desc, eq, gte, inArray, isNull, lte } from 'drizzle-orm';
import { z } from 'zod';
import {
  ApiError,
  israelMonth,
  markRentPaidSchema,
  rentPaymentViewSchema,
  toAgorot,
  rentPaymentListSchema,
  rentPaymentQuerySchema,
  type RentPaymentView,
} from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { requireOwner, resolveViewer, scopeFor } from '../policy/viewer.ts';
import { newId } from '../lib/ids.ts';

/** yyyy-MM for every month from start through end, inclusive. */
function monthsBetween(start: string, end: string): string[] {
  const out: string[] = [];
  let [y, m] = start.split('-').map(Number) as [number, number];
  const [ey, em] = end.split('-').map(Number) as [number, number];
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/**
 * One row per lease month, up to the current month. HUMAN REVIEW: this is
 * what an owner's rent roll and the "rent unpaid" notice are built from.
 *
 * Before this, only the seed scripts ever created these rows, so a real
 * lease had an empty rent roll forever. Run on read for the leases in view
 * (idempotent: the lease+month key makes a second run a no-op), which is
 * the daily job without needing a scheduler: a month appears the first time
 * anyone looks after it begins.
 */
export async function ensureRentRows(propertyIds: string[]): Promise<void> {
  if (propertyIds.length === 0) return;
  const leases = await db
    .select()
    .from(s.leases)
    .where(and(inArray(s.leases.propertyId, propertyIds), isNull(s.leases.deletedAt)));

  const current = israelMonth();
  const rows = leases.flatMap((lease) => {
    const first = lease.startDate.slice(0, 7);
    const last = lease.endDate.slice(0, 7) < current ? lease.endDate.slice(0, 7) : current;
    if (first > last) return [];
    return monthsBetween(first, last).map((month) => ({
      id: newId('rentPayment'),
      propertyId: lease.propertyId,
      leaseId: lease.id,
      month,
      dueAgorot: lease.monthlyRentAgorot,
      method: lease.paymentMethod,
    }));
  });
  if (rows.length === 0) return;
  await db.insert(s.rentPayments).values(rows).onConflictDoNothing({
    target: [s.rentPayments.leaseId, s.rentPayments.month],
  });
}

/**
 * Rent collected, as the people who paid it and the people who are owed it
 * may see it. A mixed-role account gets both projections in one list, each
 * row shaped for the relationship that produced it.
 */
export async function rentPaymentRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/rent-payments',
    {
      onRequest: [app.authenticate],
      schema: { querystring: rentPaymentQuerySchema, response: { 200: rentPaymentListSchema } },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const { propertyId, from, to } = request.query;

      const visible = new Set([...viewer.ownedPropertyIds, ...viewer.tenantPropertyIds]);
      const ids = propertyId ? (visible.has(propertyId) ? [propertyId] : []) : [...visible];
      if (ids.length === 0) return { payments: [] };
      await ensureRentRows(ids);

      const filters = [inArray(s.rentPayments.propertyId, ids)];
      if (from) filters.push(gte(s.rentPayments.month, from));
      if (to) filters.push(lte(s.rentPayments.month, to));

      const rows = await db
        .select({
          payment: s.rentPayments,
          property: s.properties,
          tenant: { id: s.users.id, name: s.users.name, phone: s.users.phone },
        })
        .from(s.rentPayments)
        .innerJoin(s.properties, eq(s.properties.id, s.rentPayments.propertyId))
        .innerJoin(s.leases, eq(s.leases.id, s.rentPayments.leaseId))
        .innerJoin(s.users, eq(s.users.id, s.leases.tenantId))
        .where(and(...filters))
        .orderBy(desc(s.rentPayments.month), desc(s.rentPayments.createdAt));

      const payments: RentPaymentView[] = [];
      for (const row of rows) {
        const scope = scopeFor(viewer, row.payment.propertyId);
        if (scope === 'public') continue;

        const base = {
          id: row.payment.id,
          propertyId: row.payment.propertyId,
          propertyLabel: `${row.property.street} ${row.property.houseNumber}`,
          leaseId: row.payment.leaseId,
          month: row.payment.month,
          dueAgorot: row.payment.dueAgorot,
          paidAgorot: row.payment.paidAgorot,
          paidAt: row.payment.paidAt,
          method: row.payment.method,
        };

        if (scope === 'owner') {
          payments.push({
            ...base,
            scope: 'owner',
            tenant: { id: row.tenant.id, name: row.tenant.name, phone: row.tenant.phone },
          });
        } else if (row.tenant.id === viewer.userId) {
          /* By lease, not by property: the flat a tenant rents also carries
             the payment history of whoever lived there before them, and that
             is not theirs to read — not the amounts, not the months. */
          payments.push({ ...base, scope: 'tenant' });
        }
      }

      return { payments };
    },
  );

  /**
   * The owner recording what arrived for one month. Sending the full due
   * amount marks it paid; less is a partial payment; zero clears it.
   * Owner-only: a tenant saying they paid is not the same as the money
   * arriving.
   */
  r.post(
    '/rent-payments/:id/paid',
    {
      onRequest: [app.authenticate],
      schema: {
        params: z.object({ id: z.string() }),
        body: markRentPaidSchema,
        response: { 200: rentPaymentViewSchema },
      },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const [row] = await db.select().from(s.rentPayments).where(eq(s.rentPayments.id, request.params.id));
      if (!row) throw new ApiError('not_found', 'no such payment');
      requireOwner(viewer, row.propertyId);

      const b = request.body;
      const paidAgorot = toAgorot(b.paidShekels);
      await db
        .update(s.rentPayments)
        .set({
          paidAgorot,
          paidAt: paidAgorot > 0 ? b.paidAt : null,
          ...(b.method ? { method: b.method } : {}),
          updatedAt: new Date(),
        })
        .where(eq(s.rentPayments.id, row.id));

      const [after] = await db
        .select({
          payment: s.rentPayments,
          property: s.properties,
          tenant: { id: s.users.id, name: s.users.name, phone: s.users.phone },
        })
        .from(s.rentPayments)
        .innerJoin(s.properties, eq(s.properties.id, s.rentPayments.propertyId))
        .innerJoin(s.leases, eq(s.leases.id, s.rentPayments.leaseId))
        .innerJoin(s.users, eq(s.users.id, s.leases.tenantId))
        .where(eq(s.rentPayments.id, row.id));

      return {
        scope: 'owner' as const,
        id: after!.payment.id,
        propertyId: after!.payment.propertyId,
        propertyLabel: `${after!.property.street} ${after!.property.houseNumber}`,
        leaseId: after!.payment.leaseId,
        month: after!.payment.month,
        dueAgorot: after!.payment.dueAgorot,
        paidAgorot: after!.payment.paidAgorot,
        paidAt: after!.payment.paidAt,
        method: after!.payment.method,
        tenant: after!.tenant,
      };
    },
  );
}
