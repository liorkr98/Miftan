import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  ApiError,
  assignVendorSchema,
  createTicketSchema,
  postMessageSchema,
  ticketActionSchema,
  ticketListSchema,
  ticketViewSchema,
  uploadReceiptSchema,
} from '@miftach/shared';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { resolveViewer, scopeFor, type Viewer } from '../policy/viewer.ts';
import {
  loadTicketContexts,
  loadTicketOr404,
  projectTicket,
  visiblePropertyIds,
} from '../policy/tickets.ts';
import { RECEIPT_ALLOWED_FROM, nextStatus, type TicketAction } from '../policy/ticket-state.ts';

const viewerFor = (request: FastifyRequest): Promise<Viewer> => resolveViewer(request.currentUser!.id);

/** Loads a ticket the viewer is entitled to, or 404s. */
async function ticketFor(viewer: Viewer, ticketId: string) {
  const ticket = await loadTicketOr404(ticketId);
  /* 404 rather than 403 — see the property routes for why. */
  if (!ticket) throw new ApiError('not_found', 'no such ticket');
  const scope = scopeFor(viewer, ticket.propertyId);
  if (scope === 'public') throw new ApiError('not_found', 'no such ticket');
  return { ticket, scope };
}

async function respondWith(viewer: Viewer, ticketId: string) {
  const ticket = await loadTicketOr404(ticketId);
  const [ctx] = await loadTicketContexts([ticket!]);
  return projectTicket(viewer, ctx);
}

