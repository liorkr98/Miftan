import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq, isNull, ne } from 'drizzle-orm';
import { z } from 'zod';
import {
  ApiError,
  completeRenewalSchema,
  extendDeadlineSchema,
  listingRequirementsSchema,
  MEETING_MINUTES,
  nextMoveIn,
  offerMeetingSchema,
  renewalAnswersSchema,
  renewalDecisionSchema,
  renewalListSchema,
  renewalQuestionsSchema,
  renewalViewSchema,
  splitWindow,
  t,
  toAgorot,
  zonedWallTime,
  type Amenity,
} from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { resolveViewer, type Viewer } from '../policy/viewer.ts';
import { answerByFor, canChange, cycleForWrite, loadRenewalViews, type CycleAccess } from '../policy/renewals.ts';
import { mailUser } from '../email/notify.ts';

/**
 * Lease turnover — every write is one decision by one person.
 *
 * Each route checks that it is that person's turn, records the answer, and
 * does the consequences in the same transaction: a tenant leaving publishes
 * the date and marks the flat as vacating; the owner confirming requirements
 * lists the flat and invites the people who followed it. Nobody is asked to
 * perform a consequence by hand.
 */

const leaseParams = z.object({ leaseId: z.string() });
const slotParams = z.object({ id: z.string() });

async function viewOf(viewer: Viewer, leaseId: string) {
  const all = await loadRenewalViews(viewer);
  const view = all.find((v) => v.leaseId === leaseId);
  if (!view) throw new ApiError('not_found', 'no such lease');
  return view;
}

function requireRole(access: CycleAccess, role: 'owner' | 'tenant') {
  if (access.role !== role) throw new ApiError('forbidden', `only the ${role} can do this`);
}

function requireStage(access: CycleAccess, stages: (typeof access.cycle.stage)[]) {
  if (!stages.includes(access.cycle.stage)) {
    throw new ApiError('forbidden', `not possible at stage ${access.cycle.stage}`);
  }
}

