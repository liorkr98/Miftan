import { randomUUID } from 'node:crypto';
import { AwsClient } from 'aws4fetch';
import { env } from '../lib/env.ts';
import { EXTENSION, assertSize, assertUploadable, type StorageDriver, type UploadRequest, type UploadTarget } from './contract.ts';
import { fileLink } from './files.ts';

/**
 * Cloudflare R2, over its S3-compatible API.
 *
 * The bytes never touch this process. The client asks for a target, gets a
 * signed URL good for fifteen minutes, and PUTs straight to R2 — which is why
 * a tenant on a bad phone connection uploading a 12MB photo of a leak does not
 * hold a Node worker open for ninety seconds.
 *
 * Reads are signed too, by fileLink() in files.ts, and only for a viewer
 * who passed the scope check. The bucket is private.
 */
export class R2Driver implements StorageDriver {
  #client: AwsClient;
  #endpoint: string;
  #bucket: string;

  constructor(config: {
    accountId: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
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
  }

  async createUpload(input: UploadRequest): Promise<UploadTarget> {
    assertUploadable(input.contentType);
    assertSize(input.size);

    /* A UUID, not the original filename. Uploaded names collide, carry the
       uploader's own words, and occasionally carry a path separator. */
    const key = `${input.folder}/${randomUUID()}${EXTENSION[input.contentType] ?? ''}`;
    const expiresIn = 900;

    const url = new URL(`${this.#endpoint}/${this.#bucket}/${key}`);
    url.searchParams.set('X-Amz-Expires', String(expiresIn));

    const signed = await this.#client.sign(
      new Request(url, { method: 'PUT' }),
      /* Signing the content type into the URL means the client cannot present
         a photo target and then upload an executable. */
      {
        aws: { signQuery: true, allHeaders: true },
        /* The length is signed as well: R2 refuses a body of any other size,
           which is what makes the size cap hold in production. */
        headers: { 'content-type': input.contentType, 'content-length': String(input.size) },
      },
    );

    return {
      uploadUrl: signed.url,
      publicUrl: fileLink(key),
      key,
      expiresIn,
    };
  }
}

/** Present only when every piece of the configuration is there. */
export function r2FromEnv(): R2Driver | null {
  const { R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = env;
  if (!R2_ACCOUNT_ID || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    return null;
  }
  return new R2Driver({
    accountId: R2_ACCOUNT_ID,
    bucket: R2_BUCKET,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  });
}
