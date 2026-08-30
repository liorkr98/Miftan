import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { ApiError } from '@miftach/shared';
import { MAX_UPLOAD_BYTES, assertUploadable, createStorage, localDriver } from '../storage/index.ts';
import { env } from '../lib/env.ts';

const signSchema = z.object({
  folder: z.enum(['tickets', 'receipts', 'protocol', 'properties']),
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1).max(100),
});

const targetSchema = z.object({
  uploadUrl: z.string(),
  publicUrl: z.string(),
  key: z.string(),
  expiresIn: z.number().int(),
});

export async function uploadRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const storage = createStorage();

  /** Ask for somewhere to put a file. Authenticated: uploads are not free. */
  r.post(
    '/uploads/sign',
    { onRequest: [app.authenticate], schema: { body: signSchema, response: { 200: targetSchema } } },
    async (request) => {
      assertUploadable(request.body.contentType);
      return storage.createUpload(request.body);
    },
  );

  /* The next two exist only for the local driver. Against R2 the client PUTs
     straight to object storage and neither route is reachable. */
  if (env.NODE_ENV === 'production') return;

  app.addContentTypeParser(
    ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'],
    { parseAs: 'buffer', bodyLimit: MAX_UPLOAD_BYTES },
    (_req, body, done) => done(null, body),
  );

  app.put<{ Params: { '*': string } }>('/uploads/*', async (request, reply) => {
    const key = request.params['*'];
    if (!Buffer.isBuffer(request.body)) throw new ApiError('validation_failed', 'expected a file body');
    await localDriver.write(key, request.body);
    return reply.code(204).send();
  });

  app.get<{ Params: { '*': string } }>('/files/*', async (request, reply) => {
    const target = resolve(localDriver.root, request.params['*']);
    if (!target.startsWith(localDriver.root)) throw new ApiError('not_found', 'no such file');
    try {
      await stat(target);
    } catch {
      throw new ApiError('not_found', 'no such file');
    }
    return reply.send(createReadStream(target));
  });
}
