import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { meSchema } from '@miftach/shared';
import { db, schema as s } from '../db/client.ts';
import { capabilitiesFor } from '../lib/capabilities.ts';
import { requireUser } from '../plugins/authenticate.ts';

export async function meRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/me',
    { onRequest: [app.authenticate], schema: { response: { 200: meSchema } } },
    async (request) => {
      const { id } = requireUser(request);
      const [user] = await db.select().from(s.users).where(eq(s.users.id, id));
      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          createdAt: user.createdAt.toISOString(),
        },
        capabilities: await capabilitiesFor(id),
      };
    },
  );
}
