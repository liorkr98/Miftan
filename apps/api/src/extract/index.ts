import type { ExtractedField } from '@miftan/shared';

/**
 * Reading a rental contract, behind an interface.
 *
 * This is the same shape as the storage seam and for the same reason: the
 * useful implementation is a paid external service, and the product should not
 * be written around one particular vendor's response format.
 *
 * The rule every implementation obeys: **extraction never commits anything.**
 * It produces candidates with a confidence and a place in the document to look,
 * and a human approves them. An AI that quietly rewrites the rent on a lease is
 * not a feature — the owner would have no way to know it happened, and the
 * tenant would find out from a payment demand.
 */

export interface ExtractionResult {
  fields: ExtractedField[];
  /** Keys we looked for and did not find, so the UI can ask for them */
  missing: string[];
}

export interface ContractExtractor {
  extract(input: { text: string; fileName: string }): Promise<ExtractionResult>;
}

/** Everything a lease record needs, in the order an owner reads a contract. */
export const WANTED = [
  { key: 'monthlyRent', label: 'שכר דירה חודשי' },
  { key: 'startDate', label: 'תחילת החוזה' },
  { key: 'endDate', label: 'סיום החוזה' },
  { key: 'deposit', label: 'פיקדון' },
  { key: 'noticePeriodDays', label: 'תקופת הודעה מוקדמת' },
  { key: 'extensionMonths', label: 'אופציית הארכה' },
  { key: 'tenantName', label: 'שם השוכר' },
  { key: 'address', label: 'כתובת הנכס' },
] as const;

export type WantedKey = (typeof WANTED)[number]['key'];
