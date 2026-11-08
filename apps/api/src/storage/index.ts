import { randomUUID } from 'node:crypto';
import { EXTENSION, assertSize, assertUploadable, type StorageDriver, type UploadRequest } from './contract.ts';
import { s3FromEnv } from './s3.ts';
import { fileLink, signFileUrl } from './files.ts';

/* Re-exported so callers keep importing storage from one place. */
export * from './contract.ts';

/**
 * File storage, behind an interface.
 *
 * Photos of a leak and receipts are the two things this product cannot lose.
 * Two drivers, one shape — the client asks for a target, PUTs the bytes to it,
 * and sends back the link it was given:
 *
 *  - S3: when S3 access keys are configured, the client uploads straight to
 *    R2 (or Supabase) over a presigned URL.
 *  - Bucket: otherwise, the R2 bucket bound to the Worker. The client PUTs to
 *    this API under a signed, short-lived URL, and reads come back the same
 *    way. No keys to create: the binding is the credential.
 */

/** The parts of an R2 binding this uses, so tests can stand in a map. */
export interface FileBucket {
  put(key: string, value: ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; httpMetadata?: { contentType?: string } } | null>;
}

/** Development and tests without a binding: kept in memory, gone on restart. */
class MemoryBucket implements FileBucket {
  #files = new Map<string, { body: Uint8Array; contentType?: string }>();
  async put(key: string, value: ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string } }) {
    this.#files.set(key, { body: new Uint8Array(value), contentType: options?.httpMetadata?.contentType });
  }
  async get(key: string) {
    const file = this.#files.get(key);
    if (!file) return null;
    return {
      arrayBuffer: async () => file.body.slice().buffer as ArrayBuffer,
      httpMetadata: { contentType: file.contentType },
    };
  }
}

let bound: FileBucket = new MemoryBucket();

export function bindBucket(bucket: FileBucket): void {
  bound = bucket;
}

export function fileBucket(): FileBucket {
  return bound;
}

/** Seconds an upload URL stays valid. */
export const UPLOAD_SECONDS = 900;

class BucketDriver implements StorageDriver {
  async createUpload(input: UploadRequest) {
    assertUploadable(input.contentType);
    assertSize(input.size);
    /* A UUID, not the original filename. Uploaded names collide, carry the
       uploader's own words, and occasionally carry a path separator. */
    const key = `${input.folder}/${randomUUID()}${EXTENSION[input.contentType] ?? ''}`;
    const expires = Math.floor(Date.now() / 1000) + UPLOAD_SECONDS;
    return {
      /* The type and size are signed in, so the URL cannot carry anything else. */
      uploadUrl: signFileUrl('uploads', key, expires, { ct: input.contentType, size: String(input.size) }),
      publicUrl: fileLink(key),
      key,
      expiresIn: UPLOAD_SECONDS,
    };
  }
}

export function createStorage(): StorageDriver {
  return s3FromEnv() ?? new BucketDriver();
}
