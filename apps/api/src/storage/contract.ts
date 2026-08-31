import { ApiError } from '@miftan/shared';

/**
 * What every storage driver agrees to, kept in its own module so that drivers
 * and the factory that chooses between them do not import each other.
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
