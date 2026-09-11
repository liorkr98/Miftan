import { z } from 'zod';
import { ticketCategorySchema } from './tickets';

/** The owner's automatic-approval rule, and what it has spent this month. */

export const budgetPolicySchema = z.object({
  enabled: z.boolean(),
  perTicketCeilingAgorot: z.number().int().min(0),
  monthlyCapAgorot: z.number().int().min(0),
  categories: z.array(ticketCategorySchema),
  includeUrgent: z.boolean(),
  /* Read-only, and recomputed on every read: a stored figure would be a claim
     about a month that has since moved on. */
  spentThisMonthAgorot: z.number().int(),
  remainingThisMonthAgorot: z.number().int(),
  autoApprovedThisMonth: z.number().int(),
});

export const updateBudgetPolicySchema = z.object({
  enabled: z.boolean().optional(),
  /* Capped rather than unbounded. An accidental extra zero on a ceiling is the
     failure this feature must not have. */
  perTicketCeilingShekels: z.number().int().min(0).max(20_000).optional(),
  monthlyCapShekels: z.number().int().min(0).max(200_000).optional(),
  categories: z.array(ticketCategorySchema).optional(),
  includeUrgent: z.boolean().optional(),
});

export type BudgetPolicyView = z.infer<typeof budgetPolicySchema>;