export async function renewalRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/renewals',
    { onRequest: [app.authenticate], schema: { response: { 200: renewalListSchema } } },
    async (request) => ({ renewals: await loadRenewalViews(await resolveViewer(request.currentUser!.id)) }),
  );

  /** Start before the automatic date — the owner asking early, or the tenant answering early. */
  r.post(
    '/renewals/:leaseId/open',
    { onRequest: [app.authenticate], schema: { params: leaseParams, response: { 200: renewalViewSchema } } },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      await cycleForWrite(viewer, request.params.leaseId, { openEarly: true });
      return viewOf(viewer, request.params.leaseId);
    },
  );

  /**
   * Stay or leave. The tenant decides; the owner may decide "leave" only once
   * the tenant is past their deadline, and "stay" to call off a search when the
   * tenant changed their mind by talking to them.
   */
  r.post(
    '/renewals/:leaseId/decision',
    {
      onRequest: [app.authenticate],
      schema: { params: leaseParams, body: renewalDecisionSchema, response: { 200: renewalViewSchema } },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const access = await cycleForWrite(viewer, request.params.leaseId, { openEarly: true });
      const { lease, property, cycle, role } = access;
      const { decision } = request.body;
      const now = new Date();

      const applicantsOpen = Boolean(cycle.watchersInvitedAt);
      if (role === 'tenant') {
        const open = ['awaiting_tenant', 'questions', 'answered'].includes(cycle.stage);
        if (!open && !(canChange(cycle.stage, applicantsOpen) && cycle.decision !== decision)) {
          throw new ApiError('forbidden', 'this decision can no longer be changed here — talk to your landlord');
        }
      } else {
        const overdue = ['awaiting_tenant', 'answered'].includes(cycle.stage) && now > answerByFor(lease, cycle);
        const ownerMay = (decision === 'leave' && overdue) || (decision === 'stay' && cycle.stage === 'leaving');
        if (!ownerMay) throw new ApiError('forbidden', 'the tenant decides this');
      }

      await db.transaction(async (tx) => {
        await tx
          .update(s.renewalCycles)
          .set({
            stage: decision === 'stay' ? 'staying' : 'leaving',
            decision,
            decidedAt: now,
            moveOutDate: decision === 'leave' ? lease.endDate : null,
            requirementsConfirmedAt: decision === 'stay' ? null : cycle.requirementsConfirmedAt,
            watchersInvitedAt: decision === 'stay' ? null : cycle.watchersInvitedAt,
            updatedAt: now,
          })
          .where(eq(s.renewalCycles.id, cycle.id));

        /* The lease is where every other surface reads intent from; the
           availability signal seekers see is derived from it. */
        await tx
          .update(s.leases)
          .set({ renewalIntent: decision === 'stay' ? 'extend' : 'leave', renewalAskedAt: cycle.openedAt, updatedAt: now })
          .where(eq(s.leases.id, lease.id));

        /* A seeker's availability question about this flat is the same
           question — answer it with this, so the tenant is not asked twice. */
        if (role === 'tenant') {
          await tx
            .update(s.availabilityInquiries)
            .set({ status: 'answered', tenantAnswer: decision === 'stay' ? 'extend' : 'leave', tenantAnsweredAt: now, updatedAt: now })
            .where(and(eq(s.availabilityInquiries.propertyId, property.id), eq(s.availabilityInquiries.status, 'asked_tenant')));
        }

        if (decision === 'leave') {
          await tx
            .update(s.properties)
            .set({ status: 'vacating', availableFrom: nextMoveIn(lease.endDate), availabilityConfidence: 'confirmed', updatedAt: now })
            .where(eq(s.properties.id, property.id));
          /* A signing that will not happen. */
          await tx
            .update(s.renewalMeetingSlots)
            .set({ status: 'cancelled', updatedAt: now })
            .where(and(eq(s.renewalMeetingSlots.cycleId, cycle.id), ne(s.renewalMeetingSlots.status, 'cancelled')));
        } else if (cycle.stage === 'leaving') {
          await tx
            .update(s.properties)
            .set({ status: 'occupied', availableFrom: null, availabilityConfidence: 'unknown', updatedAt: now })
            .where(eq(s.properties.id, property.id));
        }
      });

      if (role === 'tenant') {
        const [tenant] = await db.select({ name: s.users.name }).from(s.users).where(eq(s.users.id, lease.tenantId));
        await mailUser(
          property.ownerId,
          decision === 'stay' ? t.turnoverMail.tenantStaying : t.turnoverMail.tenantLeaving,
          `/owner/properties/${property.id}`,
          { name: tenant?.name ?? '', label: `${property.street} ${property.houseNumber}`.trim() },
        );
      }
      return viewOf(viewer, lease.id);
    },
  );

  /** "I have questions before deciding." */
  r.post(
    '/renewals/:leaseId/questions',
    {
      onRequest: [app.authenticate],
      schema: { params: leaseParams, body: renewalQuestionsSchema, response: { 200: renewalViewSchema } },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const access = await cycleForWrite(viewer, request.params.leaseId, { openEarly: true });
      requireRole(access, 'tenant');
      requireStage(access, ['awaiting_tenant', 'questions', 'answered']);

      const { topics, text } = request.body;
      const questions = [
        ...topics.map((topic) => ({ topic, text: null })),
        ...(text ? [{ topic: 'other' as const, text }] : []),
      ];
      if (questions.length === 0) {
        throw new ApiError('validation_failed', 'ask at least one question', { topics: ['pick a question or write one'] });
      }

      await db
        .update(s.renewalCycles)
        .set({ stage: 'questions', questions, questionsAt: new Date(), answers: [], answersAt: null, updatedAt: new Date() })
        .where(eq(s.renewalCycles.id, access.cycle.id));

      const [tenant] = await db.select({ name: s.users.name }).from(s.users).where(eq(s.users.id, access.lease.tenantId));
      await mailUser(access.property.ownerId, t.turnoverMail.tenantQuestions, `/owner/properties/${access.property.id}`, {
        name: tenant?.name ?? '',
        label: `${access.property.street} ${access.property.houseNumber}`.trim(),
      });
      return viewOf(viewer, access.lease.id);
    },
  );

  /** The owner's answers, and how long the tenant has to decide. */
  r.post(
    '/renewals/:leaseId/answers',
    {
      onRequest: [app.authenticate],
      schema: { params: leaseParams, body: renewalAnswersSchema, response: { 200: renewalViewSchema } },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const access = await cycleForWrite(viewer, request.params.leaseId);
      requireRole(access, 'owner');
      requireStage(access, ['questions', 'answered']);

      const deadline = new Date(request.body.deadline);
      if (Number.isNaN(deadline.getTime()) || deadline <= new Date()) {
        throw new ApiError('validation_failed', 'the deadline must be in the future', { deadline: ['must be in the future'] });
      }

      await db
        .update(s.renewalCycles)
        .set({ stage: 'answered', answers: request.body.answers, answersAt: new Date(), decisionDeadline: deadline, updatedAt: new Date() })
        .where(eq(s.renewalCycles.id, access.cycle.id));

      await mailUser(access.lease.tenantId, t.turnoverMail.answers, '/tenant/renewal');
      return viewOf(viewer, access.lease.id);
    },
  );

  /** More time for the tenant — one tap, no form. */
  r.post(
    '/renewals/:leaseId/deadline',
    {
      onRequest: [app.authenticate],
      schema: { params: leaseParams, body: extendDeadlineSchema, response: { 200: renewalViewSchema } },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const access = await cycleForWrite(viewer, request.params.leaseId);
      requireRole(access, 'owner');
      requireStage(access, ['awaiting_tenant', 'answered']);

      const base = Math.max(Date.now(), answerByFor(access.lease, access.cycle).getTime());
      await db
        .update(s.renewalCycles)
        .set({ decisionDeadline: new Date(base + request.body.days * 86_400_000), updatedAt: new Date() })
        .where(eq(s.renewalCycles.id, access.cycle.id));
      return viewOf(viewer, access.lease.id);
    },
  );

  /** The owner offers times to sign; windows are cut into half-hour slots. */
  r.post(
    '/renewals/:leaseId/meeting-slots',
    {
      onRequest: [app.authenticate],
      schema: { params: leaseParams, body: offerMeetingSchema, response: { 200: renewalViewSchema } },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const access = await cycleForWrite(viewer, request.params.leaseId);
      requireRole(access, 'owner');
      requireStage(access, ['staying']);

      const now = new Date();
      const times = request.body.windows.flatMap((w) =>
        splitWindow(w.from, w.until, MEETING_MINUTES).map((hhmm) => zonedWallTime(w.date, hhmm)),
      ).filter((d) => d > now);
      if (times.length === 0) {
        throw new ApiError('validation_failed', 'none of these times are in the future', { windows: ['pick a future time'] });
      }

      await db
        .insert(s.renewalMeetingSlots)
        .values(times.map((startsAt) => ({ id: newId('meetingSlot'), cycleId: access.cycle.id, startsAt, durationMinutes: MEETING_MINUTES })))
        .onConflictDoNothing();

      await mailUser(access.lease.tenantId, t.turnoverMail.timesOffered, '/tenant/renewal');
      return viewOf(viewer, access.lease.id);
    },
  );

  /**
   * The tenant takes a time. Taking a second one gives the first back, which
   * is what rescheduling is — no separate flow to learn.
   */
  r.post(
    '/renewals/meeting-slots/:id/book',
    { onRequest: [app.authenticate], schema: { params: slotParams, response: { 200: renewalViewSchema } } },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const [slot] = await db.select().from(s.renewalMeetingSlots).where(eq(s.renewalMeetingSlots.id, request.params.id));
      if (!slot) throw new ApiError('not_found', 'no such time');
      const [cycle] = await db.select().from(s.renewalCycles).where(eq(s.renewalCycles.id, slot.cycleId));
      const access = await cycleForWrite(viewer, cycle.leaseId);
      requireRole(access, 'tenant');
      requireStage(access, ['staying']);
      if (slot.startsAt < new Date()) throw new ApiError('forbidden', 'that time has passed');

      await db.transaction(async (tx) => {
        await tx
          .update(s.renewalMeetingSlots)
          .set({ status: 'open', bookedAt: null, updatedAt: new Date() })
          .where(and(eq(s.renewalMeetingSlots.cycleId, cycle.id), eq(s.renewalMeetingSlots.status, 'booked'), ne(s.renewalMeetingSlots.id, slot.id)));
        const claimed = await tx
          .update(s.renewalMeetingSlots)
          .set({ status: 'booked', bookedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(s.renewalMeetingSlots.id, slot.id), eq(s.renewalMeetingSlots.status, 'open')))
          .returning({ id: s.renewalMeetingSlots.id });
        if (claimed.length === 0) throw new ApiError('forbidden', 'that time is no longer available');
      });

      const [tenant] = await db.select({ name: s.users.name }).from(s.users).where(eq(s.users.id, access.lease.tenantId));
      await mailUser(access.property.ownerId, t.turnoverMail.meetingBooked, `/owner/properties/${access.property.id}`, {
        name: tenant?.name ?? '',
        label: `${access.property.street} ${access.property.houseNumber}`.trim(),
      });
      return viewOf(viewer, access.lease.id);
    },
  );

  /** The tenant gives a time back (it reopens); the owner withdraws one. */
  r.post(
    '/renewals/meeting-slots/:id/cancel',
    { onRequest: [app.authenticate], schema: { params: slotParams, response: { 200: renewalViewSchema } } },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const [slot] = await db.select().from(s.renewalMeetingSlots).where(eq(s.renewalMeetingSlots.id, request.params.id));
      if (!slot) throw new ApiError('not_found', 'no such time');
      const [cycle] = await db.select().from(s.renewalCycles).where(eq(s.renewalCycles.id, slot.cycleId));
      const access = await cycleForWrite(viewer, cycle.leaseId);

      await db
        .update(s.renewalMeetingSlots)
        .set(access.role === 'tenant' ? { status: 'open', bookedAt: null, updatedAt: new Date() } : { status: 'cancelled', updatedAt: new Date() })
        .where(eq(s.renewalMeetingSlots.id, slot.id));
      return viewOf(viewer, access.lease.id);
    },
  );

  /**
   * "Would you like to change anything before we start finding your next
   * tenant?" Only what changed is sent; an empty body is "no changes".
   * Either way the flat is listed and the people following it are invited.
   */
  r.post(
    '/renewals/:leaseId/requirements',
    {
      onRequest: [app.authenticate],
      schema: { params: leaseParams, body: listingRequirementsSchema, response: { 200: renewalViewSchema } },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const access = await cycleForWrite(viewer, request.params.leaseId);
      requireRole(access, 'owner');
      requireStage(access, ['leaving']);
      const { property, cycle } = access;
      const b = request.body;
      const now = new Date();

      const amenities = new Set<Amenity>(property.amenities as Amenity[]);
      if (b.petsAllowed !== undefined) (b.petsAllowed ? amenities.add('pets_allowed') : amenities.delete('pets_allowed'));
      if (b.furnished !== undefined) (b.furnished ? amenities.add('furnished') : amenities.delete('furnished'));

      const firstOpen = !cycle.watchersInvitedAt;
      await db.transaction(async (tx) => {
        await tx
          .update(s.properties)
          .set({
            ...(b.monthlyRent !== undefined ? { monthlyRentAgorot: toAgorot(b.monthlyRent) } : {}),
            ...(b.availableFrom !== undefined ? { availableFrom: b.availableFrom } : {}),
            ...(b.minLeaseMonths !== undefined ? { minLeaseMonths: b.minLeaseMonths } : {}),
            ...(b.smokingAllowed !== undefined ? { smokingAllowed: b.smokingAllowed } : {}),
            ...(b.maxOccupants !== undefined ? { maxOccupants: b.maxOccupants } : {}),
            amenities: [...amenities],
            listed: true,
            updatedAt: now,
          })
          .where(eq(s.properties.id, property.id));
        await tx
          .update(s.renewalCycles)
          .set({ requirementsConfirmedAt: now, watchersInvitedAt: cycle.watchersInvitedAt ?? now, updatedAt: now })
          .where(eq(s.renewalCycles.id, cycle.id));
      });

      /* Everyone who asked to hear when this flat frees up hears now. */
      if (firstOpen) {
        const watchers = await db
          .select({ seekerId: s.leads.seekerId })
          .from(s.leads)
          .where(and(eq(s.leads.propertyId, property.id), eq(s.leads.watchOnly, true), isNull(s.leads.deletedAt)));
        const label = `${property.street} ${property.houseNumber}`.trim();
        for (const w of watchers) await mailUser(w.seekerId, t.turnoverMail.applyInvite, `/search/${property.id}`, { label });
      }
      return viewOf(viewer, access.lease.id);
    },
  );

  /** The signing happened: the lease runs on, with the agreed rent. */
  r.post(
    '/renewals/:leaseId/complete',
    {
      onRequest: [app.authenticate],
      schema: { params: leaseParams, body: completeRenewalSchema, response: { 200: renewalViewSchema } },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const access = await cycleForWrite(viewer, request.params.leaseId);
      requireRole(access, 'owner');
      requireStage(access, ['staying']);
      const { lease, cycle } = access;
      if (request.body.newEndDate <= lease.endDate) {
        throw new ApiError('validation_failed', 'the new end date must be after the current one', { newEndDate: ['must be later'] });
      }
      const now = new Date();

      await db.transaction(async (tx) => {
        await tx
          .update(s.leases)
          .set({
            endDate: request.body.newEndDate,
            monthlyRentAgorot: toAgorot(request.body.monthlyRent),
            renewalIntent: null,
            renewalAskedAt: null,
            updatedAt: now,
          })
          .where(eq(s.leases.id, lease.id));
        await tx
          .update(s.renewalCycles)
          .set({ stage: 'renewed', renewedAt: now, newEndDate: request.body.newEndDate, updatedAt: now })
          .where(eq(s.renewalCycles.id, cycle.id));
        await tx
          .update(s.properties)
          .set({ status: 'occupied', availableFrom: null, availabilityConfidence: 'unknown', updatedAt: now })
          .where(eq(s.properties.id, lease.propertyId));
        /* Times nobody took are no longer on offer. */
        await tx
          .update(s.renewalMeetingSlots)
          .set({ status: 'cancelled', updatedAt: now })
          .where(and(eq(s.renewalMeetingSlots.cycleId, cycle.id), eq(s.renewalMeetingSlots.status, 'open')));
      });

      await mailUser(lease.tenantId, t.turnoverMail.renewed, '/tenant/renewal', {
        label: `${access.property.street} ${access.property.houseNumber}`.trim(),
      });
      return viewOf(viewer, lease.id);
    },
  );
}

