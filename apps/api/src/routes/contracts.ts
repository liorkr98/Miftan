import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  ApiError,
  commitScanSchema,
  contractScanListSchema,
  contractScanSchema,
  createScanSchema,
  toAgorot,
  type ContractScanView,
  type ExtractedField,
} from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { resolveViewer, scopeFor } from '../policy/viewer.ts';
import { createExtractor } from '../extract/patterns.ts';

type ScanRow = typeof s.contractScans.$inferSelect;
type PropertyRow = typeof s.properties.$inferSelect;

/** Below this, a human has to look at it before it can be used. */
const REVIEW_THRESHOLD = 0.8;

const extractor = createExtractor();

function project(scan: ScanRow, property: PropertyRow): ContractScanView {
  const fields = scan.fields as ExtractedField[];
  return {
    id: scan.id,
    propertyId: scan.propertyId,
    propertyLabel: `${property.street} ${property.houseNumber}`,
    fileName: scan.fileName,
    fileUrl: scan.fileUrl,
    status: scan.status,
    uploadedAt: scan.uploadedAt.toISOString(),
    committedAt: scan.committedAt?.toISOString() ?? null,
    fields: fields.map((f) => ({
      key: f.key,
      label: f.label,
      value: String(f.value),
      confidence: f.confidence,
      sourceHint: f.source_hint,
      /* Computed on read against the current threshold, not frozen at scan
         time: raising the bar has to affect scans already sitting in review. */
      needsReview: f.confidence < REVIEW_THRESHOLD,
    })),
    missing: scan.missing,
  };
}

export async function contractRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/contracts',
    { onRequest: [app.authenticate], schema: { response: { 200: contractScanListSchema } } },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const owned = [...viewer.ownedPropertyIds];
      if (owned.length === 0) return { scans: [] };

      const [scans, properties] = await Promise.all([
        db
          .select()
          .from(s.contractScans)
          .where(inArray(s.contractScans.propertyId, owned))
          .orderBy(desc(s.contractScans.uploadedAt)),
        db.select().from(s.properties).where(inArray(s.properties.id, owned)),
      ]);
      const byId = new Map(properties.map((p) => [p.id, p]));
      return { scans: scans.map((scan) => project(scan, byId.get(scan.propertyId)!)) };
    },
  );

  /**
   * Upload and read a contract.
   *
   * The scan runs inline because it is pattern matching over text, not a
   * long-running job. When an LLM extractor replaces it this becomes a queued
   * status transition — which is why `status` already has `scanning` in it.
   */
  r.post(
    '/contracts',
    {
      onRequest: [app.authenticate],
      schema: { body: createScanSchema, response: { 201: contractScanSchema } },
    },
    async (request, reply) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const { propertyId, fileName, fileUrl, text } = request.body;
      if (scopeFor(viewer, propertyId) !== 'owner') throw new ApiError('not_found', 'no such property');

      const id = newId('contractScan');
      let result;
      try {
        result = await extractor.extract({ text, fileName });
      } catch {
        /* A contract we cannot read is a state the owner needs to see, not an
           error swallowed into an empty list. */
        await db.insert(s.contractScans).values({
          id, ownerId: viewer.userId, propertyId, fileName,
          fileUrl: fileUrl ?? null, status: 'failed', fields: [], missing: [],
        });
        throw new ApiError('internal', 'could not read this contract');
      }

      await db.insert(s.contractScans).values({
        id,
        ownerId: viewer.userId,
        propertyId,
        fileName,
        fileUrl: fileUrl ?? null,
        /* Never `committed`. Reading a document and changing a lease are two
           different acts and only one of them is the owner's. */
        status: 'review',
        fields: result.fields,
        missing: result.missing,
      });

      const [scan] = await db.select().from(s.contractScans).where(eq(s.contractScans.id, id));
      const [property] = await db.select().from(s.properties).where(eq(s.properties.id, propertyId));
      return reply.code(201).send(project(scan, property));
    },
  );

  r.get(
    '/contracts/:id',
    {
      onRequest: [app.authenticate],
      schema: { params: z.object({ id: z.string() }), response: { 200: contractScanSchema } },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const { scan, property } = await loadOwned(viewer, request.params.id);
      return project(scan, property);
    },
  );

  /**
   * Writing the approved values onto the lease.
   *
   * The body is what the owner confirmed, not what the scan found — the two are
   * deliberately different objects. A value the owner did not send is not
   * written, because an unticked box is not agreement.
   */
  r.post(
    '/contracts/:id/commit',
    {
      onRequest: [app.authenticate],
      schema: {
        params: z.object({ id: z.string() }),
        body: commitScanSchema,
        response: { 200: contractScanSchema },
      },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const { scan, property } = await loadOwned(viewer, request.params.id);
      if (scan.status === 'committed') throw new ApiError('forbidden', 'already applied');

      const b = request.body;
      const [lease] = await db
        .select()
        .from(s.leases)
        .where(and(eq(s.leases.propertyId, scan.propertyId), isNull(s.leases.deletedAt)))
        .orderBy(desc(s.leases.endDate))
        .limit(1);
      if (!lease) throw new ApiError('forbidden', 'this property has no lease to update');

      /* Shekels at the boundary, agorot everywhere inside. */
      const patch = {
        ...(b.monthlyRent != null ? { monthlyRentAgorot: toAgorot(b.monthlyRent) } : {}),
        ...(b.deposit != null ? { depositAgorot: toAgorot(b.deposit) } : {}),
        ...(b.startDate ? { startDate: b.startDate } : {}),
        ...(b.endDate ? { endDate: b.endDate } : {}),
        ...(b.noticePeriodDays != null ? { noticePeriodDays: b.noticePeriodDays } : {}),
        ...(b.extensionMonths != null
          ? { extensionMonths: b.extensionMonths, hasExtensionOption: b.extensionMonths > 0 }
          : {}),
      };

      if (Object.keys(patch).length === 0) {
        throw new ApiError('validation_failed', 'nothing was approved', {
          body: ['confirm at least one field before applying'],
        });
      }

      await db.transaction(async (tx) => {
        await tx.update(s.leases).set({ ...patch, updatedAt: new Date() }).where(eq(s.leases.id, lease.id));

        /* The rent lives on the property too, and a lease that disagrees with
           its unit is how a rent roll goes wrong. */
        if (patch.monthlyRentAgorot) {
          await tx
            .update(s.properties)
            .set({ monthlyRentAgorot: patch.monthlyRentAgorot, updatedAt: new Date() })
            .where(eq(s.properties.id, scan.propertyId));
        }

        await tx
          .update(s.contractScans)
          .set({ status: 'committed', committedAt: new Date() })
          .where(eq(s.contractScans.id, scan.id));
      });

      const [after] = await db.select().from(s.contractScans).where(eq(s.contractScans.id, scan.id));
      return project(after, property);
    },
  );
}

async function loadOwned(viewer: Awaited<ReturnType<typeof resolveViewer>>, id: string) {
  const [scan] = await db.select().from(s.contractScans).where(eq(s.contractScans.id, id));
  if (!scan || scopeFor(viewer, scan.propertyId) !== 'owner') {
    throw new ApiError('not_found', 'no such scan');
  }
  const [property] = await db.select().from(s.properties).where(eq(s.properties.id, scan.propertyId));
  return { scan, property };
}
