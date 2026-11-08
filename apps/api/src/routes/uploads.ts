import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ApiError } from '@miftan/shared';
import { MAX_UPLOAD_BYTES, assertSize, assertUploadable, createStorage, fileBucket } from '../storage/index.ts';
import { verifyFileUrl } from '../storage/files.ts';
import { uploadBurst } from '../lib/rate-limit.ts';

const signSchema = z.object({
  folder: z.enum(['tickets', 'receipts', 'protocol', 'properties', 'contracts']),
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1).max(100),
  size: z.number().int().positive(),
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
    { onRequest: [uploadBurst, app.authenticate], schema: { body: signSchema, response: { 200: targetSchema } } },
    async (request) => {
      assertUploadable(request.body.contentType);
      assertSize(request.body.size);
      return storage.createUpload(request.body);
    },
  );

  /* The next two serve the bound bucket. With S3 keys configured the client
     talks to object storage directly and nothing it holds points here. */
  app.addContentTypeParser(
    ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'],
    { parseAs: 'buffer', bodyLimit: MAX_UPLOAD_BYTES },
    (_req, body, done) => done(null, body),
  );

  const fileQuery = z.record(z.string(), z.string().optional());

  app.put<{ Params: { '*': string }; Querystring: Record<string, string | undefined> }>(
    '/uploads/*',
    { schema: { querystring: fileQuery } },
    async (request, reply) => {
      const key = request.params['*'];
      const q = request.query;
      if (!verifyFileUrl('uploads', key, q, ['ct', 'size'])) {
        throw new ApiError('forbidden', 'this upload link is not valid');
      }
      if (!Buffer.isBuffer(request.body)) throw new ApiError('validation_failed', 'expected a file body');
      /* The link was issued for one type and one size, and is good for nothing else. */
      if (request.headers['content-type'] !== q.ct || request.body.length !== Number(q.size)) {
        throw new ApiError('validation_failed', 'the file does not match the upload link');
      }
      await fileBucket().put(key, request.body, { httpMetadata: { contentType: q.ct } });
      return reply.code(204).send();
    },
  );

  app.get<{ Params: { '*': string }; Querystring: Record<string, string | undefined> }>(
    '/files/*',
    { schema: { querystring: fileQuery } },
    async (request, reply) => {
      const key = request.params['*'];
      if (!verifyFileUrl('files', key, request.query)) throw new ApiError('not_found', 'no such file');
      const file = await fileBucket().get(key);
      if (!file) throw new ApiError('not_found', 'no such file');
      return reply
        .header('content-type', file.httpMetadata?.contentType ?? 'application/octet-stream')
        /* Links are aligned to the hour, so the same URL comes back all hour. */
        .header('cache-control', 'private, max-age=3600')
        .header('x-content-type-options', 'nosniff')
        .send(Buffer.from(await file.arrayBuffer()));
    },
  );
}
