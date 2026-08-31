import { z } from 'zod';

/**
 * פרוטוקול כניסה / יציאה.
 *
 * Both parties see the same run. That is not a convenience — a protocol only
 * settles a dispute if the tenant saw and could contest it at the time, so a
 * landlord-only checklist is worth nothing when it matters.
 *
 * The move-in and move-out runs share an item list on purpose: the whole value
 * is putting the two side by side, which `compare` returns.
 */

export const protocolKindSchema = z.enum(['move_in', 'move_out']);

export const protocolEntrySchema = z.object({
  itemId: z.string(),
  done: z.boolean(),
  /** Meter reading, key count, or a note on condition */
  value: z.string().nullable(),
  photos: z.array(z.string()),
  note: z.string().nullable(),
});

export const protocolRunSchema = z.object({
  id: z.string(),
  propertyId: z.string(),
  propertyLabel: z.string(),
  kind: protocolKindSchema,
  tenantName: z.string().nullable(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  signed: z.boolean(),
  entries: z.array(protocolEntrySchema),
  /** Required items still outstanding — what stops it being completed */
  missingRequired: z.array(z.string()),
});

export const protocolListSchema = z.object({ runs: z.array(protocolRunSchema) });

export const startProtocolSchema = z.object({
  propertyId: z.string(),
  kind: protocolKindSchema,
});

export const updateEntrySchema = z.object({
  done: z.boolean().optional(),
  value: z.string().trim().max(300).nullish(),
  photos: z.array(z.string()).max(12).optional(),
  note: z.string().trim().max(600).nullish(),
});

/* ── The comparison ────────────────────────────────────── */

export const comparisonRowSchema = z.object({
  itemId: z.string(),
  label: z.string(),
  section: z.string(),
  moveIn: z.string().nullable(),
  moveOut: z.string().nullable(),
  moveInPhotos: z.array(z.string()),
  moveOutPhotos: z.array(z.string()),
  /** True when the two readings differ — the rows worth arguing about */
  changed: z.boolean(),
});

export const comparisonSchema = z.object({
  propertyId: z.string(),
  propertyLabel: z.string(),
  moveInRunId: z.string().nullable(),
  moveOutRunId: z.string().nullable(),
  rows: z.array(comparisonRowSchema),
});

export type ProtocolRunView = z.infer<typeof protocolRunSchema>;
export type ComparisonView = z.infer<typeof comparisonSchema>;
