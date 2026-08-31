import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import {
  ApiError,
  askInquirySchema,
  askTenantSchema,
  inquiryListSchema,
  inquiryViewSchema,
  ownerReplySchema,
  tenantAnswerSchema,
} from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { resolveViewer, scopeFor } from '../policy/viewer.ts';
import { loadInquiryContexts, projectInquiry } from '../policy/inquiries.ts';

export async function inquiryRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  /** Everything you are a party to, in whichever role you hold. */
  r.get(
    '/inquiries',
    { onRequest: [app.authenticate], schema: { response: { 200: inquiryListSchema } } },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const owned = [...viewer.ownedPropertyIds];
      const tenanted = [...viewer.tenantPropertyIds];

      const conditions = [eq(s.availabilityInquiries.seekerId, viewer.userId)];
      if (owned.length) conditions.push(inArray(s.availabilityInquiries.propertyId, owned));
      /* A tenant only enters the chain once the owner has actually forwarded
         the question. The `askedTenantAt` half of that is applied below, where
         it can be read against all three roles at once. */
      if (tenanted.length) conditions.push(inArray(s.availabilityInquiries.propertyId, tenanted));

      const rows = await db
        .select()
        .from(s.availabilityInquiries)
        .where(or(...conditions))
        .orderBy(desc(s.availabilityInquiries.createdAt));

      /* Drop tenant-side rows that have not been forwarded yet. */
      const visible = rows.filter((i) => {
        if (i.seekerId === viewer.userId) return true;
        if (viewer.ownedPropertyIds.has(i.propertyId)) return true;
        return i.askedTenantAt !== null;
      });

      const contexts = await loadInquiryContexts(visible, { withIdentities: true });
      return {
        inquiries: contexts.map((ctx) => projectInquiry(viewer, ctx)),
      };
    },
  );

  /** A seeker asking about a flat whose availability is not published. */
  r.post(
    '/inquiries',
    {
      onRequest: [app.authenticate],
      schema: { body: askInquirySchema, response: { 201: inquiryViewSchema } },
    },
    async (request, reply) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const [property] = await db
        .select()
        .from(s.properties)
        .where(and(eq(s.properties.id, request.body.propertyId), isNull(s.properties.deletedAt)));

      if (!property || !property.listed) throw new ApiError('not_found', 'no such listing');
      /* Asking your own tenant, through the product, about your own flat is
         not a thing that makes sense. */
      if (scopeFor(viewer, property.id) === 'owner') {
        throw new ApiError('forbidden', 'this is your own property');
      }

      const id = newId('inquiry');
      await db.insert(s.availabilityInquiries).values({
        id,
        propertyId: property.id,
        seekerId: viewer.userId,
        message: request.body.message,
        desiredMoveIn: request.body.desiredMoveIn,
        status: 'new',
      });

      const [row] = await db.select().from(s.availabilityInquiries).where(eq(s.availabilityInquiries.id, id));
      const [ctx] = await loadInquiryContexts([row], { withIdentities: false });
      return reply.code(201).send(projectInquiry(viewer, ctx));
    },
  );

  /**
   * The owner forwarding the question to their tenant.
   *
   * The seeker's message is deliberately not carried across. The tenant is
   * being asked whether they intend to renew — a question their landlord is
   * entitled to ask at any time — not being told that a stranger is waiting for
   * their home, which changes the question into pressure.
   */
  r.post(
    '/inquiries/:id/ask-tenant',
    {
      onRequest: [app.authenticate],
      schema: {
        params: z.object({ id: z.string() }),
        body: askTenantSchema.nullish(),
        response: { 200: inquiryViewSchema },
      },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const row = await loadOwned(viewer, request.params.id);

      const [tenant] = await db
        .select({ id: s.leases.tenantId })
        .from(s.leases)
        .where(and(eq(s.leases.propertyId, row.propertyId), isNull(s.leases.deletedAt)))
        .orderBy(desc(s.leases.endDate))
        .limit(1);
      if (!tenant) throw new ApiError('forbidden', 'this property has no tenant to ask');

      await db
        .update(s.availabilityInquiries)
        .set({ status: 'asked_tenant', askedTenantAt: new Date(), updatedAt: new Date() })
        .where(eq(s.availabilityInquiries.id, row.id));

      /* Asking is also a lease-level question, so record it where the renewal
         flow reads it rather than only on the inquiry. */
      await db
        .update(s.leases)
        .set({ renewalAskedAt: new Date() })
        .where(and(eq(s.leases.propertyId, row.propertyId), isNull(s.leases.deletedAt)));

      return reproject(viewer, row.id);
    },
  );

  /** The tenant's answer. Reaches the owner, and stops there. */
  r.post(
    '/inquiries/:id/answer',
    {
      onRequest: [app.authenticate],
      schema: {
        params: z.object({ id: z.string() }),
        body: tenantAnswerSchema,
        response: { 200: inquiryViewSchema },
      },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const [row] = await db
        .select()
        .from(s.availabilityInquiries)
        .where(eq(s.availabilityInquiries.id, request.params.id));

      if (!row || scopeFor(viewer, row.propertyId) !== 'tenant') {
        throw new ApiError('not_found', 'no such inquiry');
      }
      /* You cannot answer a question that was never put to you. */
      if (!row.askedTenantAt) throw new ApiError('not_found', 'no such inquiry');

      await db.transaction(async (tx) => {
        await tx
          .update(s.availabilityInquiries)
          .set({
            status: 'answered',
            tenantAnswer: request.body.answer,
            tenantAnswerNote: request.body.note ?? null,
            tenantAnsweredAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(s.availabilityInquiries.id, row.id));

        /* The lease is where renewal intent lives for every other surface.
           deriveAvailability() reads it from there, so writing it here is what
           makes the seeker-facing signal move. */
        await tx
          .update(s.leases)
          .set({ renewalIntent: request.body.answer })
          .where(and(eq(s.leases.propertyId, row.propertyId), isNull(s.leases.deletedAt)));
      });

      return reproject(viewer, row.id);
    },
  );

  /**
   * The owner's reply, and the only path by which a date becomes public.
   *
   * The reply is the owner's own words. Nothing here copies the tenant's note,
   * and the date is one the owner chose to publish — not one derived silently
   * from what the tenant said.
   */
  r.post(
    '/inquiries/:id/reply',
    {
      onRequest: [app.authenticate],
      schema: {
        params: z.object({ id: z.string() }),
        body: ownerReplySchema,
        response: { 200: inquiryViewSchema },
      },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const row = await loadOwned(viewer, request.params.id);
      const { reply, availableFrom, confidence } = request.body;

      await db.transaction(async (tx) => {
        await tx
          .update(s.availabilityInquiries)
          .set({
            status: 'replied',
            ownerReply: reply,
            ownerRepliedAt: new Date(),
            resultingAvailableFrom: availableFrom ?? null,
            updatedAt: new Date(),
          })
          .where(eq(s.availabilityInquiries.id, row.id));

        if (availableFrom) {
          await tx
            .update(s.properties)
            .set({ availableFrom, availabilityConfidence: confidence, updatedAt: new Date() })
            .where(eq(s.properties.id, row.propertyId));
        }
      });

      return reproject(viewer, row.id);
    },
  );

  /** The owner declining to chase it — an answer the seeker can act on. */
  r.post(
    '/inquiries/:id/decline',
    {
      onRequest: [app.authenticate],
      schema: {
        params: z.object({ id: z.string() }),
        body: z.object({ reply: z.string().trim().min(1).max(600) }).nullish(),
        response: { 200: inquiryViewSchema },
      },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const row = await loadOwned(viewer, request.params.id);
      await db
        .update(s.availabilityInquiries)
        .set({
          status: 'declined',
          ownerReply: request.body?.reply ?? null,
          ownerRepliedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(s.availabilityInquiries.id, row.id));
      return reproject(viewer, row.id);
    },
  );
}

/* ── helpers ─────────────────────────────────────────────── */

async function loadOwned(viewer: Awaited<ReturnType<typeof resolveViewer>>, id: string) {
  const [row] = await db.select().from(s.availabilityInquiries).where(eq(s.availabilityInquiries.id, id));
  /* 404 rather than 403: a stranger should not learn that an inquiry exists. */
  if (!row || scopeFor(viewer, row.propertyId) !== 'owner') {
    throw new ApiError('not_found', 'no such inquiry');
  }
  return row;
}

async function reproject(viewer: Awaited<ReturnType<typeof resolveViewer>>, id: string) {
  const [row] = await db.select().from(s.availabilityInquiries).where(eq(s.availabilityInquiries.id, id));
  const [ctx] = await loadInquiryContexts([row], {
    withIdentities: scopeFor(viewer, row.propertyId) === 'owner',
  });
  return projectInquiry(viewer, ctx);
}
