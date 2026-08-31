import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  ApiError,
  comparisonSchema,
  protocolItems,
  protocolListSchema,
  protocolRunSchema,
  startProtocolSchema,
  updateEntrySchema,
  type ComparisonView,
  type ProtocolRunView,
} from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { resolveViewer, scopeFor, type Viewer } from '../policy/viewer.ts';

type RunRow = typeof s.protocolRuns.$inferSelect;
type EntryRow = typeof s.protocolEntries.$inferSelect;
type PropertyRow = typeof s.properties.$inferSelect;

const REQUIRED = protocolItems.filter((i) => i.required).map((i) => i.id);

function project(
  run: RunRow,
  property: PropertyRow,
  entries: EntryRow[],
  tenantName: string | null,
): ProtocolRunView {
  const byItem = new Map(entries.map((e) => [e.itemId, e]));
  return {
    id: run.id,
    propertyId: property.id,
    propertyLabel: `${property.street} ${property.houseNumber}`,
    kind: run.kind,
    tenantName,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    signed: run.signed,
    /* Driven by the catalogue, not by whatever rows happen to exist: an item
       added to the checklist has to show up on runs already in progress, or the
       protocol quietly stops covering it. */
    entries: protocolItems.map((item) => {
      const e = byItem.get(item.id);
      return {
        itemId: item.id,
        done: e?.done ?? false,
        value: e?.value ?? null,
        photos: e?.photos ?? [],
        note: e?.note ?? null,
      };
    }),
    missingRequired: REQUIRED.filter((id) => !byItem.get(id)?.done),
  };
}

/** Both parties to a run: the owner of the flat, and its tenant. */
function partyTo(viewer: Viewer, run: RunRow): boolean {
  const scope = scopeFor(viewer, run.propertyId);
  return scope === 'owner' || (scope === 'tenant' && run.tenantId === viewer.userId);
}

