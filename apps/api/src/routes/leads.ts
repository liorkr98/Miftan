import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  ApiError,
  auditListSchema,
  leadListSchema,
  leadViewSchema,
  reserveQueueSchema,
  screeningPresetListSchema,
  setStageSchema,
  updatePresetSchema,
  type ScreeningCriterion,
} from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { resolveViewer, scopeFor } from '../policy/viewer.ts';
import { activeCriteria, evaluate, loadLeadContexts, projectLead } from '../policy/leads.ts';

export async function leadRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  /**
   * Leads on your properties, or your own place in other people's queues.
   * Which one you get depends on the relationship, not on a query parameter.
   */
  r.get(
    '/leads',
    {
      onRequest: [app.authenticate],
      schema: {
        querystring: z.object({ propertyId: z.string().optional() }),
        response: { 200: leadListSchema },
      },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const filter = request.query.propertyId;
      /* A propertyId you do not own narrows the owner list to nothing rather
         than erroring — you asked about a queue that is not yours to see. */
      const owned = [...viewer.ownedPropertyIds].filter((id) => !filter || id === filter);

      const [asOwner, asSeeker] = await Promise.all([
        owned.length
          ? db
              .select()
              .from(s.leads)
              .where(and(inArray(s.leads.propertyId, owned), isNull(s.leads.deletedAt)))
              .orderBy(s.leads.queuePosition)
          : Promise.resolve([]),
        db
          .select()
          .from(s.leads)
          .where(and(eq(s.leads.seekerId, viewer.userId), isNull(s.leads.deletedAt)))
          .orderBy(desc(s.leads.createdAt)),
      ]);

      const { criteria } = await activeCriteria(viewer.userId);

      /* Identities are loaded only for the owner's own queues. A seeker's
         request performs no query against other applicants at all. */
      const ownerContexts = await loadLeadContexts(asOwner, { criteria, withIdentities: true });
      const seekerContexts = await loadLeadContexts(
        /* A lead can appear in both lists if you queue on your own flat; the
           owner projection wins and the duplicate is dropped. */
        asSeeker.filter((l) => !viewer.ownedPropertyIds.has(l.propertyId)),
        { criteria: [], withIdentities: false },
      );

      return {
        leads: [
          ...ownerContexts.map((ctx) => projectLead(viewer, ctx)),
          ...seekerContexts.map((ctx) => projectLead(viewer, ctx)),
        ],
      };
    },
  );

  /** One lead, projected for whichever side of it you are on. */
  r.get(
    '/leads/:id',
    {
      onRequest: [app.authenticate],
      schema: { params: z.object({ id: z.string() }), response: { 200: leadViewSchema } },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const [lead] = await db
        .select()
        .from(s.leads)
        .where(and(eq(s.leads.id, request.params.id), isNull(s.leads.deletedAt)));

      const isOwner = lead && scopeFor(viewer, lead.propertyId) === 'owner';
      const isMine = lead && lead.seekerId === viewer.userId;
      if (!isOwner && !isMine) throw new ApiError('not_found', 'no such lead');

      const { criteria } = isOwner ? await activeCriteria(viewer.userId) : { criteria: [] };
      const [ctx] = await loadLeadContexts([lead], { criteria, withIdentities: Boolean(isOwner) });
      return projectLead(viewer, ctx);
    },
  );

  /**
   * Moving a lead through the pipeline. Every move writes an audit line with
   * the criteria as they stood at that moment — which is the whole point: a
   * landlord challenged about a decision needs to show what the rule was then,
   * not what it is now.
   */
  r.post(
    '/leads/:id/stage',
    {
      onRequest: [app.authenticate],
      schema: {
        params: z.object({ id: z.string() }),
        body: setStageSchema,
        response: { 200: leadViewSchema },
      },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const [lead] = await db
        .select()
        .from(s.leads)
        .where(and(eq(s.leads.id, request.params.id), isNull(s.leads.deletedAt)));

      if (!lead || scopeFor(viewer, lead.propertyId) !== 'owner') {
        throw new ApiError('not_found', 'no such lead');
      }

      const { criteria, name } = await activeCriteria(viewer.userId);
      const [ctx] = await loadLeadContexts([lead], { criteria, withIdentities: true });
      const { flags } = evaluate(ctx);

      await db.transaction(async (tx) => {
        await tx
          .update(s.leads)
          .set({ stage: request.body.stage, updatedAt: new Date() })
          .where(eq(s.leads.id, lead.id));

        await tx.insert(s.screeningAuditLog).values({
          id: newId('audit'),
          ownerId: viewer.userId,
          leadId: lead.id,
          leadName: ctx.seeker?.name ?? '—',
          propertyId: lead.propertyId,
          presetName: name,
          action: 'stage_changed',
          detail: `${lead.stage} → ${request.body.stage}`,
          flags,
        });
      });

      const [after] = await db.select().from(s.leads).where(eq(s.leads.id, lead.id));
      const [refreshed] = await loadLeadContexts([after], { criteria, withIdentities: true });
      return projectLead(viewer, refreshed);
    },
  );

  /** A seeker taking a place in a queue, or asking to be told when one opens. */
  r.post(
    '/leads',
    {
      onRequest: [app.authenticate],
      schema: { body: reserveQueueSchema, response: { 201: leadViewSchema } },
    },
    async (request, reply) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const { propertyId, desiredMoveIn, watchOnly } = request.body;

      const [property] = await db
        .select()
        .from(s.properties)
        .where(and(eq(s.properties.id, propertyId), isNull(s.properties.deletedAt)));

      /* You cannot queue for something that was never published. */
      if (!property || !property.listed) throw new ApiError('not_found', 'no such listing');

      const [existing] = await db
        .select()
        .from(s.leads)
        .where(and(eq(s.leads.propertyId, propertyId), eq(s.leads.seekerId, viewer.userId)));
      if (existing) throw new ApiError('forbidden', 'you are already in this queue');

      const [profile] = await db
        .select()
        .from(s.renterProfiles)
        .where(eq(s.renterProfiles.userId, viewer.userId));
      if (!profile?.complete) {
        throw new ApiError('forbidden', 'complete your renter profile before applying');
      }

      const [{ n }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(s.leads)
        .where(and(eq(s.leads.propertyId, propertyId), isNull(s.leads.deletedAt)));

      const id = newId('lead');
      await db.insert(s.leads).values({
        id,
        propertyId,
        seekerId: viewer.userId,
        stage: 'new',
        desiredMoveIn,
        queuePosition: n + 1,
        watchOnly,
        /* Frozen at application time. Their profile may change afterwards;
           what the owner screened against must not. */
        incomeToRentRatio: profile.incomeToRentRatio,
        employment: profile.employment,
        hasGuarantors: profile.hasGuarantors,
        occupants: profile.occupants,
        pets: profile.pets,
        smoker: profile.smoker,
        leaseLengthMonths: profile.leaseLengthMonths,
        priorLandlordReference: profile.priorLandlordReference,
      });

      const [lead] = await db.select().from(s.leads).where(eq(s.leads.id, id));
      const [ctx] = await loadLeadContexts([lead], { criteria: [], withIdentities: false });
      return reply.code(201).send(projectLead(viewer, ctx));
    },
  );

  /** Leaving a queue closes the gap behind you. */
  r.delete(
    '/leads/:id',
    {
      onRequest: [app.authenticate],
      schema: { params: z.object({ id: z.string() }), response: { 200: z.object({ ok: z.literal(true) }) } },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const [lead] = await db.select().from(s.leads).where(eq(s.leads.id, request.params.id));

      const mayRemove =
        lead && (lead.seekerId === viewer.userId || scopeFor(viewer, lead.propertyId) === 'owner');
      if (!mayRemove) throw new ApiError('not_found', 'no such lead');

      await db.transaction(async (tx) => {
        await tx.delete(s.leads).where(eq(s.leads.id, lead.id));
        /* Everyone behind them moves up. A queue with holes in it is not a
           queue anybody can trust. */
        await tx
          .update(s.leads)
          .set({ queuePosition: sql`${s.leads.queuePosition} - 1` })
          .where(
            and(
              eq(s.leads.propertyId, lead.propertyId),
              sql`${s.leads.queuePosition} > ${lead.queuePosition}`,
            ),
          );
      });

      return { ok: true as const };
    },
  );

  /* ── Screening presets ───────────────────────────────── */

  r.get(
    '/screening/presets',
    { onRequest: [app.authenticate], schema: { response: { 200: screeningPresetListSchema } } },
    async (request) => {
      const rows = await db
        .select()
        .from(s.screeningPresets)
        .where(eq(s.screeningPresets.ownerId, request.currentUser!.id))
        .orderBy(s.screeningPresets.createdAt);

      return {
        presets: rows.map((p) => ({
          id: p.id,
          name: p.name,
          criteria: p.criteria as ScreeningCriterion[],
          isActive: p.isActive,
          createdAt: p.createdAt.toISOString(),
        })),
      };
    },
  );

  r.patch(
    '/screening/presets/:id',
    {
      onRequest: [app.authenticate],
      schema: {
        params: z.object({ id: z.string() }),
        body: updatePresetSchema,
        response: { 200: screeningPresetListSchema },
      },
    },
    async (request) => {
      const ownerId = request.currentUser!.id;
      const [preset] = await db
        .select()
        .from(s.screeningPresets)
        .where(and(eq(s.screeningPresets.id, request.params.id), eq(s.screeningPresets.ownerId, ownerId)));
      if (!preset) throw new ApiError('not_found', 'no such preset');

      await db
        .update(s.screeningPresets)
        .set({
          criteria: request.body.criteria ?? preset.criteria,
          name: request.body.name ?? preset.name,
          updatedAt: new Date(),
        })
        .where(eq(s.screeningPresets.id, preset.id));

      const rows = await db
        .select()
        .from(s.screeningPresets)
        .where(eq(s.screeningPresets.ownerId, ownerId))
        .orderBy(s.screeningPresets.createdAt);
      return {
        presets: rows.map((p) => ({
          id: p.id,
          name: p.name,
          criteria: p.criteria as ScreeningCriterion[],
          isActive: p.isActive,
          createdAt: p.createdAt.toISOString(),
        })),
      };
    },
  );

  /** Switching preset re-ranks every lead, and says so in the log. */
  r.post(
    '/screening/presets/:id/activate',
    {
      onRequest: [app.authenticate],
      schema: { params: z.object({ id: z.string() }), response: { 200: screeningPresetListSchema } },
    },
    async (request) => {
      const ownerId = request.currentUser!.id;
      const [preset] = await db
        .select()
        .from(s.screeningPresets)
        .where(and(eq(s.screeningPresets.id, request.params.id), eq(s.screeningPresets.ownerId, ownerId)));
      if (!preset) throw new ApiError('not_found', 'no such preset');

      await db.transaction(async (tx) => {
        await tx
          .update(s.screeningPresets)
          .set({ isActive: false })
          .where(eq(s.screeningPresets.ownerId, ownerId));
        await tx
          .update(s.screeningPresets)
          .set({ isActive: true, updatedAt: new Date() })
          .where(eq(s.screeningPresets.id, preset.id));

        await tx.insert(s.screeningAuditLog).values({
          id: newId('audit'),
          ownerId,
          leadName: '—',
          presetName: preset.name,
          action: 'preset_applied',
          detail: `active preset → ${preset.name}`,
          flags: [],
        });
      });

      const rows = await db
        .select()
        .from(s.screeningPresets)
        .where(eq(s.screeningPresets.ownerId, ownerId))
        .orderBy(s.screeningPresets.createdAt);
      return {
        presets: rows.map((p) => ({
          id: p.id,
          name: p.name,
          criteria: p.criteria as ScreeningCriterion[],
          isActive: p.isActive,
          createdAt: p.createdAt.toISOString(),
        })),
      };
    },
  );

  /* ── Audit ───────────────────────────────────────────── */

  r.get(
    '/screening/audit',
    {
      onRequest: [app.authenticate],
      schema: {
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(200).default(60) }),
        response: { 200: auditListSchema },
      },
    },
    async (request) => {
      const ownerId = request.currentUser!.id;

      const [rows, [{ total }]] = await Promise.all([
        db
          .select()
          .from(s.screeningAuditLog)
          .where(eq(s.screeningAuditLog.ownerId, ownerId))
          .orderBy(desc(s.screeningAuditLog.at))
          .limit(request.query.limit),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(s.screeningAuditLog)
          .where(eq(s.screeningAuditLog.ownerId, ownerId)),
      ]);

      const propertyIds = [...new Set(rows.map((r2) => r2.propertyId).filter((x): x is string => Boolean(x)))];
      const properties = propertyIds.length
        ? await db.select().from(s.properties).where(inArray(s.properties.id, propertyIds))
        : [];
      const labelById = new Map(properties.map((p) => [p.id, `${p.street} ${p.houseNumber}`]));

      return {
        total,
        entries: rows.map((e) => ({
          id: e.id,
          at: e.at.toISOString(),
          leadName: e.leadName,
          propertyLabel: e.propertyId ? labelById.get(e.propertyId) ?? null : null,
          presetName: e.presetName,
          action: e.action,
          detail: e.detail,
          flags: e.flags as never,
        })),
      };
    },
  );
}
