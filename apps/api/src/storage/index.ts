import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { ApiError } from '@miftan/shared';
import { env } from '../lib/env.ts';

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

export interface UploadTarget {
  /** Where the client PUTs the bytes */
  uploadUrl: string;
  /** Where the file will be readable afterwards — this is what gets stored */
  publicUrl: string;
  key: string;
  /** Seconds the upload URL stays valid */
  expiresIn: number;
}

export interface StorageDriver {
  createUpload(input: { folder: string; filename: string; contentType: string }): Promise<UploadTarget>;
}

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']);
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export function assertUploadable(contentType: string): void {
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new ApiError('validation_failed', `unsupported content type: ${contentType}`, {
      contentType: [`must be one of ${[...ALLOWED_TYPES].join(', ')}`],
    });
  }
}

/**
 * Development driver: writes under apps/api/uploads and serves the files back
 * over the same origin. Never used in production — the guard in `createStorage`
 * makes that a startup failure rather than a surprise.
 */
class LocalDiskDriver implements StorageDriver {
  #root = resolve(process.cwd(), 'uploads');

  async createUpload(input: { folder: string; filename: string; contentType: string }) {
    assertUploadable(input.contentType);
    const key = `${input.folder}/${randomUUID()}${extname(input.filename) || ''}`;
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
    if (!target.startsWith(this.#root)) throw new ApiError('validation_failed', 'bad key');
    await mkdir(resolve(target, '..'), { recursive: true });
    await writeFile(target, body);
  }

  get root() {
    return this.#root;
  }
}

export const localDriver = new LocalDiskDriver();

export function createStorage(): StorageDriver {
  if (env.NODE_ENV === 'production') {
    /* Deliberately fatal. Silently writing a tenant's leak photos to a
       container filesystem that is thrown away on the next deploy is worse
       than refusing to boot. */
    throw new Error('No production storage driver configured. Add the R2 driver before deploying.');
  }
  return localDriver;
}
