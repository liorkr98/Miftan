import { z } from 'zod';

/** Vendors and expenses — the supporting cast around the ticket flow. */

export const vendorSchema = z.object({
  id: z.string(),
  name: z.string(),
  trade: z.enum(['plumber', 'electrician', 'ac_tech', 'locksmith', 'painter', 'pest', 'handyman']),
  phone: z.string(),
  areas: z.array(z.string()),
  rating: z.number(),
  jobsDone: z.number().int(),
  avgResponseHours: z.number().int(),
  calloutFeeAgorot: z.number().int(),
  /** Disclosed commercial relationship. Never affects ordering. */
  isNetworkPartner: z.boolean(),
  note: z.string().nullable(),
});

export const vendorListSchema = z.object({ vendors: z.array(vendorSchema) });

export const expenseSchema = z.object({
  id: z.string(),
  propertyId: z.string(),
  propertyLabel: z.string(),
  kind: z.enum(['maintenance', 'improvement']),
  category: z.string(),
  amountAgorot: z.number().int(),
  vendorName: z.string().nullable(),
  date: z.string(),
  ticketId: z.string().nullable(),
  receiptFile: z.string().nullable(),
  documentType: z.enum(['tax_invoice', 'receipt', 'none']),
  note: z.string().nullable(),
});

export const expenseListSchema = z.object({
  expenses: z.array(expenseSchema),
  totalAgorot: z.number().int(),
});

export type VendorView = z.infer<typeof vendorSchema>;
export type ExpenseView = z.infer<typeof expenseSchema>;
