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
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
  throw new Error(`Invalid environment:\n${issues.join('\n')}`);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
