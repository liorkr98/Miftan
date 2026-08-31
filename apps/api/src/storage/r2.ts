import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { AwsClient } from 'aws4fetch';
import { env } from '../lib/env.ts';
import { assertUploadable, type StorageDriver, type UploadTarget } from './contract.ts';

/**
 * Cloudflare R2, over its S3-compatible API.
 *
 * The bytes never touch this process. The client asks for a target, gets a
 * signed URL good for fifteen minutes, and PUTs straight to R2 — which is why
 * a tenant on a bad phone connection uploading a 12MB photo of a leak does not
 * hold a Node worker open for ninety seconds.
 *
 * Reads go through a separate public origin rather than a signed URL. Photos
 * and receipts are attached to tickets that already sit behind authorization,
 * and the object keys are UUIDs, so the practical exposure is "someone who was
 * given the URL can open it" — the same property a signed URL has, without a
 * round trip on every render. If that trade stops being acceptable (contract
 * scans, ID documents), this is the method to change, not the callers.
 */
export class R2Driver implements StorageDriver {
  #client: AwsClient;
  #endpoint: string;
  #bucket: string;
  #publicUrl: string;

  constructor(config: {
    accountId: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    publicUrl: string;
  }) {
    this.#client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      /* R2 ignores the region but the S3 signing algorithm requires one. */
      service: 's3',
      region: 'auto',
    });
    this.#endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
    this.#bucket = config.bucket;
    this.#publicUrl = config.publicUrl.replace(/\/$/, '');
  }

  async createUpload(input: {
    folder: string;
    filename: string;
    contentType: string;
  }): Promise<UploadTarget> {
    assertUploadable(input.contentType);

    /* A UUID, not the original filename. Uploaded names collide, carry the
       uploader's own words, and occasionally carry a path separator. */
    const key = `${input.folder}/${randomUUID()}${extname(input.filename).toLowerCase() || ''}`;
    const expiresIn = 900;

    const url = new URL(`${this.#endpoint}/${this.#bucket}/${key}`);
    url.searchParams.set('X-Amz-Expires', String(expiresIn));

    const signed = await this.#client.sign(
      new Request(url, { method: 'PUT' }),
      /* Signing the content type into the URL means the client cannot present
         a photo target and then upload an executable. */
      { aws: { signQuery: true, allHeaders: true }, headers: { 'content-type': input.contentType } },
    );

    return {
      uploadUrl: signed.url,
      publicUrl: `${this.#publicUrl}/${key}`,
      key,
      expiresIn,
    };
  }
}

/** Present only when every piece of the configuration is there. */
export function r2FromEnv(): R2Driver | null {
  const { R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL } = env;
  if (!R2_ACCOUNT_ID || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_PUBLIC_URL) {
    return null;
  }
  return new R2Driver({
    accountId: R2_ACCOUNT_ID,
    bucket: R2_BUCKET,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    publicUrl: R2_PUBLIC_URL,
  });
}
