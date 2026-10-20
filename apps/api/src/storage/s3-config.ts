import { env } from '../lib/env.ts';

/**
 * Where object storage lives, read once from the environment.
 *
 * Both halves of storage need this — the driver that hands out upload targets
 * and the signer that hands out read links — and they have to agree exactly,
 * because a link signed against one host and presented to another is simply
 * invalid.
 *
 * The endpoint is a whole URL rather than an account id, which is what lets
 * one shape serve more than one provider:
 *
 *   Cloudflare R2   https://<account>.r2.cloudflarestorage.com
 *   Supabase        https://<ref>.supabase.co/storage/v1/s3
 *
 * R2 puts the bucket at the root; Supabase serves S3 under a path. Keeping the
 * prefix separate from the host is the whole difference between them, since
 * SigV4 signs the host and the path independently.
 */
export interface S3Config {
  host: string;
  /** '' for R2, '/storage/v1/s3' for Supabase. Never a trailing slash. */
  pathPrefix: string;
  bucket: string;
  /** R2 ignores it but SigV4 requires one; Supabase wants the project region. */
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** Null unless every piece is present — a partial configuration never half-works. */
export function s3ConfigFromEnv(): S3Config | null {
  const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION } = env;
  if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) return null;

  const url = new URL(S3_ENDPOINT);
  return {
    host: url.host,
    pathPrefix: url.pathname.replace(/\/+$/, '').replace(/^\/?$/, ''),
    bucket: S3_BUCKET,
    region: S3_REGION,
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
  };
}

/** The path SigV4 signs for one object: prefix, bucket, key. */
export function objectPath(config: S3Config, key: string): string {
  return `${config.pathPrefix}/${config.bucket}/${key}`;
}