export async function ticketRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/tickets',
    {
      onRequest: [app.authenticate],
      schema: {
        querystring: z.object({ propertyId: z.string().optional(), open: z.coerce.boolean().optional() }),
        response: { 200: ticketListSchema },
      },
    },
    async (request) => {
      const viewer = await viewerFor(request);
      const scopeIds = visiblePropertyIds(viewer);
      if (scopeIds.length === 0) return { tickets: [] };

      const propertyIds = request.query.propertyId
        ? scopeIds.filter((id) => id === request.query.propertyId)
        : scopeIds;
      if (propertyIds.length === 0) return { tickets: [] };

      const rows = await db
        .select()
        .from(s.tickets)
        .where(and(inArray(s.tickets.propertyId, propertyIds), isNull(s.tickets.deletedAt)))
        .orderBy(desc(s.tickets.createdAt));

      const open = request.query.open
        ? rows.filter((t) => t.status !== 'closed')
        : rows;

      const contexts = await loadTicketContexts(open);
      return { tickets: contexts.map((ctx) => projectTicket(viewer, ctx)) };
    },
  );

  r.get(
    '/tickets/:id',
    {
      onRequest: [app.authenticate],
      schema: { params: z.object({ id: z.string() }), response: { 200: ticketViewSchema } },
    },
    async (request) => {
      const viewer = await viewerFor(request);
      await ticketFor(viewer, request.params.id);
      return respondWith(viewer, request.params.id);
    },
  );

  /**
   * Reporting a fault. Either side may open one — usually the tenant, but an
   * owner logging something they noticed themselves is normal too.
   */
  r.post(
    '/tickets',
    { onRequest: [app.authenticate], schema: { body: createTicketSchema, response: { 201: ticketViewSchema } } },
    async (request, reply) => {
      const viewer = await viewerFor(request);
      const scope = scopeFor(viewer, request.body.propertyId);
      if (scope === 'public') throw new ApiError('not_found', 'no such property');

      const id = newId('ticket');
      const { title, description, category, severity, photos, availability, propertyId } = request.body;

      await db.transaction(async (tx) => {
        await tx.insert(s.tickets).values({
          id,
          propertyId,
          tenantId: scope === 'tenant' ? viewer.userId : null,
          category,
          severity,
          status: 'new',
          title,
          description,
          photos,
          tenantAvailability: availability.map((iso) => new Date(iso)),
        });

        /* The opening description is also the first message, so the thread
           reads as a conversation from the start rather than beginning with a
           reply to something invisible. */
        await tx.insert(s.ticketMessages).values({
          id: newId('ticketMessage'),
          ticketId: id,
          authorRole: scope,
          authorUserId: viewer.userId,
          authorName: request.currentUser!.name,
          body: description || title,
          photos,
        });
      });

      return reply.code(201).send(await respondWith(viewer, id));
    },
  );

  /**
   * Every status change goes through one endpoint and one table. Adding an
   * action means adding a row to TRANSITIONS, not another handler with its own
   * idea of what is allowed.
   */
  r.post(
    '/tickets/:id/actions/:action',
    {
      onRequest: [app.authenticate],
      schema: {
        params: z.object({ id: z.string(), action: ticketActionSchema }),
        /* nullish, not optional: a POST with no payload arrives as null, and
           `.optional()` only accepts undefined. */
        body: assignVendorSchema.partial().nullish(),
        response: { 200: ticketViewSchema },
      },
    },
    async (request) => {
      const viewer = await viewerFor(request);
      const { ticket, scope } = await ticketFor(viewer, request.params.id);
      const action = request.params.action as TicketAction;

      const status = nextStatus(action, ticket.status, scope);
      const patch: Partial<typeof s.tickets.$inferInsert> = { status, updatedAt: new Date() };

      if (action === 'assign') {
        const { vendorId, scheduledAt } = request.body ?? {};
        if (!vendorId || !scheduledAt) {
          throw new ApiError('validation_failed', 'assigning needs a vendor and a time', {
            vendorId: vendorId ? [] : ['required'],
            scheduledAt: scheduledAt ? [] : ['required'],
          });
        }
        const [vendor] = await db.select().from(s.vendors).where(eq(s.vendors.id, vendorId));
        if (!vendor) throw new ApiError('not_found', 'no such vendor');

        patch.vendorId = vendorId;
        patch.scheduledAt = new Date(scheduledAt);
        /* A new booking is a new commitment; the previous confirmation does
           not carry over to a different time or a different tradesperson. */
        patch.tenantConfirmedSlot = false;
      }

      await db.update(s.tickets).set(patch).where(eq(s.tickets.id, ticket.id));
      return respondWith(viewer, ticket.id);
    },
  );

  /** The tenant confirming they will be home. Not a status change. */
  r.post(
    '/tickets/:id/confirm-slot',
    {
      onRequest: [app.authenticate],
      schema: { params: z.object({ id: z.string() }), response: { 200: ticketViewSchema } },
    },
    async (request) => {
      const viewer = await viewerFor(request);
      const { ticket, scope } = await ticketFor(viewer, request.params.id);

      if (scope !== 'tenant') throw new ApiError('forbidden', 'only the tenant can confirm a visit');
      if (!ticket.scheduledAt) throw new ApiError('forbidden', 'nothing is scheduled yet');

      await db
        .update(s.tickets)
        .set({ tenantConfirmedSlot: true, updatedAt: new Date() })
        .where(eq(s.tickets.id, ticket.id));

      await db.insert(s.ticketMessages).values({
        id: newId('ticketMessage'),
        ticketId: ticket.id,
        authorRole: 'tenant',
        authorUserId: viewer.userId,
        authorName: request.currentUser!.name,
        body: 'אני אהיה בבית',
      });

      return respondWith(viewer, ticket.id);
    },
  );

  /**
   * The hinge of the whole flow: a receipt closes the ticket *and* books the
   * expense against the unit, in one transaction. Half of that happening is
   * what produces a portfolio whose maintenance spend quietly disagrees with
   * its own ticket history.
   */
  r.post(
    '/tickets/:id/receipt',
    {
      onRequest: [app.authenticate],
      schema: {
        params: z.object({ id: z.string() }),
        body: uploadReceiptSchema,
        response: { 200: ticketViewSchema },
      },
    },
    async (request) => {
      const viewer = await viewerFor(request);
      const { ticket, scope } = await ticketFor(viewer, request.params.id);

      if (!RECEIPT_ALLOWED_FROM.includes(ticket.status)) {
        throw new ApiError('forbidden', `cannot attach a receipt to a ticket that is "${ticket.status}"`);
      }
      if (ticket.receiptAmountAgorot != null) {
        throw new ApiError('forbidden', 'this ticket already has a receipt');
      }

      const { amountAgorot, file } = request.body;
      const vendor = ticket.vendorId
        ? (await db.select().from(s.vendors).where(eq(s.vendors.id, ticket.vendorId)))[0]
        : null;

      await db.transaction(async (tx) => {
        await tx
          .update(s.tickets)
          .set({
            status: 'closed',
            receiptAmountAgorot: amountAgorot,
            receiptFile: file,
            receiptUploadedAt: new Date(),
            receiptUploadedBy: scope,
            updatedAt: new Date(),
          })
          .where(eq(s.tickets.id, ticket.id));

        await tx.insert(s.expenses).values({
          id: newId('expense'),
          propertyId: ticket.propertyId,
          kind: 'maintenance',
          category: ticket.category,
          amountAgorot,
          vendorId: ticket.vendorId,
          vendorName: vendor?.name ?? null,
          date: new Date().toISOString().slice(0, 10),
          ticketId: ticket.id,
          receiptFile: file,
          documentType: 'receipt',
        });
      });

      return respondWith(viewer, ticket.id);
    },
  );

  r.post(
    '/tickets/:id/messages',
    {
      onRequest: [app.authenticate],
      schema: {
        params: z.object({ id: z.string() }),
        body: postMessageSchema,
        response: { 200: ticketViewSchema },
      },
    },
    async (request) => {
      const viewer = await viewerFor(request);
      const { ticket, scope } = await ticketFor(viewer, request.params.id);

      await db.insert(s.ticketMessages).values({
        id: newId('ticketMessage'),
        ticketId: ticket.id,
        authorRole: scope,
        authorUserId: viewer.userId,
        authorName: request.currentUser!.name,
        body: request.body.body,
        photos: request.body.photos,
      });

      return respondWith(viewer, ticket.id);
    },
  );
}
