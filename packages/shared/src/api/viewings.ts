import { z } from 'zod';
import { contactSchema } from './views';
import { screeningFlagSchema, screeningSnapshotSchema } from './leads';

/**
 * Viewings.
 *
 * The owner publishes the times they can be at the flat; applicants take one.
 * Two shapes again, for the same reason as everywhere else: an applicant
 * choosing a time has no business seeing who else is coming, and the owner
 * needs to see exactly that.
 */

export const viewingStatusSchema = z.enum(['open', 'booked', 'attended', 'no_show', 'cancelled']);

/** What the owner sees: the whole schedule, and who is in it. */
export const ownerSlotSchema = z.object({
  scope: z.literal('owner'),
  id: z.string(),
  propertyId: z.string(),
  propertyLabel: z.string(),
  startsAt: z.string(),
  durationMinutes: z.number().int(),
  status: viewingStatusSchema,
  note: z.string().nullable(),
  /** Null while the slot is open */
  applicant: contactSchema.nullable(),
  leadId: z.string().nullable(),
  /** The owner overrode their own filters to put this person here */
  invitedByOwner: z.boolean(),
  bookedAt: z.string().nullable(),
});

/**
 * What an applicant sees: times, and whether each is free. Never who holds the
 * ones that are taken — the other people viewing a flat are not their business,
 * and knowing would turn a viewing into an auction before anyone has applied.
 */
export const seekerSlotSchema = z.object({
  scope: z.literal('seeker'),
  id: z.string(),
  propertyId: z.string(),
  propertyLabel: z.string(),
  startsAt: z.string(),
  durationMinutes: z.number().int(),
  taken: z.boolean(),
  /** True when this is the one you hold */
  mine: z.boolean(),
});

export const slotViewSchema = z.discriminatedUnion('scope', [ownerSlotSchema, seekerSlotSchema]);

export const slotListSchema = z.object({
  slots: z.array(slotViewSchema),
  /**
   * Whether this applicant may book without being asked. False carries a
   * reason, because "you cannot book" with no explanation is the worst version
   * of this screen.
   */
  eligible: z.boolean().nullable(),
  ineligibleReason: z.string().nullable(),
});

/* ── Writes ────────────────────────────────────────────── */

/**
 * Publishing slots. A window and a rhythm rather than one time at a time —
 * an owner setting aside Tuesday afternoon means eight slots, and making them
 * create eight is how the feature goes unused.
 */
export const publishSlotsSchema = z.object({
  propertyId: z.string(),
  /** Local date, yyyy-MM-dd */
  date: z.string(),
  /** HH:mm, inclusive */
  from: z.string().regex(/^\d{2}:\d{2}$/),
  /** HH:mm, exclusive */
  until: z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.number().int().min(10).max(60).default(15),
  /** Minutes between viewings, so one running long does not cascade */
  gapMinutes: z.number().int().min(0).max(30).default(5),
});

export const bookSlotSchema = z.object({ leadId: z.string() });

/** The owner putting someone in a slot themselves. */
export const inviteToSlotSchema = z.object({
  leadId: z.string(),
  note: z.string().trim().max(300).nullish(),
  /**
   * Required when the applicant did not clear the filters. Naming it makes the
   * override deliberate rather than a click-through.
   */
  overrideScreening: z.boolean().default(false),
});

export const markAttendanceSchema = z.object({
  status: z.enum(['attended', 'no_show']),
});

/* ── The briefing ──────────────────────────────────────── */

/**
 * What the owner gets before a viewing.
 *
 * The point is that they walk up the stairs already knowing who they are about
 * to meet — the name, what they asked for, how they scored and on which
 * criteria. Turning up to a viewing having forgotten which of six applicants
 * this one is, is the ordinary experience, and it is fixable with a screen.
 */
export const briefingSchema = z.object({
  slotId: z.string(),
  startsAt: z.string(),
  propertyLabel: z.string(),
  applicant: contactSchema,
  about: z.string().nullable(),
  desiredMoveIn: z.string(),
  queuePosition: z.number().int(),
  screening: screeningSnapshotSchema,
  flags: z.array(screeningFlagSchema),
  score: z.number().int(),
  invitedByOwner: z.boolean(),
  note: z.string().nullable(),
});

export const upcomingBriefingsSchema = z.object({ briefings: z.array(briefingSchema) });

export type OwnerSlot = z.infer<typeof ownerSlotSchema>;
export type SeekerSlot = z.infer<typeof seekerSlotSchema>;
export type SlotView = z.infer<typeof slotViewSchema>;
export type BriefingView = z.infer<typeof briefingSchema>;
