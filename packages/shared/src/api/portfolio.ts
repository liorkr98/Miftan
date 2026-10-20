import { z } from 'zod';

/**
 * The owner's portfolio, at two altitudes.
 *
 * `snapshot` is "right now": who is waiting, what is booked, what changed this
 * week. `analytics` is "over a period": views over time and how far people
 * get, for the charts. Both are owner-only and both are counts — no seeker
 * appears by name except in the owner's own agenda, where they booked a time
 * with this owner.
 */

export const funnelSchema = z.object({
  /** Distinct people who opened the listing. */
  uniqueViewers: z.number().int(),
  /** One per person per day — the same rule the listing page counts by. */
  views: z.number().int(),
  /** Asked to be told when the flat frees up. */
  alerts: z.number().int(),
  applications: z.number().int(),
  /** Applications that clear the owner's requirements. */
  relevant: z.number().int(),
  viewingsBooked: z.number().int(),
  viewingsCompleted: z.number().int(),
});

export const propertyAnalyticsSchema = z.object({
  propertyId: z.string(),
  label: z.string(),
  /** Every day in the range, zero-filled. */
  daily: z.array(z.object({ date: z.string(), views: z.number().int() })),
  funnel: funnelSchema,
});

export const portfolioAnalyticsSchema = z.object({
  from: z.string(),
  to: z.string(),
  properties: z.array(propertyAnalyticsSchema),
  /** Portfolio totals. Unique viewers are counted across flats, not summed. */
  portfolio: funnelSchema,
});

export const analyticsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const appointmentSchema = z.object({
  id: z.string(),
  kind: z.enum(['viewing', 'renewal_meeting']),
  propertyId: z.string(),
  propertyLabel: z.string(),
  startsAt: z.string(),
  durationMinutes: z.number().int(),
  personName: z.string(),
});

export const propertySnapshotSchema = z.object({
  propertyId: z.string(),
  /** Live applications (not rejected). */
  applicants: z.number().int(),
  relevant: z.number().int(),
  /** Relevant applications that arrived in the last 7 days. */
  newRelevant: z.number().int(),
  /** Relevant applicants who do not hold a viewing yet. */
  relevantWithoutViewing: z.number().int(),
  alerts: z.number().int(),
  upcomingViewings: z.number().int(),
  openSlots: z.number().int(),
  nextAppointmentAt: z.string().nullable(),
  views7d: z.number().int(),
  viewsPrev7d: z.number().int(),
});

export const portfolioSnapshotSchema = z.object({
  properties: z.array(propertySnapshotSchema),
  /** Booked appointments in the next 7 days, across every flat. */
  agenda: z.array(appointmentSchema),
});

export type Funnel = z.infer<typeof funnelSchema>;
export type PropertyAnalytics = z.infer<typeof propertyAnalyticsSchema>;
export type PortfolioAnalytics = z.infer<typeof portfolioAnalyticsSchema>;
export type Appointment = z.infer<typeof appointmentSchema>;
export type PropertySnapshot = z.infer<typeof propertySnapshotSchema>;
export type PortfolioSnapshot = z.infer<typeof portfolioSnapshotSchema>;
