import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';
import {
  DEFAULT_BUDGET_POLICY,
  evaluateBudget,
  type BudgetDecision,
  type BudgetPolicy,
  type Severity,
  type TicketCategory,
} from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';

/**
 * The owner's automatic-approval rule, and what it has already spent.
 *
 * Both halves are read fresh at decision time. A cached monthly total is how
 * two faults reported in the same minute both slip under a cap that only had
 * room for one.
 */
export async function policyFor(ownerId: string): Promise<BudgetPolicy> {
  const [row] = await db
    .select()
    .from(s.budgetPolicies)
    .where(eq(s.budgetPolicies.ownerId, ownerId));

  /* No row means never opted in, which means off. */
  if (!row) return DEFAULT_BUDGET_POLICY;

  return {
    enabled: row.enabled,
    perTicketCeilingAgorot: row.perTicketCeilingAgorot,
    monthlyCapAgorot: row.monthlyCapAgorot,
    categories: row.categories as TicketCategory[],
    includeUrgent: row.includeUrgent,
  };
}

/**
 * Estimates already approved automatically this calendar month, across every
 * property the owner holds.
 *
 * Estimates rather than receipts on purpose: the cap governs what may be
 * committed without asking, and the commitment happens at approval. Waiting for
 * receipts would let a month's worth of work be approved before any of it had
 * been counted.
 */
export async function autoApprovedThisMonth(ownerId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${s.tickets.estimateAgorot}), 0)::int` })
    .from(s.tickets)
    .innerJoin(s.properties, eq(s.properties.id, s.tickets.propertyId))
    .where(
      and(
        eq(s.properties.ownerId, ownerId),
        isNotNull(s.tickets.autoApprovedAt),
        gte(s.tickets.autoApprovedAt, startOfMonth),
      ),
    );

  return row?.total ?? 0;
}

/** The whole decision, for one about-to-be-created ticket. */
export async function decideAutoApproval(input: {
  ownerId: string;
  category: TicketCategory;
  severity: Severity;
}): Promise<BudgetDecision> {
  const policy = await policyFor(input.ownerId);

  /* The month's total is only needed if the feature is on, which is the
     uncommon case — no reason to aggregate the ticket table for an answer that
     cannot change the outcome. */
  const spentThisMonthAgorot = policy.enabled ? await autoApprovedThisMonth(input.ownerId) : 0;

  return evaluateBudget({
    policy,
    category: input.category,
    severity: input.severity,
    spentThisMonthAgorot,
  });
}
