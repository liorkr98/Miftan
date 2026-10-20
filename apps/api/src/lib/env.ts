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
  /**
   * SameSite for the refresh cookie.
   *
   * `lax` is right when the web app and the API share a site — locally they do,
   * through the Vite proxy. They do not once deployed: the app is on
   * workers.dev and the API on run.app, separate registrable domains, so every
   * call between them is cross-site and a `lax` cookie is never sent back. That
   * fails exactly like a wrong COOKIE_PATH — login appears to work, then the
   * first refresh returns 401 and every reload looks signed out.
   *
   * `none` is the cross-site value, and browsers accept it only on a Secure
   * cookie, so it is set by the deploy workflow, where NODE_ENV=production also
   * makes `secure` true. Setting it in development would be rejected.
   */
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  /**
   * Set only on the demo API. Production leaves it unset, and seeded account
   * ids are then ordinary users — the demo badge and the revenue lens stay off.
   */
  DEMO_MODE: z.enum(['true', 'false']).optional(),
  /** Resend. Unset = console adapter (dev, tests, demo). Never commit the key. */
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('בעל הבית <noreply@baalabait.co.il>'),

  /* ── Object storage (Cloudflare R2, S3 API) ──────────────
     Optional in development, required in production — the check lives in
     storage/index.ts so the failure names the actual problem. These are R2
     *S3 access keys* from "Manage R2 API Tokens", not a Cloudflare API token;
     the two are different credentials and only the former can sign a URL. */
  R2_ACCOUNT_ID: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  /** Public read origin — a bucket custom domain, or the r2.dev subdomain */
  R2_PUBLIC_URL: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
  throw new Error(`Invalid environment:\n${issues.join('\n')}`);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
