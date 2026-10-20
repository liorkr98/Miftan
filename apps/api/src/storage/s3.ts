import { randomUUID } from 'node:crypto';
import { AwsClient } from 'aws4fetch';
import { EXTENSION, assertSize, assertUploadable, type StorageDriver, type UploadRequest, type UploadTarget } from './contract.ts';
import { objectPath, s3ConfigFromEnv, type S3Config } from './s3-config.ts';
import { fileLink } from './files.ts';

/**
 * Object storage over the S3 API — Cloudflare R2 or Supabase, whichever
 * S3_ENDPOINT names.
 *
 * The bytes never touch this process. The client asks for a target, gets a
 * signed URL good for fifteen minutes, and PUTs straight to R2 — which is why
 * a tenant on a bad phone connection uploading a 12MB photo of a leak does not
 * hold a Node worker open for ninety seconds.
 *
 * Reads are signed too, by fileLink() in files.ts, and only for a viewer
 * who passed the scope check. The bucket is private.
 */
export class S3Driver implements StorageDriver {
  #client: AwsClient;
  #config: S3Config;

  constructor(config: S3Config) {
    this.#client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      service: 's3',
      region: config.region,
    });
    this.#config = config;
  }

  async createUpload(input: UploadRequest): Promise<UploadTarget> {
    assertUploadable(input.contentType);
    assertSize(input.size);

    /* A UUID, not the original filename. Uploaded names collide, carry the
       uploader's own words, and occasionally carry a path separator. */
    const key = `${input.folder}/${randomUUID()}${EXTENSION[input.contentType] ?? ''}`;
    const expiresIn = 900;

    const url = new URL(`https://${this.#config.host}${objectPath(this.#config, key)}`);
    url.searchParams.set('X-Amz-Expires', String(expiresIn));

    const signed = await this.#client.sign(
      new Request(url, { method: 'PUT' }),
      /* Signing the content type into the URL means the client cannot present
         a photo target and then upload an executable. */
      {
        aws: { signQuery: true, allHeaders: true },
        /* The length is signed as well: the store refuses a body of any other
           size, which is what makes the size cap hold in production. */
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
export function s3FromEnv(): S3Driver | null {
  const config = s3ConfigFromEnv();
  return config ? new S3Driver(config) : null;
}
