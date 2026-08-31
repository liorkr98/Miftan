import { z } from 'zod';
import { contactSchema } from './views';

/**
 * Leads, screening and the audit trail.
 *
 * The two scopes are very different questions. An owner asks "who is queueing
 * for my flat and how do they compare"; a seeker asks "where am I in the line".
 * The seeker's answer contains a position and a total and no other human being,
 * because the people ahead of them in a queue are not their business.
 */

export const leadStageSchema = z.enum([
  'new', 'screening', 'viewing_scheduled', 'viewed', 'offer', 'signed', 'rejected',
]);

export const screeningCriterionIdSchema = z.enum([
  'income_to_rent', 'employment', 'guarantors', 'move_in_date',
  'lease_length', 'smoking', 'pets', 'occupancy', 'reference',
]);

export const screeningFlagSchema = z.object({
  criterion: screeningCriterionIdSchema,
  passed: z.boolean(),
  /** Why, in words the owner can show someone who challenges the decision */
  note: z.string(),
});

/** The snapshot taken when they applied, not their profile as it is today. */
export const screeningSnapshotSchema = z.object({
  incomeToRentRatio: z.number(),
  employment: z.string(),
  hasGuarantors: z.boolean(),
  occupants: z.number().int(),
  pets: z.boolean(),
  smoker: z.boolean(),
  leaseLengthMonths: z.number().int(),
  priorLandlordReference: z.boolean(),
});

export const ownerLeadSchema = z.object({
  scope: z.literal('owner'),
  id: z.string(),
  propertyId: z.string(),
  propertyLabel: z.string(),
  stage: leadStageSchema,
  desiredMoveIn: z.string(),
  queuePosition: z.number().int(),
  watchOnly: z.boolean(),
  createdAt: z.string(),
  seeker: contactSchema,
  about: z.string().nullable(),
  screening: screeningSnapshotSchema,
  /** Recomputed against the active preset on every read, never stored */
  flags: z.array(screeningFlagSchema),
  score: z.number().int(),
});

/** The seeker's own place in a queue. No other applicant appears. */
export const seekerLeadSchema = z.object({
  scope: z.literal('seeker'),
  id: z.string(),
  propertyId: z.string(),
  propertyLabel: z.string(),
  stage: leadStageSchema,
  desiredMoveIn: z.string(),
  queuePosition: z.number().int(),
  queueLength: z.number().int(),
  watchOnly: z.boolean(),
  createdAt: z.string(),
});

export const leadViewSchema = z.discriminatedUnion('scope', [ownerLeadSchema, seekerLeadSchema]);
export const leadListSchema = z.object({ leads: z.array(leadViewSchema) });

/* ── Screening presets ─────────────────────────────────── */

export const screeningCriterionSchema = z.object({
  id: screeningCriterionIdSchema,
  enabled: z.boolean(),
  weight: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  value: z.union([z.number(), z.boolean()]).optional(),
});

export const screeningPresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  criteria: z.array(screeningCriterionSchema),
  isActive: z.boolean(),
  createdAt: z.string(),
});

export const screeningPresetListSchema = z.object({ presets: z.array(screeningPresetSchema) });

export const updatePresetSchema = z.object({
  criteria: z.array(screeningCriterionSchema).optional(),
  name: z.string().trim().min(1).max(120).optional(),
});

/* ── Audit ─────────────────────────────────────────────── */

export const auditEntrySchema = z.object({
  id: z.string(),
  at: z.string(),
  leadName: z.string(),
  propertyLabel: z.string().nullable(),
  presetName: z.string(),
  action: z.enum(['ranked', 'stage_changed', 'preset_applied', 'exported']),
  detail: z.string(),
  flags: z.array(screeningFlagSchema),
});

export const auditListSchema = z.object({
  entries: z.array(auditEntrySchema),
  total: z.number().int(),
});

export const setStageSchema = z.object({ stage: leadStageSchema });
export const reserveQueueSchema = z.object({
  propertyId: z.string(),
  desiredMoveIn: z.string(),
  watchOnly: z.boolean().default(false),
});

export type OwnerLead = z.infer<typeof ownerLeadSchema>;
export type SeekerLead = z.infer<typeof seekerLeadSchema>;
export type LeadView = z.infer<typeof leadViewSchema>;
export type ScreeningPresetView = z.infer<typeof screeningPresetSchema>;
export type AuditEntryView = z.infer<typeof auditEntrySchema>;
