import { z } from 'zod';

/**
 * Preventive maintenance. Owner-only: a tenant has no business in their
 * landlord's maintenance calendar, and a seeker still less.
 */

export const seasonalStatusSchema = z.enum(['due', 'scheduled', 'done', 'skipped']);

export const seasonalTaskSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  propertyId: z.string(),
  propertyLabel: z.string(),
  dueDate: z.string(),
  status: seasonalStatusSchema,
  year: z.number().int(),
  /** Set once the task has been turned into real work */
  ticketId: z.string().nullable(),
  completedAt: z.string().nullable(),

  /* Denormalised from the template so a list renders without a second lookup,
     and so a template that is retired later does not blank out history. */
  title: z.string(),
  why: z.string(),
  season: z.enum(['spring', 'summer', 'autumn', 'winter']),
  typicalCost: z.number(),
  avoidedCost: z.number(),
  failureRate: z.number(),
  /** avoided × probability − cost. Never a gross figure. */
  expectedSaving: z.number(),
});

export const seasonalListSchema = z.object({
  tasks: z.array(seasonalTaskSchema),
  /** Expected value of everything still outstanding, not of everything ever. */
  outstandingExpectedSaving: z.number(),
});

export const seasonalActionSchema = z.object({
  status: seasonalStatusSchema,
});

/** Turning a due task into an actual maintenance ticket. */
export const seasonalToTicketSchema = z.object({
  severity: z.enum(['low', 'medium', 'urgent']).default('medium'),
  note: z.string().trim().max(600).nullish(),
});

export type SeasonalTaskView = z.infer<typeof seasonalTaskSchema>;
