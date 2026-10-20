import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { ApiError } from '@miftan/shared';
import { EXTENSION, assertSize, assertUploadable, type StorageDriver, type UploadRequest } from './contract.ts';
import { env } from '../lib/env.ts';
import { r2FromEnv } from './r2.ts';

/* Re-exported so callers keep importing storage from one place. */
export * from './contract.ts';

/**
 * File storage, behind an interface.
 *
 * Photos of a leak and receipts are the two things this product cannot lose,
 * and in production they belong in object storage — never passing through the
 * API process at all. That means a *presigned* upload: the client asks for a
 * target, uploads straight to it, and tells us the resulting URL.
 *
 * The local driver imitates that shape rather than short-cutting it. Swapping
 * to Cloudflare R2 later is a new driver in this folder and nothing else,
 * because callers only ever see `createUpload`.
 */

/**
 * Development driver: writes under apps/api/uploads and serves the files back
 * over the same origin. Never used in production — the guard in `createStorage`
 * makes that a startup failure rather than a surprise.
 */
class LocalDiskDriver implements StorageDriver {
  #root = resolve(process.cwd(), 'uploads');

  async createUpload(input: UploadRequest) {
    assertUploadable(input.contentType);
    assertSize(input.size);
    const key = `${input.folder}/${randomUUID()}${EXTENSION[input.contentType] ?? ''}`;
    await mkdir(join(this.#root, input.folder), { recursive: true });
    const base = `http://127.0.0.1:${env.PORT}`;
    return {
      uploadUrl: `${base}/uploads/${key}`,
      publicUrl: `${base}/files/${key}`,
      key,
      expiresIn: 900,
    };
  }

  async write(key: string, body: Buffer): Promise<void> {
    const target = resolve(this.#root, key);
    /* Refuse anything that escapes the uploads directory. */
    if (!target.startsWith(this.#root + sep)) throw new ApiError('validation_failed', 'bad key');
    await mkdir(resolve(target, '..'), { recursive: true });
    await writeFile(target, body);
  }

  get root() {
    return this.#root;
  }
}

export const localDriver = new LocalDiskDriver();

export function createStorage(): StorageDriver {
  /* R2 when it is fully configured, local disk otherwise. Partial R2 config
     falls through to the production guard below rather than half-working. */
  const r2 = r2FromEnv();
  if (r2) return r2;

  if (env.NODE_ENV === 'production') {
    /* Deliberately fatal. Silently writing a tenant's leak photos to a
       container filesystem that is thrown away on the next deploy is worse
       than refusing to boot. */
    throw new Error(
      'No production storage driver configured. Set R2_ACCOUNT_ID, R2_BUCKET, ' +
        'R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.',
    );
  }
  return localDriver;
}
