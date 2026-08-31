import { and, eq, inArray, isNull } from 'drizzle-orm';
import {
  evaluateLead,
  leadScore,
  type LeadView,
  type OwnerLead,
  type Property,
  type ScreeningCriterion,
  type SeekerLead,
} from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { scopeFor, type Viewer } from './viewer.ts';

type LeadRow = typeof s.leads.$inferSelect;
type PropertyRow = typeof s.properties.$inferSelect;
type UserRow = typeof s.users.$inferSelect;

/**
 * Screening flags are computed on every read, never stored.
 *
 * The owner can change a criterion at any time, and a stored flag would then be
 * a claim about a rule that no longer exists — which is exactly the thing the
 * audit log is supposed to protect them from. The audit log records what was
 * true at a moment; the list shows what is true now, and they are different
 * questions.
 */
export interface LeadContext {
  lead: LeadRow;
  property: PropertyRow;
  seeker?: Pick<UserRow, 'id' | 'name' | 'phone'> | null;
  about?: string | null;
  queueLength: number;
  criteria: ScreeningCriterion[];
}

const snapshot = (lead: LeadRow) => ({
  incomeToRentRatio: Number(lead.incomeToRentRatio),
  employment: lead.employment,
  hasGuarantors: lead.hasGuarantors,
  occupants: lead.occupants,
  pets: lead.pets,
  smoker: lead.smoker,
  leaseLengthMonths: lead.leaseLengthMonths,
  priorLandlordReference: lead.priorLandlordReference,
});

/**
 * Reuses the exact screening implementation the prototype's UI used, from
 * @miftan/shared. Two copies of "does this applicant meet the criteria" is how
 * an owner ends up unable to explain a decision.
 */
export function evaluate(ctx: LeadContext) {
  const property = {
    id: ctx.property.id,
    rooms: Number(ctx.property.rooms),
    amenities: ctx.property.amenities,
    available_from: ctx.property.availableFrom ?? undefined,
  } as unknown as Property;

  const flags = evaluateLead(
    {
      id: ctx.lead.id,
      property_id: ctx.lead.propertyId,
      seeker_id: ctx.lead.seekerId,
      stage: ctx.lead.stage,
      created_at: ctx.lead.createdAt.toISOString(),
      desired_move_in: ctx.lead.desiredMoveIn,
      queue_position: ctx.lead.queuePosition,
      screening: {
        income_to_rent_ratio: Number(ctx.lead.incomeToRentRatio),
        employment: ctx.lead.employment,
        has_guarantors: ctx.lead.hasGuarantors,
        occupants: ctx.lead.occupants,
        pets: ctx.lead.pets,
        smoker: ctx.lead.smoker,
        lease_length_months: ctx.lead.leaseLengthMonths,
        prior_landlord_reference: ctx.lead.priorLandlordReference,
      },
      screening_flags: [],
    },
    property,
    ctx.criteria,
  );

  return { flags, score: leadScore(flags, ctx.criteria) };
}

export function projectLead(viewer: Viewer, ctx: LeadContext): LeadView {
  const label = `${ctx.property.street} ${ctx.property.houseNumber}`;

  if (scopeFor(viewer, ctx.property.id) === 'owner') {
    const { flags, score } = evaluate(ctx);
    const owned: OwnerLead = {
      scope: 'owner',
      id: ctx.lead.id,
      propertyId: ctx.property.id,
      propertyLabel: label,
      stage: ctx.lead.stage,
      desiredMoveIn: ctx.lead.desiredMoveIn,
      queuePosition: ctx.lead.queuePosition,
      watchOnly: ctx.lead.watchOnly,
      createdAt: ctx.lead.createdAt.toISOString(),
      seeker: ctx.seeker
        ? { id: ctx.seeker.id, name: ctx.seeker.name, phone: ctx.seeker.phone }
        : { id: '', name: '', phone: null },
      about: ctx.about ?? null,
      screening: snapshot(ctx.lead),
      flags,
      score,
    };
    return owned;
  }

  /* The seeker's own row. Everyone else in the queue is a number, not a name —
     the people ahead of you are not your business. */
  const mine: SeekerLead = {
    scope: 'seeker',
    id: ctx.lead.id,
    propertyId: ctx.property.id,
    propertyLabel: label,
    stage: ctx.lead.stage,
    desiredMoveIn: ctx.lead.desiredMoveIn,
    queuePosition: ctx.lead.queuePosition,
    queueLength: ctx.queueLength,
    watchOnly: ctx.lead.watchOnly,
    createdAt: ctx.lead.createdAt.toISOString(),
  };
  return mine;
}

/** The owner's active preset, or an empty rule set if they have none. */
export async function activeCriteria(ownerId: string): Promise<{ criteria: ScreeningCriterion[]; name: string }> {
  const [preset] = await db
    .select()
    .from(s.screeningPresets)
    .where(and(eq(s.screeningPresets.ownerId, ownerId), eq(s.screeningPresets.isActive, true)));
  return {
    criteria: (preset?.criteria as ScreeningCriterion[] | undefined) ?? [],
    name: preset?.name ?? '—',
  };
}

export async function loadLeadContexts(
  leads: LeadRow[],
  opts: { criteria: ScreeningCriterion[]; withIdentities: boolean },
): Promise<LeadContext[]> {
  if (leads.length === 0) return [];
  const propertyIds = [...new Set(leads.map((l) => l.propertyId))];

  const [properties, queueRows, seekers, profiles] = await Promise.all([
    db.select().from(s.properties).where(inArray(s.properties.id, propertyIds)),
    db
      .select({ propertyId: s.leads.propertyId, id: s.leads.id })
      .from(s.leads)
      .where(and(inArray(s.leads.propertyId, propertyIds), isNull(s.leads.deletedAt), eq(s.leads.watchOnly, false))),
    opts.withIdentities
      ? db
          .select({ id: s.users.id, name: s.users.name, phone: s.users.phone })
          .from(s.users)
          .where(inArray(s.users.id, [...new Set(leads.map((l) => l.seekerId))]))
      : Promise.resolve([]),
    opts.withIdentities
      ? db
          .select({ userId: s.renterProfiles.userId, about: s.renterProfiles.about })
          .from(s.renterProfiles)
          .where(inArray(s.renterProfiles.userId, [...new Set(leads.map((l) => l.seekerId))]))
      : Promise.resolve([]),
  ]);

  const propertyById = new Map(properties.map((p) => [p.id, p]));
  const seekerById = new Map(seekers.map((u) => [u.id, u]));
  const aboutById = new Map(profiles.map((p) => [p.userId, p.about]));
  const queueLengths = new Map<string, number>();
  for (const row of queueRows) {
    queueLengths.set(row.propertyId, (queueLengths.get(row.propertyId) ?? 0) + 1);
  }

  return leads.map((lead) => ({
    lead,
    property: propertyById.get(lead.propertyId)!,
    seeker: seekerById.get(lead.seekerId) ?? null,
    about: aboutById.get(lead.seekerId) ?? null,
    queueLength: queueLengths.get(lead.propertyId) ?? 0,
    criteria: opts.criteria,
  }));
}
