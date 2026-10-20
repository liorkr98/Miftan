import { and, eq, gt, inArray, isNotNull, isNull } from 'drizzle-orm';
import { passesScreening, type NotificationView, type RenewalView } from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { loadRenewalViews } from './renewals.ts';
import { activeCriteria, evaluate, loadLeadContexts } from './leads.ts';
import type { Viewer } from './viewer.ts';

/**
 * The turnover part of the notification feed, derived from the cycle rows and
 * the viewing schedule. Reminders are items whose time has come: "the answer
 * is due in two days" appears two days before, and nothing has to send it.
 */

type Item = Omit<NotificationView, 'unread'> & { atDate: Date };

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Nudge a tenant who has not answered after a week. */
const REMINDER_AFTER = 7 * DAY;
/** Warn before a deadline. */
const DEADLINE_WARNING = 2 * DAY;
/** "Tomorrow" for viewings and signings. */
const SOON = DAY;

function item(
  id: string,
  kind: NotificationView['kind'],
  role: NotificationView['role'],
  at: Date,
  r: { propertyLabel: string },
  href: string,
  extra: { detail?: string | null; date?: string | null } = {},
): Item {
  return {
    id, kind, role, at: at.toISOString(), atDate: at,
    propertyLabel: r.propertyLabel, detail: extra.detail ?? null, date: extra.date ?? null, href,
  };
}

export async function turnoverItems(viewer: Viewer, since: Date, now: Date = new Date()): Promise<Item[]> {
  const items: Item[] = [];
  const views: RenewalView[] = await loadRenewalViews(viewer, now);

  for (const v of views) {
    const ownerHref = `/owner/properties/${v.propertyId}`;
    if (v.role === 'owner') {
      const decidedAt = v.decidedAt ? new Date(v.decidedAt) : null;
      if (v.stage === 'staying' && decidedAt && v.ownerStep === 'offer_meeting_times') {
        items.push(item(`t-stay:${v.leaseId}:${v.decidedAt}`, 'turnover_staying', 'owner', decidedAt, v, ownerHref, { detail: v.counterpartName }));
      }
      if (v.stage === 'leaving' && decidedAt) {
        items.push(item(`t-leave:${v.leaseId}:${v.decidedAt}`, 'turnover_leaving', 'owner', decidedAt, v, ownerHref, { detail: v.counterpartName, date: v.moveOutDate }));
      }
      if (v.stage === 'questions' && v.questionsAt) {
        items.push(item(`t-q:${v.leaseId}:${v.questionsAt}`, 'turnover_questions', 'owner', new Date(v.questionsAt), v, ownerHref, { detail: v.counterpartName }));
      }
      if (v.overdue) {
        items.push(item(`t-late:${v.leaseId}:${v.answerBy}`, 'turnover_overdue', 'owner', new Date(v.answerBy), v, ownerHref, { detail: v.counterpartName }));
      }
      if (v.meeting?.bookedAt) {
        items.push(item(`t-meet:${v.meeting.id}:${v.meeting.bookedAt}`, 'turnover_meeting_booked', 'owner', new Date(v.meeting.bookedAt), v, ownerHref, { detail: v.counterpartName, date: v.meeting.startsAt }));
      }
      if (v.replacement?.applicantsOpen && !v.replacement.requirementsConfirmedAt) {
        items.push(item(`t-auto:${v.leaseId}`, 'turnover_search_open', 'owner', new Date(v.replacement.applicantsOpenAt), v, ownerHref));
      }
    } else {
      const href = '/tenant/renewal';
      if (v.openedAt && (v.stage === 'awaiting_tenant' || v.stage === 'questions' || v.stage === 'answered')) {
        items.push(item(`t-open:${v.leaseId}`, 'turnover_open', 'tenant', new Date(v.openedAt), v, href, { date: v.lease.endDate }));
      }
      if (v.stage === 'awaiting_tenant' && v.openedAt) {
        const remindAt = new Date(new Date(v.openedAt).getTime() + REMINDER_AFTER);
        if (remindAt <= now) items.push(item(`t-remind:${v.leaseId}`, 'turnover_reminder', 'tenant', remindAt, v, href, { date: v.answerBy }));
      }
      if (v.tenantStep === 'decide' && !v.overdue) {
        const warnAt = new Date(new Date(v.answerBy).getTime() - DEADLINE_WARNING);
        if (warnAt <= now) items.push(item(`t-due:${v.leaseId}:${v.answerBy}`, 'turnover_deadline_soon', 'tenant', warnAt, v, href, { date: v.answerBy }));
      }
      if (v.stage === 'answered' && v.answersAt) {
        items.push(item(`t-ans:${v.leaseId}:${v.answersAt}`, 'turnover_answers', 'tenant', new Date(v.answersAt), v, href, { date: v.answerBy }));
      }
      if (v.tenantStep === 'pick_meeting_time') {
        items.push(item(`t-times:${v.leaseId}`, 'turnover_times', 'tenant', v.decidedAt ? new Date(v.decidedAt) : now, v, href));
      }
      if (v.meeting) {
        const soonAt = new Date(new Date(v.meeting.startsAt).getTime() - SOON);
        if (soonAt <= now && new Date(v.meeting.startsAt) > now) {
          items.push(item(`t-meetsoon:${v.meeting.id}`, 'turnover_meeting_soon', 'tenant', soonAt, v, href, { date: v.meeting.startsAt }));
        }
      }
      if (v.stage === 'renewed' && v.renewedAt) {
        items.push(item(`t-done:${v.leaseId}`, 'turnover_renewed', 'tenant', new Date(v.renewedAt), v, href, { date: v.newEndDate }));
      }
    }
  }

  items.push(...(await viewingItems(viewer, now)));
  return items.filter((x) => x.atDate >= since && x.atDate <= new Date(now.getTime() + 1000));
}

