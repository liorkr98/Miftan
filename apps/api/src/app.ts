import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import {
  serializerCompiler,
  validatorCompiler,
  hasZodFastifySchemaValidationErrors,
} from 'fastify-type-provider-zod';
import { ApiError } from '@miftach/shared';
import { env, isProd } from './lib/env.ts';
import { authenticatePlugin } from './plugins/authenticate.ts';
import { authRoutes } from './routes/auth.ts';
import { meRoutes } from './routes/me.ts';
import { propertyRoutes } from './routes/properties.ts';

/**
 * Built as a factory so tests can spin up an app without binding a port.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    /* Silent under test — a request log line per assertion buries the results.
       Structured JSON in production, human-readable in development. */
    logger:
      env.NODE_ENV === 'test'
        ? false
        : isProd
          ? true
          : { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } },
    /* Behind a proxy in production, so request.ip is the real client. */
    trustProxy: isProd,
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, {
    /* Credentials mode means the origin cannot be '*'. */
    origin: env.WEB_ORIGIN,
    credentials: true,
  });
  await app.register(cookie, { secret: env.JWT_SECRET });
  await app.register(authenticatePlugin);

  /**
   * One error shape for the whole API. Everything the client sees is
   * `{ error: { code, message } }` with a machine-readable code, so the UI can
   * translate it and never has to parse an English sentence.
   */
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      if (error.status >= 500) request.log.error({ err: error }, 'api error');
      return reply.code(error.status).send(error.toBody());
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      const details: Record<string, string[]> = {};
      for (const issue of error.validation) {
        const key = issue.instancePath?.replace(/^\//, '') || 'body';
        (details[key] ??= []).push(issue.message ?? 'invalid');
      }
      return reply.code(422).send(new ApiError('validation_failed', 'request failed validation', details).toBody());
    }

    request.log.error({ err: error }, 'unhandled error');
    /* Never leak an internal message to a client. */
    return reply.code(500).send(new ApiError('internal', 'something went wrong').toBody());
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send(new ApiError('not_found', 'no such route').toBody()),
  );

  app.get('/health', async () => ({ ok: true, env: env.NODE_ENV }));

  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(propertyRoutes);

  return app;
}
