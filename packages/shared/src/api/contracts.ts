import { z } from 'zod';

/**
 * Contract scanning.
 *
 * The whole surface is built around one rule: **the scan proposes, the owner
 * commits.** Every extracted value carries a confidence and a quote from the
 * document, and nothing reaches a lease until a human has said yes to it. An
 * assistant that silently rewrites the rent is not a time-saver; the owner
 * would have no way to know, and the tenant would find out from a payment
 * demand.
 */

export const scanStatusSchema = z.enum(['uploading', 'scanning', 'review', 'committed', 'failed']);

export const extractedFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.string(),
  /** 0–1. Below 0.8 the UI must make the owner look. */
  confidence: z.number().min(0).max(1),
  /** The line it came from, so the owner can check it against the paper */
  sourceHint: z.string(),
  /** True when confidence alone is not enough to accept it unread */
  needsReview: z.boolean(),
});

export const contractScanSchema = z.object({
  id: z.string(),
  propertyId: z.string(),
  propertyLabel: z.string(),
  fileName: z.string(),
  fileUrl: z.string().nullable(),
  status: scanStatusSchema,
  uploadedAt: z.string(),
  committedAt: z.string().nullable(),
  fields: z.array(extractedFieldSchema),
  /** Looked for, not found — the UI asks the owner to fill these in */
  missing: z.array(z.string()),
});

export const contractScanListSchema = z.object({ scans: z.array(contractScanSchema) });

export const createScanSchema = z.object({
  propertyId: z.string(),
  fileName: z.string().trim().min(1).max(200),
  fileUrl: z.string().nullish(),
  /** Extracted text. Sent by the client so OCR can live wherever it belongs. */
  text: z.string().max(400_000),
});

/**
 * What the owner accepted, after reading it. Keys the owner did not send are
 * not written — silence is not consent.
 */
export const commitScanSchema = z.object({
  monthlyRent: z.number().int().positive().nullish(),
  deposit: z.number().int().nonnegative().nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  noticePeriodDays: z.number().int().min(0).max(365).nullish(),
  extensionMonths: z.number().int().min(0).max(120).nullish(),
});

export type ContractScanView = z.infer<typeof contractScanSchema>;
