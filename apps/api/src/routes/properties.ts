import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { ApiError, propertyListSchema, propertyViewSchema } from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
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
}
