import { z } from 'zod';

/**
 * Validated once, at boot. A missing secret should stop the process with a
 * clear message, not surface as a confusing 500 an hour later.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1),
  /** 32+ bytes. Rotating it signs everyone out, which is the point. */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  /** Where the web app runs, for CORS and cookie scope */
  WEB_ORIGIN: z.string().default('http://localhost:5178'),
  /**
   * Path the refresh cookie is scoped to.
   *
   * Scoping it means the refresh token is not attached to every ordinary API
   * call, only to the endpoints that need it. But the path the *browser* sees
   * depends on how the API is mounted: on its own hostname that is /auth, and
   * behind a /api proxy it is /api/auth. Getting it wrong is silent — the
   * cookie is simply never sent, and every reload looks like a signed-out
   * session.
   */
  COOKIE_PATH: z.string().default('/auth'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
  throw new Error(`Invalid environment:\n${issues.join('\n')}`);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
