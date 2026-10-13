import { z } from 'zod';

/**
 * Lease turnover, on the wire.
 *
 * One view per lease, shaped for whoever is reading it. The tenant sees their
 * own lease and the owner's answers; the owner sees the tenant's name and,
 * once the tenant is leaving, how the search for the next tenant is going —
 * as counts. Applicants are never named to the tenant.
 */

export const renewalStageSchema = z.enum([
  'upcoming', 'awaiting_tenant', 'questions', 'answered', 'staying', 'leaving', 'renewed', 'closed',
]);
export const renewalTopicSchema = z.enum(['rent_same', 'extend_year', 'shorter', 'terms_change', 'other']);

export const renewalQuestionSchema = z.object({
  topic: renewalTopicSchema,
  /** Free text — only for `other`, or a note on a standard question */
  text: z.string().nullable(),
});

export const renewalAnswerSchema = z.object({
  topic: renewalTopicSchema,
  answer: z.string().trim().min(1).max(600),
});

export const meetingSlotSchema = z.object({
  id: z.string(),
  startsAt: z.string(),
  durationMinutes: z.number().int(),
  status: z.enum(['open', 'booked', 'cancelled']),
  bookedAt: z.string().nullable(),
});

export const renewalViewSchema = z.object({
  leaseId: z.string(),
  role: z.enum(['owner', 'tenant']),
  stage: renewalStageSchema,
  propertyId: z.string(),
  propertyLabel: z.string(),
  /** The other side: the tenant's name for the owner, the owner's for the tenant */
  counterpartName: z.string(),
  lease: z.object({
    startDate: z.string(),
    endDate: z.string(),
    monthlyRentAgorot: z.number().int(),
    noticePeriodDays: z.number().int(),
    hasExtensionOption: z.boolean(),
    extensionMonths: z.number().int().nullable(),
  }),
  opensOn: z.string(),
  /** The contract's answer-by date */
  noticeDeadline: z.string(),
  /** What the tenant is working to right now: the owner's deadline if one was set */
  answerBy: z.string(),
  overdue: z.boolean(),
  openedAt: z.string().nullable(),
  questions: z.array(renewalQuestionSchema),
  questionsAt: z.string().nullable(),
  answers: z.array(renewalAnswerSchema),
  answersAt: z.string().nullable(),
  decision: z.enum(['stay', 'leave']).nullable(),
  decidedAt: z.string().nullable(),
  moveOutDate: z.string().nullable(),
  meetingSlots: z.array(meetingSlotSchema),
  meeting: meetingSlotSchema.nullable(),
  renewedAt: z.string().nullable(),
  newEndDate: z.string().nullable(),
  /** The tenant may still change their mind without asking anyone */
  canChangeDecision: z.boolean(),
  /** Owner only, once the tenant is leaving */
  replacement: z
    .object({
      requirementsConfirmedAt: z.string().nullable(),
      applicantsOpenAt: z.string(),
      applicantsOpen: z.boolean(),
      applicants: z.number().int(),
      strongMatches: z.number().int(),
      watchersInvited: z.number().int(),
      viewingSlotsFuture: z.number().int(),
      viewingsBooked: z.number().int(),
    })
    .nullable(),
  ownerStep: z
    .enum([
      'answer_questions', 'tenant_overdue', 'offer_meeting_times', 'confirm_renewal',
      'review_requirements', 'set_viewing_times', 'review_applicants',
    ])
    .nullable(),
  tenantStep: z.enum(['decide', 'pick_meeting_time']).nullable(),
  waitingOn: z.enum(['not_open', 'tenant', 'owner_answers', 'owner_times', 'tenant_time', 'meeting', 'applicants', 'done']),
});

export const renewalListSchema = z.object({ renewals: z.array(renewalViewSchema) });

/* ── Writes ─────────────────────────────────────────────── */

export const renewalDecisionSchema = z.object({
  decision: z.enum(['stay', 'leave']),
});

export const renewalQuestionsSchema = z.object({
  topics: z.array(renewalTopicSchema.exclude(['other'])).max(4).default([]),
  text: z.string().trim().max(800).nullish(),
});

export const renewalAnswersSchema = z.object({
  answers: z.array(renewalAnswerSchema).min(1).max(5),
  /** ISO datetime by which the tenant should decide */
  deadline: z.string(),
});

export const extendDeadlineSchema = z.object({ days: z.number().int().min(1).max(30) });

export const timeWindowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  from: z.string().regex(/^\d{2}:\d{2}$/),
  until: z.string().regex(/^\d{2}:\d{2}$/),
});

export const offerMeetingSchema = z.object({
  windows: z.array(timeWindowSchema).min(1).max(14),
});

export const publishWindowsSchema = z.object({
  propertyId: z.string(),
  windows: z.array(timeWindowSchema).min(1).max(14),
});

/**
 * What the owner may change before the search for the next tenant starts.
 * Every field optional: sending nothing is "no changes — continue".
 */
export const listingRequirementsSchema = z.object({
  monthlyRent: z.number().int().min(500).max(200_000).optional(),
  availableFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  minLeaseMonths: z.number().int().min(1).max(60).nullable().optional(),
  petsAllowed: z.boolean().optional(),
  smokingAllowed: z.boolean().nullable().optional(),
  maxOccupants: z.number().int().min(1).max(12).nullable().optional(),
  furnished: z.boolean().optional(),
});

export const completeRenewalSchema = z.object({
  newEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  monthlyRent: z.number().int().min(500).max(200_000),
});

export type RenewalView = z.infer<typeof renewalViewSchema>;
export type RenewalQuestion = z.infer<typeof renewalQuestionSchema>;
export type RenewalAnswer = z.infer<typeof renewalAnswerSchema>;
export type MeetingSlot = z.infer<typeof meetingSlotSchema>;
export type TimeWindow = z.infer<typeof timeWindowSchema>;
export type ListingRequirements = z.infer<typeof listingRequirementsSchema>;
