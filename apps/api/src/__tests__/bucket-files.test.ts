import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { hashPassword } from '../lib/auth.ts';

/* Without S3 keys, files go to the R2 bucket bound to the Worker, through
   this API, under signed links. The signature is the whole access check, so
   these tests are about what a link can and cannot be used for. */

let app: FastifyInstance;
/* Per test: the database is emptied before each one. */
let token: string;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const BYTES = Buffer.from('a tiny but genuine jpeg body');

async function signIn() {
  const id = newId('user');
  await db.insert(s.users).values({ id, email: `${id}@example.co.il`, name: 'דנה', passwordHash: await hashPassword('a-long-enough-password'), emailVerifiedAt: new Date() });
  const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: `${id}@example.co.il`, password: 'a-long-enough-password' } });
  token = res.json().accessToken;
}

async function sign(size = BYTES.length) {
  await signIn();
  const res = await app.inject({
    method: 'POST',
    url: '/uploads/sign',
    headers: { authorization: `Bearer ${token}` },
    payload: { folder: 'tickets', filename: 'leak.jpg', contentType: 'image/jpeg', size },
  });
  expect(res.statusCode).toBe(200);
  return res.json() as { uploadUrl: string; publicUrl: string; key: string };
}

/* The links are same-origin, under /api; the app under test is mounted at /. */
const local = (url: string) => url.replace(/^\/api/, '');

const put = (url: string, body = BYTES, contentType = 'image/jpeg') =>
  app.inject({ method: 'PUT', url: local(url), headers: { 'content-type': contentType }, payload: body });

describe('the bound bucket', () => {
  it('stores an upload and serves it back on the read link', async () => {
    const target = await sign();
    expect(target.uploadUrl).toMatch(/^\/api\/uploads\/tickets\/[0-9a-f-]{36}\.jpg\?/);
    expect((await put(target.uploadUrl)).statusCode).toBe(204);

    const read = await app.inject({ method: 'GET', url: local(target.publicUrl) });
    expect(read.statusCode).toBe(200);
    expect(read.headers['content-type']).toBe('image/jpeg');
    expect(read.rawPayload.equals(BYTES)).toBe(true);
  });

  it('refuses an upload link that was tampered with', async () => {
    const target = await sign();
    const forged = target.uploadUrl.replace(/tickets\/[0-9a-f-]{36}/, 'tickets/00000000-0000-4000-8000-000000000000');
    expect((await put(forged)).statusCode).toBe(403);
  });

  it('refuses a body of another size or type than the link was signed for', async () => {
    const target = await sign();
    expect((await put(target.uploadUrl, Buffer.concat([BYTES, BYTES]))).statusCode).toBe(422);
    expect((await put(target.uploadUrl, BYTES, 'image/png')).statusCode).toBe(422);
  });

  it('does not serve a file without a valid read signature', async () => {
    const target = await sign();
    await put(target.uploadUrl);
    const bare = local(target.publicUrl).split('?')[0];
    expect((await app.inject({ method: 'GET', url: bare })).statusCode).toBe(404);
    const wrong = local(target.publicUrl).replace(/sig=[^&]+/, 'sig=AAAA');
    expect((await app.inject({ method: 'GET', url: wrong })).statusCode).toBe(404);
  });

  it('an upload link cannot be used to read, nor a read link to upload', async () => {
    const target = await sign();
    await put(target.uploadUrl);
    const asRead = local(target.uploadUrl).replace('/uploads/', '/files/');
    expect((await app.inject({ method: 'GET', url: asRead })).statusCode).toBe(404);
    expect((await put(target.publicUrl.replace('/files/', '/uploads/'))).statusCode).toBe(403);
  });
});
