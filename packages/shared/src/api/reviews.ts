import { z } from 'zod';

/**
 * Reviews, after the tenancy.
 *
 * Written only once a lease has ended, and sealed until both sides have written
 * or the window closes. Everything about the shape of this follows from one
 * observation: a review written while either party still wants something from
 * the other is not a review, it is leverage.
 */

/** Days a single review stays sealed waiting for its counterpart. */
export const REVIEW_WINDOW_DAYS = 14;

export const reviewerRoleSchema = z.enum(['owner', 'tenant']);
const score = z.number().int().min(1).max(5);

export const writeReviewSchema = z.object({
  leaseId: z.string(),
  rating: score,
  communication: score.nullish(),
  reliability: score.nullish(),
  /* A floor as well as a ceiling: one word is a rating, not a review, and this
     field is the only part anybody reads. */
  body: z.string().trim().min(20).max(2000),
});

/** A published review, as anyone may read it. */
export const reviewSchema = z.object({
  id: z.string(),
  authorRole: reviewerRoleSchema,
  authorName: z.string(),
  subjectId: z.string(),
  propertyLabel: z.string(),
  /** The tenancy it describes, so a reader can see it was a real one */
  tenancyFrom: z.string(),
  tenancyUntil: z.string(),
  rating: z.number().int(),
  communication: z.number().int().nullable(),
  reliability: z.number().int().nullable(),
  body: z.string(),
  publishedAt: z.string(),
});

/**
 * One of your own, which you can see whatever its state — including while it is
 * still sealed, because you wrote it.
 */
export const myReviewSchema = z.object({
  id: z.string(),
  leaseId: z.string(),
  propertyLabel: z.string(),
  rating: z.number().int(),
  body: z.string(),
  createdAt: z.string(),
  /** False while it waits for the other side or the window */
  published: z.boolean(),
  /** When the seal lifts if the other side never writes */
  sealedUntil: z.string().nullable(),
});

/**
 * A tenancy you may still write about, with the deadline. Surfacing this is
 * what stops reviews being a thing only angry people remember to do.
 */
export const reviewablePendingSchema = z.object({
  leaseId: z.string(),
  propertyLabel: z.string(),
  counterpartName: z.string(),
  myRole: reviewerRoleSchema,
  tenancyFrom: z.string(),
  tenancyUntil: z.string(),
  writeBy: z.string(),
});

export const reviewListSchema = z.object({
  /** Published reviews about this person */
  about: z.array(reviewSchema),
  /** What you have written */
  mine: z.array(myReviewSchema),
  /** Tenancies still open to you */
  pending: z.array(reviewablePendingSchema),
  /** Mean of published ratings about this person, null below three */
  averageRating: z.number().nullable(),
  reviewCount: z.number().int(),
});

export type ReviewView = z.infer<typeof reviewSchema>;
export type MyReview = z.infer<typeof myReviewSchema>;
