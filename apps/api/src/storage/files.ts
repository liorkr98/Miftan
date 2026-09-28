import { ApiError } from '@miftan/shared';
import { env } from '../lib/env.ts';
import { presignGet } from './presign.ts';

/**
 * Stored file references, and the links handed to a browser. HUMAN REVIEW:
 * this is what makes a photo of someone's home readable, and for how long.
 *
 * The database stores an object key ("tickets/<uuid>.jpg"), never a link.
 * Every response that shows a file signs a fresh read link, and only
 * projections that already passed the scope check do so — so a file is
 * readable by exactly the people who can see the ticket, receipt or protocol
 * it belongs to, and a link that leaks stops working within two hours.
 *
 * The R2 bucket itself should have public access turned OFF.
 */

const KEY = /^(tickets|receipts|protocol|properties)\/[0-9a-f-]{36}(\.[a-z0-9]{1,5})?$/;

/** How long a read link lasts, and the step it is aligned to. */
const LINK_SECONDS = 2 * 60 * 60;
const ALIGN_SECONDS = 60 * 60;

export function isFileKey(value: string): boolean {
  return KEY.test(value);
}

function r2Config() {
  const { R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = env;
  if (!R2_ACCOUNT_ID || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) return null;
  return {
    host: `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    bucket: R2_BUCKET,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  };
}

/**
 * Whatever a client sent back — a bare key, the preview link it was given
 * after uploading, or a link from the old public bucket — reduced to a key.
 * Anything else is refused: a listing must not carry a stranger's tracking
 * pixel, and a ticket must not point at someone else's upload by URL.
 */
export function toStoredKey(value: string): string {
  if (isFileKey(value)) return value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError('validation_failed', 'not a file this service stored');
  }
  const path = decodeURIComponent(url.pathname);
  const candidates: string[] = [];

  const r2 = r2Config();
  if (r2 && url.host === r2.host && path.startsWith(`/${r2.bucket}/`)) {
    candidates.push(path.slice(r2.bucket.length + 2));
  }
  if (env.R2_PUBLIC_URL && value.startsWith(env.R2_PUBLIC_URL.replace(/\/$/, '') + '/')) {
    candidates.push(path.replace(/^\//, ''));
  }
  /* The local development driver serves files from this API. */
  if (!r2 && path.startsWith('/files/')) candidates.push(path.slice('/files/'.length));

  const key = candidates.find(isFileKey);
  if (!key) throw new ApiError('validation_failed', 'not a file this service stored');
  return key;
}

export function toStoredKeys(values: readonly string[]): string[] {
  return values.map(toStoredKey);
}

/**
 * A link a browser can open, for a stored reference.
 *
 * Aligned to the hour so the same file gets the same link for an hour at a
 * time, which lets the browser cache it instead of downloading every photo on
 * every render. Anything that is not one of our keys (seed data pointing at a
 * placeholder image) passes through unchanged.
 */
export function fileLink(stored: string, now: Date = new Date()): string {
  let key = stored;
  if (!isFileKey(stored)) {
    const legacy = env.R2_PUBLIC_URL?.replace(/\/$/, '');
    if (legacy && stored.startsWith(`${legacy}/`)) key = stored.slice(legacy.length + 1);
    else return stored;
    if (!isFileKey(key)) return stored;
  }

  const r2 = r2Config();
  if (!r2) return `http://127.0.0.1:${env.PORT}/files/${key}`;

  const aligned = new Date(Math.floor(now.getTime() / (ALIGN_SECONDS * 1000)) * ALIGN_SECONDS * 1000);
  return presignGet({
    host: r2.host,
    path: `/${r2.bucket}/${key}`,
    region: 'auto',
    service: 's3',
    accessKeyId: r2.accessKeyId,
    secretAccessKey: r2.secretAccessKey,
    now: aligned,
    /* Issued up to an hour ago by alignment, so it runs two hours from the
       aligned start to leave at least one usable hour. */
    expiresIn: LINK_SECONDS,
  });
}

export function fileLinks(stored: readonly string[]): string[] {
  return stored.map((s) => fileLink(s));
}

export function fileLinkOrNull(stored: string | null | undefined): string | null {
  return stored ? fileLink(stored) : null;
}
