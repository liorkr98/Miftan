import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, asc, eq, gte, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  ApiError,
  bookSlotSchema,
  inviteToSlotSchema,
  markAttendanceSchema,
  passesScreening,
  publishSlotsSchema,
  slotListSchema,
  slotViewSchema,
  upcomingBriefingsSchema,
  type OwnerSlot,
  type SeekerSlot,
  type SlotView,
} from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { resolveViewer, scopeFor, type Viewer } from '../policy/viewer.ts';
import { activeCriteria, evaluate, loadLeadContexts } from '../policy/leads.ts';

type SlotRow = typeof s.viewingSlots.$inferSelect;
type PropertyRow = typeof s.properties.$inferSelect;

export async function viewingRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  /**
   * The schedule for one property.
   *
   * The owner gets names; an applicant gets times and whether each is free.
   * Knowing *who* holds the other slots would turn a viewing into an auction
   * before anybody has applied.
   */
  r.get(
    '/viewings/:propertyId',
    {
      onRequest: [app.authenticate],
      schema: { params: z.object({ propertyId: z.string() }), response: { 200: slotListSchema } },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const { propertyId } = request.params;

      const [property] = await db
        .select()
        .from(s.properties)
        .where(and(eq(s.properties.id, propertyId), isNull(s.properties.deletedAt)));
      if (!property) throw new ApiError('not_found', 'no such property');

      const isOwner = scopeFor(viewer, propertyId) === 'owner';
      const rows = await db
        .select()
        .from(s.viewingSlots)
        .where(
          and(
            eq(s.viewingSlots.propertyId, propertyId),
            /* Applicants see what is still ahead; the owner keeps the history. */
            isOwner ? undefined : gte(s.viewingSlots.startsAt, new Date()),
          ),
        )
        .orderBy(asc(s.viewingSlots.startsAt));

      if (isOwner) {
        return {
          slots: await projectForOwner(rows, property),
          eligible: null,
          ineligibleReason: null,
        };
      }

      /* An applicant only sees a schedule if they are actually in the queue. */
      const [lead] = await db
        .select()
        .from(s.leads)
        .where(
          and(
            eq(s.leads.propertyId, propertyId),
            eq(s.leads.seekerId, viewer.userId),
            isNull(s.leads.deletedAt),
          ),
        );
      if (!lead) throw new ApiError('not_found', 'no such property');

      const { eligible, reason } = await eligibilityOf(lead, property);

      const slots: SeekerSlot[] = rows.map((slot) => ({
        scope: 'seeker',
        id: slot.id,
        propertyId,
        propertyLabel: label(property),
        startsAt: slot.startsAt.toISOString(),
        durationMinutes: slot.durationMinutes,
        taken: slot.status !== 'open' && slot.status !== 'cancelled',
        mine: slot.leadId === lead.id,
      }));

      return { slots, eligible, ineligibleReason: eligible ? null : reason };
    },
  );

  /**
   * Publishing a block of times.
   *
   * A window and a rhythm, not one slot at a time: an owner setting aside
   * Tuesday afternoon means eight viewings, and making them create eight
   * separately is how a feature goes unused.
   */
  r.post(
    '/viewings',
    {
      onRequest: [app.authenticate],
      schema: { body: publishSlotsSchema, response: { 201: slotListSchema } },
    },
    async (request, reply) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const { propertyId, date, from, until, durationMinutes, gapMinutes } = request.body;
      if (scopeFor(viewer, propertyId) !== 'owner') throw new ApiError('not_found', 'no such property');

      const start = new Date(`${date}T${from}:00`);
      const end = new Date(`${date}T${until}:00`);
      if (!(start < end)) {
        throw new ApiError('validation_failed', 'the window ends before it starts', {
          until: ['must be after `from`'],
        });
      }

      const wanted: Date[] = [];
      const step = (durationMinutes + gapMinutes) * 60_000;
      for (let t = start.getTime(); t + durationMinutes * 60_000 <= end.getTime(); t += step) {
        wanted.push(new Date(t));
      }
      if (wanted.length === 0) {
        throw new ApiError('validation_failed', 'the window is shorter than one viewing', {
          until: ['not enough time for a single slot'],
        });
      }

      /* Republishing the same afternoon must not double the schedule, and must
         not disturb a slot somebody has already taken. */
      const existing = await db
        .select({ startsAt: s.viewingSlots.startsAt })
        .from(s.viewingSlots)
        .where(
          and(
            eq(s.viewingSlots.propertyId, propertyId),
            inArray(s.viewingSlots.startsAt, wanted),
          ),
        );
      const taken = new Set(existing.map((e) => e.startsAt.getTime()));
      const fresh = wanted.filter((d) => !taken.has(d.getTime()));

      if (fresh.length) {
        await db.insert(s.viewingSlots).values(
          fresh.map((startsAt) => ({
            id: newId('viewingSlot'),
            propertyId,
            ownerId: viewer.userId,
            startsAt,
            durationMinutes,
          })),
        );
      }

      const [property] = await db.select().from(s.properties).where(eq(s.properties.id, propertyId));
      const rows = await db
        .select()
        .from(s.viewingSlots)
        .where(eq(s.viewingSlots.propertyId, propertyId))
        .orderBy(asc(s.viewingSlots.startsAt));

      return reply.code(201).send({
        slots: await projectForOwner(rows, property),
        eligible: null,
        ineligibleReason: null,
      });
    },
  );

  /** An applicant taking a time. */
  r.post(
    '/viewings/:id/book',
    {
      onRequest: [app.authenticate],
      schema: {
        params: z.object({ id: z.string() }),
        body: bookSlotSchema,
        response: { 200: slotViewSchema },
      },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const [slot] = await db.select().from(s.viewingSlots).where(eq(s.viewingSlots.id, request.params.id));
      if (!slot) throw new ApiError('not_found', 'no such slot');

      const [lead] = await db.select().from(s.leads).where(eq(s.leads.id, request.body.leadId));
      /* The lead has to be theirs, and on this property. */
      if (!lead || lead.seekerId !== viewer.userId || lead.propertyId !== slot.propertyId) {
        throw new ApiError('not_found', 'no such slot');
      }
      if (slot.status !== 'open') throw new ApiError('forbidden', 'that time has been taken');
      if (slot.startsAt < new Date()) throw new ApiError('forbidden', 'that time has passed');

      const [property] = await db.select().from(s.properties).where(eq(s.properties.id, slot.propertyId));
      const { eligible, reason } = await eligibilityOf(lead, property);
      if (!eligible) throw new ApiError('forbidden', reason);

      await claim(slot.id, lead.id, { invitedByOwner: false, note: null });
      return oneForViewer(viewer, slot.id);
    },
  );

  /**
   * The owner putting someone in a slot.
   *
   * Including someone who did not clear the filters — screening is soft here
   * and always has been. The override is a named flag rather than a
   * click-through, and it is recorded on the slot, because it is the owner
   * setting aside their own rule and they should be able to see that they did.
   */
  r.post(
    '/viewings/:id/invite',
    {
      onRequest: [app.authenticate],
      schema: {
        params: z.object({ id: z.string() }),
        body: inviteToSlotSchema,
        response: { 200: slotViewSchema },
      },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const slot = await ownedSlot(viewer, request.params.id);
      if (slot.status !== 'open') throw new ApiError('forbidden', 'that time has been taken');

      const [lead] = await db.select().from(s.leads).where(eq(s.leads.id, request.body.leadId));
      if (!lead || lead.propertyId !== slot.propertyId) throw new ApiError('not_found', 'no such applicant');

      const [property] = await db.select().from(s.properties).where(eq(s.properties.id, slot.propertyId));
      const { eligible, reason } = await eligibilityOf(lead, property);

      if (!eligible && !request.body.overrideScreening) {
        throw new ApiError('validation_failed', reason, {
          overrideScreening: ['this applicant did not clear your filters'],
        });
      }

      await claim(slot.id, lead.id, {
        invitedByOwner: !eligible,
        note: request.body.note ?? null,
      });
      return oneForViewer(viewer, slot.id);
    },
  );

  /** Giving a time back. Either side may. */
  r.post(
    '/viewings/:id/cancel',
    {
      onRequest: [app.authenticate],
      schema: { params: z.object({ id: z.string() }), response: { 200: slotViewSchema } },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const [slot] = await db.select().from(s.viewingSlots).where(eq(s.viewingSlots.id, request.params.id));
      if (!slot) throw new ApiError('not_found', 'no such slot');

      const isOwner = scopeFor(viewer, slot.propertyId) === 'owner';
      const holder = slot.leadId
        ? await db.select().from(s.leads).where(eq(s.leads.id, slot.leadId)).then((r2) => r2[0])
        : null;
      const isMine = holder?.seekerId === viewer.userId;
      if (!isOwner && !isMine) throw new ApiError('not_found', 'no such slot');

      /* An applicant giving a slot back reopens it for somebody else; an owner
         cancelling withdraws the time entirely. */
      await db
        .update(s.viewingSlots)
        .set(
          isOwner && !isMine
            ? { status: 'cancelled', updatedAt: new Date() }
            : { status: 'open', leadId: null, bookedAt: null, invitedByOwner: false, updatedAt: new Date() },
        )
        .where(eq(s.viewingSlots.id, slot.id));

      return oneForViewer(viewer, slot.id);
    },
  );

  r.post(
    '/viewings/:id/attendance',
    {
      onRequest: [app.authenticate],
      schema: {
        params: z.object({ id: z.string() }),
        body: markAttendanceSchema,
        response: { 200: slotViewSchema },
      },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const slot = await ownedSlot(viewer, request.params.id);
      if (!slot.leadId) throw new ApiError('forbidden', 'nobody was booked into that time');

      await db.transaction(async (tx) => {
        await tx
          .update(s.viewingSlots)
          .set({ status: request.body.status, updatedAt: new Date() })
          .where(eq(s.viewingSlots.id, slot.id));

        /* Turning up moves the applicant along the pipeline; not turning up
           does not move them back. That is the owner's call, not a rule. */
        if (request.body.status === 'attended') {
          await tx
            .update(s.leads)
            .set({ stage: 'viewed', updatedAt: new Date() })
            .where(eq(s.leads.id, slot.leadId!));
        }
      });

      return oneForViewer(viewer, slot.id);
    },
  );

  /**
   * What the owner needs before they walk up the stairs.
   *
   * Turning up to a viewing having forgotten which of six applicants this one
   * is, is the ordinary experience of letting a flat. It is fixable with a
   * screen: the name, what they asked for, how they scored and on which
   * criteria. This is the payload a reminder would carry.
   */
  r.get(
    '/viewings/upcoming/briefings',
    {
      onRequest: [app.authenticate],
      schema: {
        querystring: z.object({ withinHours: z.coerce.number().int().min(1).max(168).default(24) }),
        response: { 200: upcomingBriefingsSchema },
      },
    },
    async (request) => {
      const ownerId = request.currentUser!.id;
      const until = new Date(Date.now() + request.query.withinHours * 3_600_000);

      const rows = await db
        .select()
        .from(s.viewingSlots)
        .where(
          and(
            eq(s.viewingSlots.ownerId, ownerId),
            eq(s.viewingSlots.status, 'booked'),
            gte(s.viewingSlots.startsAt, new Date()),
          ),
        )
        .orderBy(asc(s.viewingSlots.startsAt));

      const soon = rows.filter((slot) => slot.startsAt <= until && slot.leadId);
      if (soon.length === 0) return { briefings: [] };

      const [leads, properties, { criteria }] = await Promise.all([
        db.select().from(s.leads).where(inArray(s.leads.id, soon.map((x) => x.leadId!))),
        db.select().from(s.properties).where(inArray(s.properties.id, soon.map((x) => x.propertyId))),
        activeCriteria(ownerId),
      ]);

      const contexts = await loadLeadContexts(leads, { criteria, withIdentities: true });
      const byLead = new Map(contexts.map((c) => [c.lead.id, c]));
      const propertyById = new Map(properties.map((p) => [p.id, p]));

      return {
        briefings: soon.flatMap((slot) => {
          const ctx = byLead.get(slot.leadId!);
          const property = propertyById.get(slot.propertyId);
          if (!ctx || !property) return [];
          const { flags, score } = evaluate(ctx);
          return [
            {
              slotId: slot.id,
              startsAt: slot.startsAt.toISOString(),
              propertyLabel: label(property),
              applicant: ctx.seeker
                ? { id: ctx.seeker.id, name: ctx.seeker.name, phone: ctx.seeker.phone }
                : { id: '', name: '—', phone: null },
              about: ctx.about ?? null,
              desiredMoveIn: ctx.lead.desiredMoveIn,
              queuePosition: ctx.lead.queuePosition,
              screening: {
                incomeToRentRatio: Number(ctx.lead.incomeToRentRatio),
                employment: ctx.lead.employment,
                hasGuarantors: ctx.lead.hasGuarantors,
                occupants: ctx.lead.occupants,
                pets: ctx.lead.pets,
                smoker: ctx.lead.smoker,
                leaseLengthMonths: ctx.lead.leaseLengthMonths,
                priorLandlordReference: ctx.lead.priorLandlordReference,
              },
              flags,
              score,
              invitedByOwner: slot.invitedByOwner,
              note: slot.note,
            },
          ];
        }),
      };
    },
  );
}

