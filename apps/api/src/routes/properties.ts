import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  ApiError,
  cityEntry,
  createPropertySchema,
  districtOf,
  propertyListSchema,
  propertyViewSchema,
  setPhotosSchema,
  toAgorot,
  updatePropertySchema,
} from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { ANONYMOUS, resolveViewer, scopeFor, type Viewer } from '../policy/viewer.ts';
import { loadPropertyContexts, projectProperty } from '../policy/properties.ts';

async function viewerFor(request: FastifyRequest): Promise<Viewer> {
  return request.currentUser ? resolveViewer(request.currentUser.id) : ANONYMOUS;
}

export async function propertyRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  /**
   * Everything this viewer has a relationship with: what they own and what
   * they rent. Not a search — that is `/search`, and it is a different
   * question with a different answer.
   */
  r.get(
    '/properties',
    { onRequest: [app.authenticate], schema: { response: { 200: propertyListSchema } } },
    async (request) => {
      const viewer = await viewerFor(request);
      const ids = [...viewer.ownedPropertyIds, ...viewer.tenantPropertyIds];
      if (ids.length === 0) return { properties: [] };

      const rows = await db
        .select()
        .from(s.properties)
        .where(and(inArray(s.properties.id, ids), isNull(s.properties.deletedAt)))
        .orderBy(desc(s.properties.createdAt));

      const contexts = await loadPropertyContexts(viewer, rows);
      return { properties: contexts.map((ctx) => projectProperty(viewer, ctx)) };
    },
  );

  /**
   * The seeker-facing market: listed units only, and only ever the public
   * shape — even for the owner of one of them, because this endpoint answers
   * "what does the market look like", not "what do I own".
   */
  r.get(
    '/search',
    { onRequest: [app.optionalAuth], schema: { response: { 200: propertyListSchema } } },
    async (request) => {
      const viewer = await viewerFor(request);

      const rows = await db
        .select()
        .from(s.properties)
        .where(and(eq(s.properties.listed, true), isNull(s.properties.deletedAt)));

      const contexts = await loadPropertyContexts(ANONYMOUS, rows);
      /* Projected against ANONYMOUS deliberately: a landlord browsing the
         market sees their own flat the way a seeker does. */
      void viewer;
      return { properties: contexts.map((ctx) => projectProperty(ANONYMOUS, ctx)) };
    },
  );

  r.get(
    '/properties/:id',
    {
      onRequest: [app.optionalAuth],
      schema: { params: z.object({ id: z.string() }), response: { 200: propertyViewSchema } },
    },
    async (request) => {
      const viewer = await viewerFor(request);

      const [row] = await db
        .select()
        .from(s.properties)
        .where(and(eq(s.properties.id, request.params.id), isNull(s.properties.deletedAt)));

      if (!row) throw new ApiError('not_found', 'no such property');

      /* A property nobody published is invisible to anyone without a
         relationship to it — and it 404s rather than 403s, because "that
         exists but is not yours" is itself a disclosure. */
      if (scopeFor(viewer, row.id) === 'public' && !row.listed) {
        throw new ApiError('not_found', 'no such property');
      }

      const [ctx] = await loadPropertyContexts(viewer, [row]);
      return projectProperty(viewer, ctx);
    },
  );
  /**
   * Replacing a listing's photos.
   *
   * The client uploads through the presigned flow and sends back the resulting
   * URLs in the order they should appear — the first is the cover. Sending the
   * whole array makes reordering and deleting the same operation as adding,
   * which is the only way "drag to reorder" does not need its own endpoint.
   */
  r.put(
    '/properties/:id/photos',
    {
      onRequest: [app.authenticate],
      schema: {
        params: z.object({ id: z.string() }),
        body: setPhotosSchema,
        response: { 200: propertyViewSchema },
      },
    },
    async (request) => {
      const viewer = await viewerFor(request);
      if (scopeFor(viewer, request.params.id) !== 'owner') {
        throw new ApiError('not_found', 'no such property');
      }

      await db
        .update(s.properties)
        .set({ photos: request.body.photos, updatedAt: new Date() })
        .where(eq(s.properties.id, request.params.id));

      const [row] = await db.select().from(s.properties).where(eq(s.properties.id, request.params.id));
      const [ctx] = await loadPropertyContexts(viewer, [row]);
      return projectProperty(viewer, ctx);
    },
  );

  /**
   * Adding a unit. Shekels in, agorot stored. District is derived from the
   * city so a market query never has to join a lookup for a value that cannot
   * change without the address changing.
   */
  r.post(
    '/properties',
    {
      onRequest: [app.authenticate],
      schema: { body: createPropertySchema, response: { 201: propertyViewSchema } },
    },
    async (request, reply) => {
      const ownerId = request.currentUser!.id;
      const b = request.body;

      if (b.floor > b.totalFloors) {
        throw new ApiError('validation_failed', 'floor cannot be above total floors');
      }

      const city = cityEntry(b.city);
      const lat = b.lat ?? city?.lat;
      const lng = b.lng ?? city?.lng;
      if (lat == null || lng == null) {
        throw new ApiError('validation_failed', 'city is not in the catalogue; provide lat and lng');
      }

      const id = newId('property');
      await db.insert(s.properties).values({
        id,
        ownerId,
        street: b.street,
        houseNumber: b.houseNumber,
        city: b.city,
        neighborhood: b.neighborhood,
        lat: String(lat),
        lng: String(lng),
        rooms: String(b.rooms),
        sqm: b.sqm,
        floor: b.floor,
        totalFloors: b.totalFloors,
        amenities: b.amenities,
        monthlyRentAgorot: toAgorot(b.monthlyRentShekels),
        arnonaBimonthlyAgorot: toAgorot(b.arnonaBimonthlyShekels ?? 0),
        vaadMonthlyAgorot: toAgorot(b.vaadMonthlyShekels ?? 0),
        district: districtOf(b.city) ?? null,
        status: b.status,
        listed: b.listed,
        notes: b.notes ?? null,
        availableFrom: b.availableFrom ?? null,
        availabilityConfidence: b.availabilityConfidence ?? 'unknown',
      });

      const viewer = await resolveViewer(ownerId);
      const [row] = await db.select().from(s.properties).where(eq(s.properties.id, id));
      const [ctx] = await loadPropertyContexts(viewer, [row]);
      return reply.code(201).send(projectProperty(viewer, ctx));
    },
  );

  r.patch(
    '/properties/:id',
    {
      onRequest: [app.authenticate],
      schema: {
        params: z.object({ id: z.string() }),
        body: updatePropertySchema,
        response: { 200: propertyViewSchema },
      },
    },
    async (request) => {
      const viewer = await viewerFor(request);
      if (scopeFor(viewer, request.params.id) !== 'owner') {
        throw new ApiError('not_found', 'no such property');
      }

      const [existing] = await db
        .select()
        .from(s.properties)
        .where(and(eq(s.properties.id, request.params.id), isNull(s.properties.deletedAt)));
      if (!existing) throw new ApiError('not_found', 'no such property');

      const b = request.body;
      const city = b.city ?? existing.city;
      const cityMeta = cityEntry(city);
      const lat = b.lat ?? (b.city ? cityMeta?.lat : undefined);
      const lng = b.lng ?? (b.city ? cityMeta?.lng : undefined);
      const floor = b.floor ?? existing.floor;
      const totalFloors = b.totalFloors ?? existing.totalFloors;
      if (floor > totalFloors) {
        throw new ApiError('validation_failed', 'floor cannot be above total floors');
      }

      await db
        .update(s.properties)
        .set({
          ...(b.street !== undefined ? { street: b.street } : {}),
          ...(b.houseNumber !== undefined ? { houseNumber: b.houseNumber } : {}),
          ...(b.city !== undefined ? { city: b.city, district: districtOf(b.city) ?? null } : {}),
          ...(b.neighborhood !== undefined ? { neighborhood: b.neighborhood } : {}),
          ...(lat !== undefined ? { lat: String(lat) } : {}),
          ...(lng !== undefined ? { lng: String(lng) } : {}),
          ...(b.rooms !== undefined ? { rooms: String(b.rooms) } : {}),
          ...(b.sqm !== undefined ? { sqm: b.sqm } : {}),
          ...(b.floor !== undefined ? { floor: b.floor } : {}),
          ...(b.totalFloors !== undefined ? { totalFloors: b.totalFloors } : {}),
          ...(b.amenities !== undefined ? { amenities: b.amenities } : {}),
          ...(b.monthlyRentShekels !== undefined
            ? { monthlyRentAgorot: toAgorot(b.monthlyRentShekels) }
            : {}),
          ...(b.arnonaBimonthlyShekels !== undefined
            ? { arnonaBimonthlyAgorot: toAgorot(b.arnonaBimonthlyShekels) }
            : {}),
          ...(b.vaadMonthlyShekels !== undefined
            ? { vaadMonthlyAgorot: toAgorot(b.vaadMonthlyShekels) }
            : {}),
          ...(b.status !== undefined ? { status: b.status } : {}),
          ...(b.listed !== undefined ? { listed: b.listed } : {}),
          ...(b.notes !== undefined ? { notes: b.notes } : {}),
          ...(b.availableFrom !== undefined ? { availableFrom: b.availableFrom } : {}),
          ...(b.availabilityConfidence !== undefined
            ? { availabilityConfidence: b.availabilityConfidence }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(s.properties.id, request.params.id));

      const [row] = await db.select().from(s.properties).where(eq(s.properties.id, request.params.id));
      const [ctx] = await loadPropertyContexts(viewer, [row]);
      return projectProperty(viewer, ctx);
    },
  );
}
