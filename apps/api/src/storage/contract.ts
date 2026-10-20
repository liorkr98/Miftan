import { ApiError } from '@miftan/shared';

/**
 * What every storage driver agrees to, kept in its own module so that drivers
 * and the factory that chooses between them do not import each other.
 */

export interface UploadTarget {
  /** Where the client PUTs the bytes */
  uploadUrl: string;
  /** A short-lived link to show the file right after uploading. The client
      may send it back; the API stores only the key it contains. */
  publicUrl: string;
  key: string;
  /** Seconds the upload URL stays valid */
  expiresIn: number;
}

export interface UploadRequest {
  folder: string;
  filename: string;
  contentType: string;
  /** Bytes. Signed into the upload, so a bigger file is refused by R2. */
  size: number;
}

export interface StorageDriver {
  createUpload(input: UploadRequest): Promise<UploadTarget>;
}

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']);
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/** The extension comes from the checked type, never from the client's name. */
export const EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'application/pdf': '.pdf',
};

export function assertSize(size: number): void {
  if (!Number.isInteger(size) || size <= 0 || size > MAX_UPLOAD_BYTES) {
    throw new ApiError('validation_failed', 'file too large', {
      size: [`must be between 1 and ${MAX_UPLOAD_BYTES} bytes`],
    });
  }
}

export function assertUploadable(contentType: string): void {
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new ApiError('validation_failed', `unsupported content type: ${contentType}`, {
      contentType: [`must be one of ${[...ALLOWED_TYPES].join(', ')}`],
    });
  }
}