/* ── helpers ─────────────────────────────────────────────── */

const label = (p: PropertyRow) => `${p.street} ${p.houseNumber}`;

async function claim(slotId: string, leadId: string, extra: { invitedByOwner: boolean; note: string | null }) {
  await db.transaction(async (tx) => {
    /* Guarded on `status = 'open'` inside the write, not only checked before
       it: two applicants tapping the same time at once must not both get it. */
    const claimed = await tx
      .update(s.viewingSlots)
      .set({ status: 'booked', leadId, bookedAt: new Date(), updatedAt: new Date(), ...extra })
      .where(and(eq(s.viewingSlots.id, slotId), eq(s.viewingSlots.status, 'open')))
      .returning({ id: s.viewingSlots.id });

    if (claimed.length === 0) throw new ApiError('forbidden', 'that time has been taken');

    await tx
      .update(s.leads)
      .set({ stage: 'viewing_scheduled', updatedAt: new Date() })
      .where(and(eq(s.leads.id, leadId), eq(s.leads.stage, 'new')));
  });
}

async function eligibilityOf(
  lead: typeof s.leads.$inferSelect,
  property: PropertyRow,
): Promise<{ eligible: boolean; reason: string }> {
  const { criteria } = await activeCriteria(property.ownerId);
  /* No criteria configured means no filter to fail. */
  if (criteria.length === 0) return { eligible: true, reason: '' };

  const [ctx] = await loadLeadContexts([lead], { criteria, withIdentities: false });
  const { flags } = evaluate(ctx);
  if (passesScreening(flags)) return { eligible: true, reason: '' };

  const failed = flags.filter((f) => !f.passed).map((f) => f.note);
  return {
    eligible: false,
    /* Says which criterion, not just "no". A refusal without a reason is the
       worst version of this screen. */
    reason: failed.join(' · '),
  };
}

