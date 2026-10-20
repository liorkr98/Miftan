import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, count, countDistinct, eq, gte, inArray, isNotNull, isNull, lt, lte } from 'drizzle-orm';
import {
  ApiError,
  analyticsQuerySchema,
  israelToday,
  passesScreening,
  portfolioAnalyticsSchema,
  portfolioSnapshotSchema,
  zonedWallTime,
  type Appointment,
  type Funnel,
} from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { resolveViewer } from '../policy/viewer.ts';
import { activeCriteria, evaluate, loadLeadContexts } from '../policy/leads.ts';

type LeadRow = typeof s.leads.$inferSelect;
type PropertyRow = typeof s.properties.$inferSelect;

const DAY_MS = 86_400_000;
const label = (p: PropertyRow) => `${p.street} ${p.houseNumber}`.trim();

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * The owner's portfolio: what is happening now, and how interest moved over a
 * period. Read-only and owner-only — a stranger gets an empty portfolio, not
 * an error, because "owns nothing" is a real state.
 */
export async function portfolioRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/portfolio/snapshot',
    { onRequest: [app.authenticate], schema: { response: { 200: portfolioSnapshotSchema } } },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const properties = await ownedProperties([...viewer.ownedPropertyIds]);
      if (properties.length === 0) return { properties: [], agenda: [] };
      const ids = properties.map((p) => p.id);

      const now = new Date();
      const today = israelToday();
      const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
      const inAWeek = new Date(now.getTime() + 7 * DAY_MS);

      const [leads, slots, views, meetings] = await Promise.all([
        db.select().from(s.leads).where(and(inArray(s.leads.propertyId, ids), isNull(s.leads.deletedAt))),
        db.select().from(s.viewingSlots).where(inArray(s.viewingSlots.propertyId, ids)),
        db
          .select({ propertyId: s.listingViews.propertyId, day: s.listingViews.day, n: count() })
          .from(s.listingViews)
          .where(and(inArray(s.listingViews.propertyId, ids), gte(s.listingViews.day, addDays(today, -13))))
          .groupBy(s.listingViews.propertyId, s.listingViews.day),
        db
          .select({ slot: s.renewalMeetingSlots, propertyId: s.renewalCycles.propertyId, leaseId: s.renewalCycles.leaseId })
          .from(s.renewalMeetingSlots)
          .innerJoin(s.renewalCycles, eq(s.renewalCycles.id, s.renewalMeetingSlots.cycleId))
          .where(
            and(
              inArray(s.renewalCycles.propertyId, ids),
              eq(s.renewalMeetingSlots.status, 'booked'),
              gte(s.renewalMeetingSlots.startsAt, now),
            ),
          ),
      ]);

      const applicants = leads.filter((l) => !l.watchOnly && l.stage !== 'rejected');
      const relevantIds = await relevantLeadIds(viewer.userId, applicants);
      const heldBy = new Set(slots.filter((x) => x.leadId && x.status !== 'cancelled' && x.status !== 'open').map((x) => x.leadId));
      const future = slots.filter((x) => x.startsAt >= now);

      const snapshot = properties.map((p) => {
        const mine = applicants.filter((l) => l.propertyId === p.id);
        const relevant = mine.filter((l) => relevantIds.has(l.id));
        const upcoming = future.filter((x) => x.propertyId === p.id && x.status === 'booked');
        const meetingTimes = meetings.filter((m) => m.propertyId === p.id).map((m) => m.slot.startsAt);
        const next = [...upcoming.map((x) => x.startsAt), ...meetingTimes].sort((a, b) => a.getTime() - b.getTime())[0];
        const viewsIn = (from: number, to: number) =>
          views
            .filter((v) => v.propertyId === p.id && v.day >= addDays(today, from) && v.day <= addDays(today, to))
            .reduce((sum, v) => sum + Number(v.n), 0);
        return {
          propertyId: p.id,
          applicants: mine.length,
          relevant: relevant.length,
          newRelevant: relevant.filter((l) => l.createdAt >= weekAgo).length,
          relevantWithoutViewing: relevant.filter((l) => !heldBy.has(l.id)).length,
          alerts: leads.filter((l) => l.propertyId === p.id && l.watchOnly).length,
          upcomingViewings: upcoming.length,
          openSlots: future.filter((x) => x.propertyId === p.id && x.status === 'open').length,
          nextAppointmentAt: next?.toISOString() ?? null,
          views7d: viewsIn(-6, 0),
          viewsPrev7d: viewsIn(-13, -7),
        };
      });

      /* The week ahead, by name: the owner booked these people in, or they
         booked themselves into the owner's own times. */
      const weekViewings = future.filter((x) => x.status === 'booked' && x.leadId && x.startsAt <= inAWeek);
      const weekMeetings = meetings.filter((m) => m.slot.startsAt <= inAWeek);
      const leadById = new Map(leads.map((l) => [l.id, l]));
      const leases = weekMeetings.length
        ? await db.select().from(s.leases).where(inArray(s.leases.id, weekMeetings.map((m) => m.leaseId)))
        : [];
      const userIds = [
        ...weekViewings.map((x) => leadById.get(x.leadId!)?.seekerId).filter((x): x is string => Boolean(x)),
        ...leases.map((l) => l.tenantId),
      ];
      const users = userIds.length
        ? await db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(inArray(s.users.id, userIds))
        : [];
      const nameOf = new Map(users.map((u) => [u.id, u.name]));
      const leaseById = new Map(leases.map((l) => [l.id, l]));
      const byId = new Map(properties.map((p) => [p.id, p]));

      const agenda: Appointment[] = [
        ...weekViewings.map((x) => ({
          id: x.id,
          kind: 'viewing' as const,
          propertyId: x.propertyId,
          propertyLabel: label(byId.get(x.propertyId)!),
          startsAt: x.startsAt.toISOString(),
          durationMinutes: x.durationMinutes,
          personName: nameOf.get(leadById.get(x.leadId!)?.seekerId ?? '') ?? '—',
        })),
        ...weekMeetings.map((m) => ({
          id: m.slot.id,
          kind: 'renewal_meeting' as const,
          propertyId: m.propertyId,
          propertyLabel: label(byId.get(m.propertyId)!),
          startsAt: m.slot.startsAt.toISOString(),
          durationMinutes: m.slot.durationMinutes,
          personName: nameOf.get(leaseById.get(m.leaseId)?.tenantId ?? '') ?? '—',
        })),
      ].sort((a, b) => a.startsAt.localeCompare(b.startsAt));

      return { properties: snapshot, agenda };
    },
  );

  r.get(
    '/portfolio/analytics',
    {
      onRequest: [app.authenticate],
      schema: { querystring: analyticsQuerySchema, response: { 200: portfolioAnalyticsSchema } },
    },
    async (request) => {
      const { from, to } = request.query;
      if (from > to) throw new ApiError('validation_failed', 'from is after to', { from: ['must be on or before to'] });
      const span = Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;
      if (span > 400) throw new ApiError('validation_failed', 'range too long', { from: ['at most 400 days'] });

      const viewer = await resolveViewer(request.currentUser!.id);
      const properties = await ownedProperties([...viewer.ownedPropertyIds]);
      const days = Array.from({ length: span }, (_, i) => addDays(from, i));
      const empty: Funnel = { uniqueViewers: 0, views: 0, alerts: 0, applications: 0, relevant: 0, viewingsBooked: 0, viewingsCompleted: 0 };
      if (properties.length === 0) return { from, to, properties: [], portfolio: empty };
      const ids = properties.map((p) => p.id);

      /* Whole Israeli days, so "today" in the chart is the same day the
         listing counted the view on. */
      const start = zonedWallTime(from, '00:00');
      const end = zonedWallTime(addDays(to, 1), '00:00');
      const inRange = and(gte(s.listingViews.day, from), lte(s.listingViews.day, to));

      const [daily, uniques, [portfolioUnique], leads, booked, completed] = await Promise.all([
        db
          .select({ propertyId: s.listingViews.propertyId, day: s.listingViews.day, n: count() })
          .from(s.listingViews)
          .where(and(inArray(s.listingViews.propertyId, ids), inRange))
          .groupBy(s.listingViews.propertyId, s.listingViews.day),
        db
          .select({ propertyId: s.listingViews.propertyId, n: countDistinct(s.listingViews.viewerKey) })
          .from(s.listingViews)
          .where(and(inArray(s.listingViews.propertyId, ids), inRange))
          .groupBy(s.listingViews.propertyId),
        db
          .select({ n: countDistinct(s.listingViews.viewerKey) })
          .from(s.listingViews)
          .where(and(inArray(s.listingViews.propertyId, ids), inRange)),
        db
          .select()
          .from(s.leads)
          .where(and(inArray(s.leads.propertyId, ids), isNull(s.leads.deletedAt), gte(s.leads.createdAt, start), lt(s.leads.createdAt, end))),
        db
          .select({ propertyId: s.viewingSlots.propertyId, n: count() })
          .from(s.viewingSlots)
          .where(
            and(
              inArray(s.viewingSlots.propertyId, ids),
              isNotNull(s.viewingSlots.leadId),
              inArray(s.viewingSlots.status, ['booked', 'attended', 'no_show']),
              gte(s.viewingSlots.bookedAt, start),
              lt(s.viewingSlots.bookedAt, end),
            ),
          )
          .groupBy(s.viewingSlots.propertyId),
        db
          .select({ propertyId: s.viewingSlots.propertyId, n: count() })
          .from(s.viewingSlots)
          .where(
            and(
              inArray(s.viewingSlots.propertyId, ids),
              eq(s.viewingSlots.status, 'attended'),
              gte(s.viewingSlots.startsAt, start),
              lt(s.viewingSlots.startsAt, end),
            ),
          )
          .groupBy(s.viewingSlots.propertyId),
      ]);

      const applications = leads.filter((l) => !l.watchOnly);
      const relevantIds = await relevantLeadIds(viewer.userId, applications);
      const per = (rows: { propertyId: string; n: number }[], id: string) =>
        Number(rows.find((x) => x.propertyId === id)?.n ?? 0);

      const out = properties.map((p) => {
        const byDay = new Map(daily.filter((d) => d.propertyId === p.id).map((d) => [d.day, Number(d.n)]));
        const series = days.map((date) => ({ date, views: byDay.get(date) ?? 0 }));
        const mine = applications.filter((l) => l.propertyId === p.id);
        return {
          propertyId: p.id,
          label: label(p),
          daily: series,
          funnel: {
            uniqueViewers: per(uniques, p.id),
            views: series.reduce((sum, d) => sum + d.views, 0),
            alerts: leads.filter((l) => l.propertyId === p.id && l.watchOnly).length,
            applications: mine.length,
            relevant: mine.filter((l) => relevantIds.has(l.id)).length,
            viewingsBooked: per(booked, p.id),
            viewingsCompleted: per(completed, p.id),
          },
        };
      });

      const total = (k: keyof Funnel) => out.reduce((sum, p) => sum + p.funnel[k], 0);
      return {
        from,
        to,
        properties: out,
        portfolio: {
          uniqueViewers: Number(portfolioUnique?.n ?? 0),
          views: total('views'),
          alerts: total('alerts'),
          applications: total('applications'),
          relevant: total('relevant'),
          viewingsBooked: total('viewingsBooked'),
          viewingsCompleted: total('viewingsCompleted'),
        },
      };
    },
  );
}

async function ownedProperties(ids: string[]): Promise<PropertyRow[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(s.properties)
    .where(and(inArray(s.properties.id, ids), isNull(s.properties.deletedAt)));
  return rows.sort((a, b) => label(a).localeCompare(label(b), 'he'));
}

/** Applications that clear the owner's requirements — the same test the applicants tab ranks by. */
async function relevantLeadIds(ownerId: string, applications: LeadRow[]): Promise<Set<string>> {
  if (applications.length === 0) return new Set();
  const { criteria } = await activeCriteria(ownerId);
  const contexts = await loadLeadContexts(applications, { criteria, withIdentities: false });
  return new Set(contexts.filter((ctx) => passesScreening(evaluate(ctx).flags)).map((ctx) => ctx.lead.id));
}