/** Bookings for the owner, invitations and "tomorrow" for everyone involved. */
async function viewingItems(viewer: Viewer, now: Date): Promise<Item[]> {
  const items: Item[] = [];
  const label = (p: { street: string; houseNumber: string }) => `${p.street} ${p.houseNumber}`.trim();
  const owned = [...viewer.ownedPropertyIds];

  if (owned.length) {
    const booked = await db
      .select({ v: s.viewingSlots, p: s.properties, u: s.users })
      .from(s.viewingSlots)
      .innerJoin(s.properties, eq(s.properties.id, s.viewingSlots.propertyId))
      .innerJoin(s.leads, eq(s.leads.id, s.viewingSlots.leadId))
      .innerJoin(s.users, eq(s.users.id, s.leads.seekerId))
      .where(and(inArray(s.viewingSlots.propertyId, owned), eq(s.viewingSlots.status, 'booked'), gt(s.viewingSlots.startsAt, now), isNotNull(s.viewingSlots.bookedAt)));
    for (const { v, p, u } of booked) {
      const href = `/owner/properties/${p.id}?tab=viewings`;
      items.push(item(`v-book:${v.id}:${v.bookedAt!.getTime()}`, 'viewing_booked', 'owner', v.bookedAt!, { propertyLabel: label(p) }, href, { detail: u.name, date: v.startsAt.toISOString() }));
      const soonAt = new Date(v.startsAt.getTime() - SOON);
      if (soonAt <= now) items.push(item(`v-soon-o:${v.id}`, 'viewing_soon', 'owner', soonAt, { propertyLabel: label(p) }, href, { detail: u.name, date: v.startsAt.toISOString() }));
    }
  }

  /* As an applicant or a follower. */
  const mine = await db
    .select({ l: s.leads, p: s.properties })
    .from(s.leads)
    .innerJoin(s.properties, eq(s.properties.id, s.leads.propertyId))
    .where(and(eq(s.leads.seekerId, viewer.userId), isNull(s.leads.deletedAt)));
  if (mine.length === 0) return items;

  const propertyIds = mine.map((m) => m.p.id);
  const [cycles, slots] = await Promise.all([
    db.select().from(s.renewalCycles).where(and(inArray(s.renewalCycles.propertyId, propertyIds), isNotNull(s.renewalCycles.watchersInvitedAt))),
    db.select().from(s.viewingSlots).where(and(inArray(s.viewingSlots.propertyId, propertyIds), gt(s.viewingSlots.startsAt, now))),
  ]);

  for (const { l, p } of mine) {
    const href = `/search/${p.id}`;
    if (l.watchOnly) {
      const cycle = cycles.find((c) => c.propertyId === p.id && c.watchersInvitedAt && c.watchersInvitedAt > l.createdAt && c.stage === 'leaving');
      if (cycle) items.push(item(`apply:${l.id}:${cycle.id}`, 'apply_invite', 'seeker', cycle.watchersInvitedAt!, { propertyLabel: label(p) }, href, { date: p.availableFrom }));
      continue;
    }
    const onProperty = slots.filter((v) => v.propertyId === p.id);
    const held = onProperty.find((v) => v.leadId === l.id && v.status === 'booked');
    if (held) {
      const soonAt = new Date(held.startsAt.getTime() - SOON);
      if (soonAt <= now) items.push(item(`v-soon-s:${held.id}`, 'viewing_soon', 'seeker', soonAt, { propertyLabel: label(p) }, href, { date: held.startsAt.toISOString() }));
      continue;
    }
    const open = onProperty.filter((v) => v.status === 'open');
    if (open.length && (await eligible(l, p))) {
      const first = open.reduce((a, b) => (a.createdAt < b.createdAt ? a : b));
      items.push(item(`v-inv:${l.id}:${first.createdAt.getTime()}`, 'viewing_invite', 'seeker', first.createdAt, { propertyLabel: label(p) }, href));
    }
  }
  return items;
}

/** Only applicants who may book without being asked are invited to. */
async function eligible(lead: typeof s.leads.$inferSelect, property: typeof s.properties.$inferSelect): Promise<boolean> {
  const { criteria } = await activeCriteria(property.ownerId);
  const [ctx] = await loadLeadContexts([lead], { criteria, withIdentities: false });
  return passesScreening(evaluate(ctx).flags);
}