async function ownedSlot(viewer: Viewer, id: string): Promise<SlotRow> {
  const [slot] = await db.select().from(s.viewingSlots).where(eq(s.viewingSlots.id, id));
  if (!slot || scopeFor(viewer, slot.propertyId) !== 'owner') {
    throw new ApiError('not_found', 'no such slot');
  }
  return slot;
}

async function projectForOwner(rows: SlotRow[], property: PropertyRow): Promise<OwnerSlot[]> {
  const leadIds = rows.map((r) => r.leadId).filter((x): x is string => Boolean(x));
  const applicants = leadIds.length
    ? await db
        .select({ leadId: s.leads.id, id: s.users.id, name: s.users.name, phone: s.users.phone })
        .from(s.leads)
        .innerJoin(s.users, eq(s.users.id, s.leads.seekerId))
        .where(inArray(s.leads.id, leadIds))
    : [];
  const byLead = new Map(applicants.map((a) => [a.leadId, a]));

  return rows.map((slot) => {
    const a = slot.leadId ? byLead.get(slot.leadId) : undefined;
    return {
      scope: 'owner',
      id: slot.id,
      propertyId: property.id,
      propertyLabel: label(property),
      startsAt: slot.startsAt.toISOString(),
      durationMinutes: slot.durationMinutes,
      status: slot.status,
      note: slot.note,
      applicant: a ? { id: a.id, name: a.name, phone: a.phone } : null,
      leadId: slot.leadId,
      invitedByOwner: slot.invitedByOwner,
      bookedAt: slot.bookedAt?.toISOString() ?? null,
    };
  });
}

async function oneForViewer(viewer: Viewer, slotId: string): Promise<SlotView> {
  const [slot] = await db.select().from(s.viewingSlots).where(eq(s.viewingSlots.id, slotId));
  const [property] = await db.select().from(s.properties).where(eq(s.properties.id, slot.propertyId));

  if (scopeFor(viewer, slot.propertyId) === 'owner') {
    const [view] = await projectForOwner([slot], property);
    return view;
  }

  const [lead] = slot.leadId
    ? await db.select().from(s.leads).where(eq(s.leads.id, slot.leadId))
    : [undefined];

  return {
    scope: 'seeker',
    id: slot.id,
    propertyId: property.id,
    propertyLabel: label(property),
    startsAt: slot.startsAt.toISOString(),
    durationMinutes: slot.durationMinutes,
    taken: slot.status !== 'open' && slot.status !== 'cancelled',
    mine: lead?.seekerId === viewer.userId,
  };
}
