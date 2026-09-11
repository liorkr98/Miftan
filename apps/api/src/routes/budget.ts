import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';
import {
  budgetPolicySchema,
  toAgorot,
  updateBudgetPolicySchema,
  type TicketCategory,
} from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { autoApprovedThisMonth, policyFor } from '../policy/budget.ts';

export async function budgetRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  async function current(ownerId: string) {
    const policy = await policyFor(ownerId);
    const spent = await autoApprovedThisMonth(ownerId);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.tickets)
      .innerJoin(s.properties, eq(s.properties.id, s.tickets.propertyId))
      .where(
        and(
          eq(s.properties.ownerId, ownerId),
          isNotNull(s.tickets.autoApprovedAt),
          gte(s.tickets.autoApprovedAt, startOfMonth),
        ),
      );

    return {
      ...policy,
      spentThisMonthAgorot: spent,
      /* Never negative. A cap lowered mid-month below what has already gone out
         means nothing further is approved — not that the owner is owed money. */
      remainingThisMonthAgorot: Math.max(0, policy.monthlyCapAgorot - spent),
      autoApprovedThisMonth: n,
    };
  }

  r.get(
    '/budget',
    { onRequest: [app.authenticate], schema: { response: { 200: budgetPolicySchema } } },
    async (request) => current(request.currentUser!.id),
  );

  /**
   * Shekels in, agorot stored. The owner types 500, not 50000 — and a settings
   * form is exactly where a units mistake becomes an expensive one.
   */
  r.patch(
    '/budget',
    {
      onRequest: [app.authenticate],
      schema: { body: updateBudgetPolicySchema, response: { 200: budgetPolicySchema } },
    },
    async (request) => {
      const ownerId = request.currentUser!.id;
      const b = request.body;
      const existing = await policyFor(ownerId);

      const next = {
        enabled: b.enabled ?? existing.enabled,
        perTicketCeilingAgorot:
          b.perTicketCeilingShekels != null
            ? toAgorot(b.perTicketCeilingShekels)
            : existing.perTicketCeilingAgorot,
        monthlyCapAgorot:
          b.monthlyCapShekels != null ? toAgorot(b.monthlyCapShekels) : existing.monthlyCapAgorot,
        categories: (b.categories ?? existing.categories) as TicketCategory[],
        includeUrgent: b.includeUrgent ?? existing.includeUrgent,
      };

      await db
        .insert(s.budgetPolicies)
        .values({ ownerId, ...next, categories: next.categories })
        .onConflictDoUpdate({
          target: s.budgetPolicies.ownerId,
          set: { ...next, categories: next.categories, updatedAt: new Date() },
        });

      return current(ownerId);
    },
  );
}
