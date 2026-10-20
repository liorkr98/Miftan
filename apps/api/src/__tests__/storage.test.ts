import { describe, expect, it } from 'vitest';
import { ApiError } from '@miftan/shared';
import { S3Driver } from '../storage/s3.ts';
import { MAX_UPLOAD_BYTES } from '../storage/contract.ts';

/**
 * The driver signs a URL; it does not upload anything. So this tests the
 * signature's shape and the rules that actually protect us — the content type
 * and the size are bound into the signature, and the client never chooses the
 * key or its extension.
 */

const driver = new S3Driver({
  host: 'acct.r2.cloudflarestorage.com',
  pathPrefix: '',
  bucket: 'miftan-uploads',
  region: 'auto',
  accessKeyId: 'AKIAEXAMPLE',
  secretAccessKey: 'secret-example-value',
});

/* Supabase serves S3 under a path, which is the only structural difference
   between the two providers — so it gets the same assertions. */
const supabase = new S3Driver({
  host: 'proj.supabase.co',
  pathPrefix: '/storage/v1/s3',
  bucket: 'miftan-uploads',
  region: 'eu-central-1',
  accessKeyId: 'AKIAEXAMPLE',
  secretAccessKey: 'secret-example-value',
});

describe('the upload target', () => {
  it('signs a time-limited PUT to the right bucket', async () => {
    const target = await driver.createUpload({
      folder: 'tickets',
      filename: 'leak.JPG',
      contentType: 'image/jpeg',
      size: 1_000_000,
    });

    const url = new URL(target.uploadUrl);
    expect(url.host).toBe('acct.r2.cloudflarestorage.com');
    expect(url.pathname).toMatch(/^\/miftan-uploads\/tickets\/[0-9a-f-]{36}\.jpg$/);
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy();
    /* A target issued for a 1 MB photo cannot be used for anything else, or
       anything bigger. */
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('content-type');
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('content-length');
  });

  it('refuses a file over the size cap before signing anything', async () => {
    await expect(
      driver.createUpload({ folder: 'tickets', filename: 'a.jpg', contentType: 'image/jpeg', size: MAX_UPLOAD_BYTES + 1 }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('takes the extension from the checked type, not the filename', async () => {
    const target = await driver.createUpload({
      folder: 'tickets',
      filename: 'page.html',
      contentType: 'image/png',
      size: 10,
    });
    expect(target.key).toMatch(/\.png$/);
  });

  it('ignores the name the client sent', async () => {
    const target = await driver.createUpload({
      folder: 'tickets',
      filename: '../../etc/passwd',
      contentType: 'image/png',
      size: 10,
    });
    expect(target.key).not.toContain('..');
    expect(target.key).not.toContain('passwd');
  });

  it('refuses a type we do not accept', async () => {
    await expect(
      driver.createUpload({ folder: 'tickets', filename: 'x.sh', contentType: 'application/x-sh', size: 10 }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe('the same driver against Supabase', () => {
  it('signs under the S3 path prefix, not the bucket root', async () => {
    const target = await supabase.createUpload({
      folder: 'tickets',
      filename: 'leak.jpg',
      contentType: 'image/jpeg',
      size: 1_000,
    });

    const url = new URL(target.uploadUrl);
    expect(url.host).toBe('proj.supabase.co');
    /* The prefix is the difference: dropping it would sign a path the store
       does not serve, and every upload would 404 after a valid signature. */
    expect(url.pathname).toBe(`/storage/v1/s3/miftan-uploads/${target.key}`);
    expect(url.searchParams.get('X-Amz-Credential')).toContain('/eu-central-1/s3/');
  });
});
