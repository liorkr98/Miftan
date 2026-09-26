import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { ApiError, createVendorSchema, expenseListSchema, vendorListSchema, vendorSchema } from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { resolveViewer } from '../policy/viewer.ts';

export async function directoryRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  /**
   * The tradespeople an owner can book: the network, plus their own.
   *
   * Sorted by rating alone. Network partners pay us a commission and are
   * labelled as such in the UI, but they get no ranking advantage — that is
   * the difference between a disclosed affiliate and a bought result, and it
   * is enforced here rather than promised in marketing copy.
   */
  r.get(
    '/vendors',
    { onRequest: [app.authenticate], schema: { response: { 200: vendorListSchema } } },
    async (request) => {
      const rows = await db
        .select()
        .from(s.vendors)
        .where(
          and(
            isNull(s.vendors.deletedAt),
            or(isNull(s.vendors.ownerId), eq(s.vendors.ownerId, request.currentUser!.id)),
          ),
        )
        .orderBy(desc(s.vendors.rating));

      return {
        vendors: rows.map((v) => ({
          id: v.id,
          name: v.name,
          trade: v.trade,
          phone: v.phone,
          areas: v.areas,
          rating: Number(v.rating),
          jobsDone: v.jobsDone,
          avgResponseHours: v.avgResponseHours,
          calloutFeeAgorot: v.calloutFeeAgorot,
          isNetworkPartner: v.isNetworkPartner,
          note: v.note,
        })),
      };
    },
  );

  /**
   * An owner adding their own tradesperson.
   *
   * Always `ownerId: request.currentUser!.id` and `isNetworkPartner: false` —
   * neither is ever taken from the request body. The network label is a
   * commercial relationship this endpoint has no way to grant, and letting a
   * caller set their own `ownerId` would let one owner plant a vendor in
   * another's list.
   */
  r.post(
    '/vendors',
    {
      onRequest: [app.authenticate],
      schema: { body: createVendorSchema, response: { 201: vendorSchema } },
    },
    async (request, reply) => {
      const id = newId('vendor');
      await db.insert(s.vendors).values({
        id,
        ownerId: request.currentUser!.id,
        name: request.body.name,
        trade: request.body.trade,
        phone: request.body.phone,
        areas: request.body.areas,
        calloutFeeAgorot: request.body.calloutFeeAgorot,
        note: request.body.note ?? null,
      });

      const [v] = await db.select().from(s.vendors).where(eq(s.vendors.id, id));
      return reply.code(201).send({
        id: v.id,
        name: v.name,
        trade: v.trade,
        phone: v.phone,
        areas: v.areas,
        rating: Number(v.rating),
        jobsDone: v.jobsDone,
        avgResponseHours: v.avgResponseHours,
        calloutFeeAgorot: v.calloutFeeAgorot,
        isNetworkPartner: v.isNetworkPartner,
        note: v.note,
      });
    },
  );

  /** Removing your own vendor. A network partner cannot be removed this way —
      it is not yours to remove, and 404 says so without explaining why. */
  r.delete(
    '/vendors/:id',
    {
      onRequest: [app.authenticate],
      schema: {
        params: z.object({ id: z.string() }),
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (request) => {
      const [v] = await db
        .select({ id: s.vendors.id })
        .from(s.vendors)
        .where(and(eq(s.vendors.id, request.params.id), eq(s.vendors.ownerId, request.currentUser!.id)));
      if (!v) throw new ApiError('not_found', 'no such vendor');

      await db.update(s.vendors).set({ deletedAt: new Date() }).where(eq(s.vendors.id, v.id));
      return { ok: true as const };
    },
  );

  /** Expenses are the owner's books; a tenant never sees them. */
  r.get(
    '/expenses',
    {
      onRequest: [app.authenticate],
      schema: {
        querystring: z.object({ propertyId: z.string().optional() }),
        response: { 200: expenseListSchema },
      },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const owned = [...viewer.ownedPropertyIds];
      const ids = request.query.propertyId
        ? owned.filter((id) => id === request.query.propertyId)
        : owned;
      if (ids.length === 0) return { expenses: [], totalAgorot: 0 };

      const rows = await db
        .select({ expense: s.expenses, property: s.properties })
        .from(s.expenses)
        .innerJoin(s.properties, eq(s.properties.id, s.expenses.propertyId))
        .where(and(inArray(s.expenses.propertyId, ids), isNull(s.expenses.deletedAt)))
        .orderBy(desc(s.expenses.date));

      const expenses = rows.map(({ expense: e, property: p }) => ({
        id: e.id,
        propertyId: e.propertyId,
        propertyLabel: `${p.street} ${p.houseNumber}`,
        kind: e.kind,
        category: e.category,
        amountAgorot: e.amountAgorot,
        vendorName: e.vendorName,
        date: e.date,
        ticketId: e.ticketId,
        receiptFile: e.receiptFile,
        documentType: e.documentType,
        note: e.note,
      }));

      return { expenses, totalAgorot: expenses.reduce((sum, e) => sum + e.amountAgorot, 0) };
    },
  );
}