export async function protocolRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/protocols',
    { onRequest: [app.authenticate], schema: { response: { 200: protocolListSchema } } },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const properties = [...viewer.ownedPropertyIds, ...viewer.tenantPropertyIds];
      if (properties.length === 0) return { runs: [] };

      const runs = await db
        .select()
        .from(s.protocolRuns)
        .where(inArray(s.protocolRuns.propertyId, properties))
        .orderBy(desc(s.protocolRuns.startedAt));

      const visible = runs.filter((run) => partyTo(viewer, run));
      return { runs: await projectMany(visible) };
    },
  );

  r.get(
    '/protocols/:id',
    {
      onRequest: [app.authenticate],
      schema: { params: z.object({ id: z.string() }), response: { 200: protocolRunSchema } },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const run = await loadRun(viewer, request.params.id);
      const [view] = await projectMany([run]);
      return view;
    },
  );

  /** The owner opens a run. A move-out needs a move-in to be worth anything. */
  r.post(
    '/protocols',
    {
      onRequest: [app.authenticate],
      schema: { body: startProtocolSchema, response: { 201: protocolRunSchema } },
    },
    async (request, reply) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const { propertyId, kind } = request.body;
      if (scopeFor(viewer, propertyId) !== 'owner') throw new ApiError('not_found', 'no such property');

      const [open] = await db
        .select()
        .from(s.protocolRuns)
        .where(and(eq(s.protocolRuns.propertyId, propertyId), isNull(s.protocolRuns.completedAt)));
      if (open) throw new ApiError('forbidden', 'a protocol is already open on this property');

      const [lease] = await db
        .select()
        .from(s.leases)
        .where(and(eq(s.leases.propertyId, propertyId), isNull(s.leases.deletedAt)))
        .orderBy(desc(s.leases.endDate))
        .limit(1);

      const id = newId('protocolRun');
      await db.insert(s.protocolRuns).values({
        id,
        propertyId,
        kind,
        leaseId: lease?.id ?? null,
        /* Recorded on the run so a later lease change cannot rewrite who was
           standing in the flat on the day. */
        tenantId: lease?.tenantId ?? null,
      });

      const [run] = await db.select().from(s.protocolRuns).where(eq(s.protocolRuns.id, id));
      const [view] = await projectMany([run]);
      return reply.code(201).send(view);
    },
  );

  /**
   * Filling in one item. Either party may write: a tenant who cannot record
   * that the wall was already cracked has no protection from the protocol.
   */
  r.patch(
    '/protocols/:id/entries/:itemId',
    {
      onRequest: [app.authenticate],
      schema: {
        params: z.object({ id: z.string(), itemId: z.string() }),
        body: updateEntrySchema,
        response: { 200: protocolRunSchema },
      },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const run = await loadRun(viewer, request.params.id);
      if (run.completedAt) throw new ApiError('forbidden', 'this protocol is closed');

      const item = protocolItems.find((i) => i.id === request.params.itemId);
      if (!item) throw new ApiError('not_found', 'no such checklist item');

      const { done, value, photos, note } = request.body;
      await db
        .insert(s.protocolEntries)
        .values({
          id: newId('protocolEntry'),
          runId: run.id,
          itemId: item.id,
          done: done ?? true,
          value: value ?? null,
          photos: photos ?? [],
          note: note ?? null,
        })
        .onConflictDoUpdate({
          target: [s.protocolEntries.runId, s.protocolEntries.itemId],
          set: {
            /* Only what was sent. A client updating a note must not silently
               wipe the photo somebody else attached. */
            ...(done !== undefined ? { done } : {}),
            ...(value !== undefined ? { value: value ?? null } : {}),
            ...(photos !== undefined ? { photos } : {}),
            ...(note !== undefined ? { note: note ?? null } : {}),
          },
        });

      const [view] = await projectMany([run]);
      return view;
    },
  );

  /** Closing it. Every required item has to be answered first. */
  r.post(
    '/protocols/:id/complete',
    {
      onRequest: [app.authenticate],
      schema: { params: z.object({ id: z.string() }), response: { 200: protocolRunSchema } },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const run = await loadRun(viewer, request.params.id);
      if (scopeFor(viewer, run.propertyId) !== 'owner') throw new ApiError('not_found', 'no such protocol');

      const [current] = await projectMany([run]);
      if (current.missingRequired.length > 0) {
        throw new ApiError('validation_failed', 'required items are unanswered', {
          missingRequired: current.missingRequired,
        });
      }

      await db
        .update(s.protocolRuns)
        .set({ completedAt: new Date(), signed: true })
        .where(eq(s.protocolRuns.id, run.id));

      const [after] = await db.select().from(s.protocolRuns).where(eq(s.protocolRuns.id, run.id));
      const [view] = await projectMany([after]);
      return view;
    },
  );

  /**
   * Move-in against move-out, item by item.
   *
   * This is the thing the whole surface exists for. A deposit argument is
   * settled by two readings of the same meter and two photos of the same wall,
   * so `changed` marks exactly the rows worth discussing and nothing else.
   */
  r.get(
    '/protocols/compare/:propertyId',
    {
      onRequest: [app.authenticate],
      schema: { params: z.object({ propertyId: z.string() }), response: { 200: comparisonSchema } },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const { propertyId } = request.params;
      const scope = scopeFor(viewer, propertyId);
      if (scope !== 'owner' && scope !== 'tenant') throw new ApiError('not_found', 'no such property');

      const [property] = await db.select().from(s.properties).where(eq(s.properties.id, propertyId));
      if (!property) throw new ApiError('not_found', 'no such property');

      const runs = await db
        .select()
        .from(s.protocolRuns)
        .where(eq(s.protocolRuns.propertyId, propertyId))
        .orderBy(desc(s.protocolRuns.startedAt));

      const mine = runs.filter((run) => partyTo(viewer, run));
      const moveIn = mine.find((r2) => r2.kind === 'move_in') ?? null;
      const moveOut = mine.find((r2) => r2.kind === 'move_out') ?? null;

      const ids = [moveIn?.id, moveOut?.id].filter((x): x is string => Boolean(x));
      const entries = ids.length
        ? await db.select().from(s.protocolEntries).where(inArray(s.protocolEntries.runId, ids))
        : [];

      const inBy = new Map(entries.filter((e) => e.runId === moveIn?.id).map((e) => [e.itemId, e]));
      const outBy = new Map(entries.filter((e) => e.runId === moveOut?.id).map((e) => [e.itemId, e]));

      const view: ComparisonView = {
        propertyId,
        propertyLabel: `${property.street} ${property.houseNumber}`,
        moveInRunId: moveIn?.id ?? null,
        moveOutRunId: moveOut?.id ?? null,
        rows: protocolItems.map((item) => {
          const a = inBy.get(item.id);
          const b = outBy.get(item.id);
          return {
            itemId: item.id,
            label: item.label,
            section: item.section,
            moveIn: a?.value ?? null,
            moveOut: b?.value ?? null,
            moveInPhotos: a?.photos ?? [],
            moveOutPhotos: b?.photos ?? [],
            /* Only when both sides were actually recorded. A missing reading is
               an unanswered question, not evidence of a change. */
            changed: a?.value != null && b?.value != null && a.value !== b.value,
          };
        }),
      };
      return view;
    },
  );
}

/* ── helpers ─────────────────────────────────────────────── */

async function loadRun(viewer: Viewer, id: string): Promise<RunRow> {
  const [run] = await db.select().from(s.protocolRuns).where(eq(s.protocolRuns.id, id));
  if (!run || !partyTo(viewer, run)) throw new ApiError('not_found', 'no such protocol');
  return run;
}

async function projectMany(runs: RunRow[]): Promise<ProtocolRunView[]> {
  if (runs.length === 0) return [];
  const [properties, entries, tenants] = await Promise.all([
    db.select().from(s.properties).where(inArray(s.properties.id, runs.map((r) => r.propertyId))),
    db.select().from(s.protocolEntries).where(inArray(s.protocolEntries.runId, runs.map((r) => r.id))),
    (() => {
      const ids = runs.map((r) => r.tenantId).filter((x): x is string => Boolean(x));
      return ids.length
        ? db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(inArray(s.users.id, ids))
        : Promise.resolve([]);
    })(),
  ]);

  const propertyById = new Map(properties.map((p) => [p.id, p]));
  const tenantById = new Map(tenants.map((u) => [u.id, u.name]));
  return runs.map((run) =>
    project(
      run,
      propertyById.get(run.propertyId)!,
      entries.filter((e) => e.runId === run.id),
      run.tenantId ? (tenantById.get(run.tenantId) ?? null) : null,
    ),
  );
}
