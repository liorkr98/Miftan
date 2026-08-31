import { describe, expect, it } from 'vitest';
import { ApiError } from '@miftan/shared';
import { R2Driver } from '../storage/r2.ts';

/**
 * The R2 driver signs a URL; it does not upload anything. So this tests the
 * signature's shape and the two rules that actually protect us — the content
 * type is bound into the signature, and the client never chooses the key.
 */

const driver = new R2Driver({
  accountId: 'acct',
  bucket: 'miftan-uploads',
  accessKeyId: 'AKIAEXAMPLE',
  secretAccessKey: 'secret-example-value',
  publicUrl: 'https://files.miftan.co.il/',
});

describe('the R2 upload target', () => {
  it('signs a time-limited PUT to the right bucket', async () => {
    const target = await driver.createUpload({
      folder: 'tickets',
      filename: 'leak.JPG',
      contentType: 'image/jpeg',
    });

    const url = new URL(target.uploadUrl);
    expect(url.host).toBe('acct.r2.cloudflarestorage.com');
    expect(url.pathname).toMatch(/^\/miftan-uploads\/tickets\/[0-9a-f-]{36}\.jpg$/);
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy();
    /* Binding content-type means a target issued for a photo cannot be used to
       upload something else. */
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('content-type');
  });

  it('reads back from the public origin, not the signing endpoint', async () => {
    const target = await driver.createUpload({
      folder: 'receipts',
      filename: 'r.pdf',
      contentType: 'application/pdf',
    });
    /* A trailing slash in configuration must not produce a double slash. */
    expect(target.publicUrl).toBe(`https://files.miftan.co.il/${target.key}`);
    expect(target.publicUrl).not.toContain('r2.cloudflarestorage.com');
  });

  it('ignores the name the client sent', async () => {
    const target = await driver.createUpload({
      folder: 'tickets',
      filename: '../../etc/passwd',
      contentType: 'image/png',
    });
    expect(target.key).not.toContain('..');
    expect(target.key).not.toContain('passwd');
  });

  it('refuses a type we do not accept', async () => {
    await expect(
      driver.createUpload({ folder: 'tickets', filename: 'x.sh', contentType: 'application/x-sh' }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
