import { and, eq, gt, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import {
  ApiError,
  applicantsOpenAt,
  israelToday,
  nextStep,
  noticeDeadline,
  passesScreening,
  renewalOpensOn,
  zonedWallTime,
  type RenewalAnswer,
  type RenewalQuestion,
  type RenewalView,
} from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { scopeFor, type Viewer } from './viewer.ts';
import { activeCriteria, evaluate, loadLeadContexts } from './leads.ts';

/**
 * Lease turnover, from the rows.
 *
 * `openDueCycles` is the scheduler: called on every read that could show a
 * lease to its owner or tenant, it creates the cycle once the lease reaches
 * its opening day, and opens the search for a next tenant when the owner has
 * let the 48-hour window pass. Nothing waits on a cron.
 */

type LeaseRow = typeof s.leases.$inferSelect;
type CycleRow = typeof s.renewalCycles.$inferSelect;
type PropertyRow = typeof s.properties.$inferSelect;

/** Leases still worth showing: current, or ended recently with a turnover in progress. */
const TRAILING_DAYS = 90;

function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** End of the deadline day, Israel time. */
function endOfDay(iso: string): Date {
  return new Date(zonedWallTime(iso, '23:59').getTime() + 59_000);
}

export function answerByFor(lease: LeaseRow, cycle: CycleRow | null): Date {
  return cycle?.decisionDeadline ?? endOfDay(noticeDeadline(lease.endDate, lease.noticePeriodDays));
}

/** The leases this viewer is a party to, as owner or tenant. */
export async function leasesFor(viewer: Viewer): Promise<LeaseRow[]> {
  const today = israelToday();
  const owned = [...viewer.ownedPropertyIds];
  return db
    .select()
    .from(s.leases)
    .where(
      and(
        isNull(s.leases.deletedAt),
        lte(s.leases.startDate, today),
        gte(s.leases.endDate, shiftDays(today, -TRAILING_DAYS)),
        or(
          eq(s.leases.tenantId, viewer.userId),
          owned.length ? inArray(s.leases.propertyId, owned) : undefined,
        ),
      ),
    );
}

/**
 * Create cycles that are due, and move "leaving" cycles to an open search when
 * the owner did not review the requirements within the window.
 */
export async function openDueCycles(leases: LeaseRow[], now: Date = new Date()): Promise<void> {
  if (leases.length === 0) return;
  const today = israelToday(now);
  const existing = await db
    .select()
    .from(s.renewalCycles)
    .where(inArray(s.renewalCycles.leaseId, leases.map((l) => l.id)));
  const byLease = new Map(existing.map((c) => [c.leaseId, c]));

  for (const lease of leases) {
    const cycle = byLease.get(lease.id);
    const opensOn = renewalOpensOn(lease.endDate, lease.noticePeriodDays);

    /* A renewed lease starts its next round when its new window opens. */
    if (cycle?.stage === 'renewed' && today >= opensOn && (cycle.renewedAt?.toISOString().slice(0, 10) ?? '') < opensOn) {
      await db.delete(s.renewalCycles).where(eq(s.renewalCycles.id, cycle.id));
      byLease.delete(lease.id);
    }

    if (!byLease.has(lease.id) && today >= opensOn && lease.endDate >= today) {
      /* A tenant who already answered through an availability question
         should not be asked the same thing twice. */
      const already = lease.renewalIntent === 'extend' ? 'stay' : lease.renewalIntent === 'leave' ? 'leave' : null;
      await db
        .insert(s.renewalCycles)
        .values({
          id: newId('renewalCycle'),
          leaseId: lease.id,
          propertyId: lease.propertyId,
          stage: already === 'stay' ? 'staying' : already === 'leave' ? 'leaving' : 'awaiting_tenant',
          decision: already,
          decidedAt: already ? now : null,
          moveOutDate: already === 'leave' ? lease.endDate : null,
        })
        .onConflictDoNothing();
    }
  }

  /* The owner had two days to adjust the listing. After that the search
     starts with the requirements as they are. */
  const stale = await db
    .select({ c: s.renewalCycles, p: s.properties })
    .from(s.renewalCycles)
    .innerJoin(s.properties, eq(s.properties.id, s.renewalCycles.propertyId))
    .where(
      and(
        inArray(s.renewalCycles.leaseId, leases.map((l) => l.id)),
        eq(s.renewalCycles.stage, 'leaving'),
        isNull(s.renewalCycles.requirementsConfirmedAt),
        isNull(s.renewalCycles.watchersInvitedAt),
      ),
    );
  for (const { c, p } of stale) {
    if (!c.decidedAt || applicantsOpenAt(c.decidedAt, null) > now) continue;
    await db.update(s.renewalCycles).set({ watchersInvitedAt: now, updatedAt: now }).where(eq(s.renewalCycles.id, c.id));
    if (!p.listed) {
      await db.update(s.properties).set({ listed: true, updatedAt: now }).where(eq(s.properties.id, p.id));
    }
  }
}

export async function loadRenewalViews(viewer: Viewer, now: Date = new Date()): Promise<RenewalView[]> {
  const leases = await leasesFor(viewer);
  await openDueCycles(leases, now);
  if (leases.length === 0) return [];

  const leaseIds = leases.map((l) => l.id);
  const propertyIds = [...new Set(leases.map((l) => l.propertyId))];

  const [cycles, properties, users] = await Promise.all([
    db.select().from(s.renewalCycles).where(inArray(s.renewalCycles.leaseId, leaseIds)),
    db.select().from(s.properties).where(inArray(s.properties.id, propertyIds)),
    db
      .select({ id: s.users.id, name: s.users.name })
      .from(s.users)
      .where(
        inArray(s.users.id, [...new Set([...leases.map((l) => l.tenantId)])]),
      ),
  ]);
  const ownerIds = [...new Set(properties.map((p) => p.ownerId))];
  const owners = await db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(inArray(s.users.id, ownerIds));

  const cycleByLease = new Map(cycles.map((c) => [c.leaseId, c]));
  const propertyById = new Map(properties.map((p) => [p.id, p]));
  const nameById = new Map([...users, ...owners].map((u) => [u.id, u.name]));

  const slots = cycles.length
    ? await db
        .select()
        .from(s.renewalMeetingSlots)
        .where(inArray(s.renewalMeetingSlots.cycleId, cycles.map((c) => c.id)))
    : [];

  /* A newer lease on the same flat means the next tenant has signed. */
  const newer = await db
    .select({ propertyId: s.leases.propertyId, startDate: s.leases.startDate })
    .from(s.leases)
    .where(and(inArray(s.leases.propertyId, propertyIds), isNull(s.leases.deletedAt)));

  const out: RenewalView[] = [];
  for (const lease of leases) {
    const property = propertyById.get(lease.propertyId);
    if (!property) continue;
    const role = scopeFor(viewer, property.id) === 'owner' ? 'owner' : lease.tenantId === viewer.userId ? 'tenant' : null;
    if (!role) continue;

    const cycle = cycleByLease.get(lease.id) ?? null;
    if (!cycle && lease.endDate < israelToday(now)) continue;

    const mine = slots
      .filter((x) => x.cycleId === cycle?.id && x.status !== 'cancelled')
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    const booked = mine.find((x) => x.status === 'booked') ?? null;
    const openFuture = mine.filter((x) => x.status === 'open' && x.startsAt > now);

    const nextTenantSigned = newer.some((n) => n.propertyId === lease.propertyId && n.startDate > lease.startDate);
    let stage: RenewalView['stage'] = cycle ? cycle.stage : 'upcoming';
    if (stage === 'leaving' && nextTenantSigned) stage = 'closed';

    const answerBy = answerByFor(lease, cycle);
    const overdue = (stage === 'awaiting_tenant' || stage === 'answered') && now > answerBy;

    const replacement =
      role === 'owner' && cycle && (stage === 'leaving' || stage === 'closed')
        ? await replacementFor(cycle, property, now)
        : null;
    const opensAt = cycle?.decidedAt ? applicantsOpenAt(cycle.decidedAt, cycle.requirementsConfirmedAt) : null;

    const step = nextStep({
      stage,
      overdue,
      meetingSlotsOpen: openFuture.length,
      meetingBooked: Boolean(booked),
      meetingPast: Boolean(booked && booked.startsAt < now),
      requirementsConfirmed: Boolean(cycle?.requirementsConfirmedAt),
      applicantsOpen: Boolean(cycle?.watchersInvitedAt) || Boolean(opensAt && opensAt <= now),
      applicants: replacement?.applicants ?? 0,
      viewingSlotsFuture: replacement?.viewingSlotsFuture ?? 0,
    });

    const applicantsOpen = Boolean(cycle?.watchersInvitedAt) || Boolean(opensAt && opensAt <= now);

    out.push({
      leaseId: lease.id,
      role,
      stage,
      propertyId: property.id,
      propertyLabel: `${property.street} ${property.houseNumber}`.trim(),
      counterpartName: role === 'owner' ? (nameById.get(lease.tenantId) ?? '') : (nameById.get(property.ownerId) ?? ''),
      lease: {
        startDate: lease.startDate,
        endDate: lease.endDate,
        monthlyRentAgorot: lease.monthlyRentAgorot,
        noticePeriodDays: lease.noticePeriodDays,
        hasExtensionOption: lease.hasExtensionOption,
        extensionMonths: lease.extensionMonths,
      },
      opensOn: renewalOpensOn(lease.endDate, lease.noticePeriodDays),
      noticeDeadline: noticeDeadline(lease.endDate, lease.noticePeriodDays),
      answerBy: answerBy.toISOString(),
      overdue,
      openedAt: cycle?.openedAt.toISOString() ?? null,
      questions: (cycle?.questions as RenewalQuestion[] | undefined) ?? [],
      questionsAt: cycle?.questionsAt?.toISOString() ?? null,
      answers: (cycle?.answers as RenewalAnswer[] | undefined) ?? [],
      answersAt: cycle?.answersAt?.toISOString() ?? null,
      decision: cycle?.decision ?? null,
      decidedAt: cycle?.decidedAt?.toISOString() ?? null,
      moveOutDate: cycle?.moveOutDate ?? null,
      meetingSlots: mine.map(slotView),
      meeting: booked ? slotView(booked) : null,
      renewedAt: cycle?.renewedAt?.toISOString() ?? null,
      newEndDate: cycle?.newEndDate ?? null,
      canChangeDecision: role === 'tenant' && canChange(stage, applicantsOpen),
      replacement: replacement
        ? { ...replacement, applicantsOpenAt: (opensAt ?? now).toISOString(), applicantsOpen }
        : null,
      ownerStep: role === 'owner' ? step.owner : null,
      tenantStep: role === 'tenant' ? step.tenant : null,
      waitingOn: step.waitingOn,
    });
  }

  return out.sort((a, b) => a.lease.endDate.localeCompare(b.lease.endDate));
}

/**
 * A tenant changes their mind freely until something irreversible happened for
 * someone else: staying → leaving any time before signing; leaving → staying
 * only until the flat is opened to applicants.
 */
export function canChange(stage: RenewalView['stage'], applicantsOpen: boolean): boolean {
  if (stage === 'staying') return true;
  if (stage === 'leaving') return !applicantsOpen;
  return false;
}

function slotView(x: typeof s.renewalMeetingSlots.$inferSelect) {
  return {
    id: x.id,
    startsAt: x.startsAt.toISOString(),
    durationMinutes: x.durationMinutes,
    status: x.status,
    bookedAt: x.bookedAt?.toISOString() ?? null,
  };
}

async function replacementFor(cycle: CycleRow, property: PropertyRow, now: Date) {
  const leads = await db
    .select()
    .from(s.leads)
    .where(and(eq(s.leads.propertyId, property.id), isNull(s.leads.deletedAt)));
  const applicants = leads.filter((l) => !l.watchOnly && l.stage !== 'rejected');
  const watchers = leads.filter((l) => l.watchOnly);

  let strongMatches = 0;
  if (applicants.length) {
    const { criteria } = await activeCriteria(property.ownerId);
    const contexts = await loadLeadContexts(applicants, { criteria, withIdentities: false });
    for (const ctx of contexts) {
      if (passesScreening(evaluate(ctx).flags)) strongMatches += 1;
    }
  }

  const viewingSlots = await db
    .select({ status: s.viewingSlots.status, startsAt: s.viewingSlots.startsAt })
    .from(s.viewingSlots)
    .where(and(eq(s.viewingSlots.propertyId, property.id), gt(s.viewingSlots.startsAt, now)));

  return {
    requirementsConfirmedAt: cycle.requirementsConfirmedAt?.toISOString() ?? null,
    applicants: applicants.length,
    strongMatches,
    watchersInvited: cycle.watchersInvitedAt ? watchers.length : 0,
    viewingSlotsFuture: viewingSlots.filter((v) => v.status === 'open' || v.status === 'booked').length,
    viewingsBooked: viewingSlots.filter((v) => v.status === 'booked').length,
  };
}

/* ── Loading one cycle for a write ─────────────────────── */

export interface CycleAccess {
  lease: LeaseRow;
  property: PropertyRow;
  cycle: CycleRow;
  role: 'owner' | 'tenant';
}

/**
 * The lease, its flat and its cycle, for a write by this viewer. Opens the
 * cycle first if it is due or if the request is an early start; 404s for
 * anyone who is not the owner or the tenant.
 */
export async function cycleForWrite(viewer: Viewer, leaseId: string, opts: { openEarly?: boolean } = {}): Promise<CycleAccess> {
  const [lease] = await db.select().from(s.leases).where(and(eq(s.leases.id, leaseId), isNull(s.leases.deletedAt)));
  if (!lease) throw new ApiError('not_found', 'no such lease');
  const [property] = await db.select().from(s.properties).where(eq(s.properties.id, lease.propertyId));
  const role = scopeFor(viewer, property.id) === 'owner' ? 'owner' : lease.tenantId === viewer.userId ? 'tenant' : null;
  if (!role) throw new ApiError('not_found', 'no such lease');

  await openDueCycles([lease]);
  let [cycle] = await db.select().from(s.renewalCycles).where(eq(s.renewalCycles.leaseId, lease.id));
  if (!cycle && opts.openEarly) {
    [cycle] = await db
      .insert(s.renewalCycles)
      .values({ id: newId('renewalCycle'), leaseId: lease.id, propertyId: lease.propertyId })
      .onConflictDoNothing()
      .returning();
    if (!cycle) [cycle] = await db.select().from(s.renewalCycles).where(eq(s.renewalCycles.leaseId, lease.id));
  }
  if (!cycle) throw new ApiError('forbidden', 'the renewal has not started yet');
  return { lease, property, cycle, role };
}
