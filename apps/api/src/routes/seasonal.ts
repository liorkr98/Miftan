import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  ApiError,
  expectedSaving,
  scheduleFor,
  seasonalActionSchema,
  seasonalListSchema,
  seasonalTaskSchema,
  seasonalToTicketSchema,
  templateById,
  ticketCategoryFor,
  type Amenity,
  type SeasonalTaskView,
} from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { resolveViewer, scopeFor } from '../policy/viewer.ts';

type TaskRow = typeof s.seasonalTasks.$inferSelect;
type PropertyRow = typeof s.properties.$inferSelect;

function project(task: TaskRow, property: PropertyRow): SeasonalTaskView | null {
  const template = templateById(task.templateId);
  /* A task whose template no longer exists is history we cannot describe.
     Dropping it beats rendering a row with an empty title. */
  if (!template) return null;

  return {
    id: task.id,
    templateId: task.templateId,
    propertyId: task.propertyId,
    propertyLabel: `${property.street} ${property.houseNumber}`,
    dueDate: task.dueDate,
    status: task.status,
    year: task.year,
    ticketId: task.ticketId,
    completedAt: task.completedAt?.toISOString() ?? null,
    title: template.title,
    why: template.why,
    season: template.season,
    typicalCost: template.typical_cost,
    avoidedCost: template.avoided_cost,
    failureRate: template.failure_rate,
    expectedSaving: expectedSaving(template),
  };
}

export async function seasonalRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  /**
   * The calendar for everything you own.
   *
   * Rows are materialised on first read rather than by a cron job: the set is
   * a pure function of (templates × your properties × this year), so computing
   * it on demand cannot drift, and there is no scheduler to go down quietly.
   */
  r.get(
    '/seasonal',
    { onRequest: [app.authenticate], schema: { response: { 200: seasonalListSchema } } },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const owned = [...viewer.ownedPropertyIds];
      if (owned.length === 0) return { tasks: [], outstandingExpectedSaving: 0 };

      const properties = await db
        .select()
        .from(s.properties)
        .where(and(inArray(s.properties.id, owned), isNull(s.properties.deletedAt)));

      /* The column is text[]; the domain says Amenity[]. Narrowed once, here. */
      const wanted = scheduleFor(
        properties.map((p) => ({ id: p.id, amenities: p.amenities as Amenity[] })),
      );
      const existing = await db
        .select()
        .from(s.seasonalTasks)
        .where(inArray(s.seasonalTasks.propertyId, owned));

      const seen = new Set(existing.map((t) => `${t.templateId}|${t.propertyId}|${t.year}`));
      const missing = wanted.filter((w) => !seen.has(`${w.templateId}|${w.propertyId}|${w.year}`));

      if (missing.length) {
        await db
          .insert(s.seasonalTasks)
          .values(
            missing.map((m) => ({
              id: newId('seasonalTask'),
              templateId: m.templateId,
              propertyId: m.propertyId,
              dueDate: m.dueDate,
              year: m.year,
              status: 'due' as const,
            })),
          )
          /* Two tabs opening the page at once must not collide. */
          .onConflictDoNothing();
      }

      const rows = await db
        .select()
        .from(s.seasonalTasks)
        .where(inArray(s.seasonalTasks.propertyId, owned))
        .orderBy(s.seasonalTasks.dueDate);

      const propertyById = new Map(properties.map((p) => [p.id, p]));
      const tasks = rows
        .map((t) => {
          const property = propertyById.get(t.propertyId);
          return property ? project(t, property) : null;
        })
        .filter((t): t is SeasonalTaskView => t !== null);

      return {
        tasks,
        /* Only what is still outstanding. Counting completed work as a future
           saving is how a dashboard starts lying to the person reading it. */
        outstandingExpectedSaving: tasks
          .filter((t) => t.status === 'due' || t.status === 'scheduled')
          .reduce((sum, t) => sum + t.expectedSaving, 0),
      };
    },
  );

  r.post(
    '/seasonal/:id/status',
    {
      onRequest: [app.authenticate],
      schema: {
        params: z.object({ id: z.string() }),
        body: seasonalActionSchema,
        response: { 200: seasonalTaskSchema },
      },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const { task, property } = await loadOwned(viewer, request.params.id);

      await db
        .update(s.seasonalTasks)
        .set({
          status: request.body.status,
          completedAt: request.body.status === 'done' ? new Date() : null,
        })
        .where(eq(s.seasonalTasks.id, task.id));

      const [after] = await db.select().from(s.seasonalTasks).where(eq(s.seasonalTasks.id, task.id));
      const view = project(after, property);
      if (!view) throw new ApiError('not_found', 'unknown template');
      return view;
    },
  );

  /**
   * Turning preventive work into real work.
   *
   * It becomes an ordinary maintenance ticket, so it goes through the same
   * vendor, scheduling and receipt flow as a leak. Preventive work that lives
   * in its own parallel system is preventive work that never gets booked.
   */
  r.post(
    '/seasonal/:id/schedule',
    {
      onRequest: [app.authenticate],
      schema: {
        params: z.object({ id: z.string() }),
        body: seasonalToTicketSchema.nullish(),
        response: { 200: seasonalTaskSchema },
      },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const { task, property } = await loadOwned(viewer, request.params.id);
      const template = templateById(task.templateId);
      if (!template) throw new ApiError('not_found', 'unknown template');
      if (task.ticketId) throw new ApiError('forbidden', 'already scheduled');

      const ticketId = newId('ticket');
      await db.transaction(async (tx) => {
        await tx.insert(s.tickets).values({
          id: ticketId,
          propertyId: task.propertyId,
          /* Null means the owner raised it; a tenant-reported ticket carries
             their id. Nobody reported this — the calendar did, on the owner's
             behalf. */
          tenantId: null,
          category: ticketCategoryFor(template),
          severity: request.body?.severity ?? 'medium',
          title: template.title,
          description: request.body?.note ?? template.why,
          /* Preventive work is approved by definition — the owner scheduling it
             *is* the approval, so it skips straight past `new`. */
          status: 'approved',
        });

        /* Same as any other ticket: the description opens the thread, so the
           tradesperson reads a conversation rather than a bare work order. */
        await tx.insert(s.ticketMessages).values({
          id: newId('ticketMessage'),
          ticketId,
          authorRole: 'owner',
          authorUserId: viewer.userId,
          authorName: request.currentUser!.name,
          body: request.body?.note ?? template.why,
        });
        await tx
          .update(s.seasonalTasks)
          .set({ status: 'scheduled', ticketId })
          .where(eq(s.seasonalTasks.id, task.id));
      });

      const [after] = await db.select().from(s.seasonalTasks).where(eq(s.seasonalTasks.id, task.id));
      const view = project(after, property);
      if (!view) throw new ApiError('not_found', 'unknown template');
      return view;
    },
  );
}

async function loadOwned(viewer: Awaited<ReturnType<typeof resolveViewer>>, id: string) {
  const [task] = await db.select().from(s.seasonalTasks).where(eq(s.seasonalTasks.id, id));
  if (!task || scopeFor(viewer, task.propertyId) !== 'owner') {
    throw new ApiError('not_found', 'no such task');
  }
  const [property] = await db.select().from(s.properties).where(eq(s.properties.id, task.propertyId));
  return { task, property };
}
