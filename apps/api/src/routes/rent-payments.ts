import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import {
  rentPaymentListSchema,
  rentPaymentQuerySchema,
  type RentPaymentView,
} from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { resolveViewer, scopeFor } from '../policy/viewer.ts';

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
}
