import { describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, rawDatabase, schema as s } from '../db/client.ts';

/* The deployed API is this handler, called by the web Worker with the D1
   binding. It is the path a real sign-in takes, so it is exercised here the
   way the browser does: register, sign in, then refresh with the cookie. */

const { handleApi } = await import('../worker.ts');
const bindings = () => ({ DB: rawDatabase() });

const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  handleApi(
    new Request(`https://miftan.example/api${path}`, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    }),
    bindings(),
    path,
  );

const ACCOUNT = { name: 'דנה לוי', email: 'dana@example.co.il', password: 'a-long-enough-password', acceptedTerms: true };

describe('the API inside the Worker', () => {
  it('registers, signs in and refreshes over fetch Requests and Responses', async () => {
    expect((await call('POST', '/auth/register', ACCOUNT)).status).toBe(201);

    const login = await call('POST', '/auth/login', { email: ACCOUNT.email, password: ACCOUNT.password });
    expect(login.status).toBe(200);
    const { accessToken } = (await login.json()) as { accessToken: string };
    expect(accessToken).toBeTruthy();
    const cookie = login.headers.get('set-cookie');
    expect(cookie).toMatch(/^bb_rt=/);

    const me = await call('GET', '/me', undefined, { authorization: `Bearer ${accessToken}` });
    expect(me.status).toBe(200);

    const refreshed = await call('POST', '/auth/refresh', undefined, { cookie: cookie!.split(';')[0] });
    expect(refreshed.status).toBe(200);
  });

  it('answers /ready once the database is reachable', async () => {
    const res = await call('GET', '/ready');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('ignores a client-supplied forwarding address', async () => {
    const res = await call('GET', '/health', undefined, { 'x-forwarded-for': '10.0.0.1', 'x-bb-client-ip': '10.0.0.2' });
    expect(res.status).toBe(200);
  });
});

describe('the server secret, with no JWT_SECRET configured', () => {
  it('is generated once, kept in the database, and reused', async () => {
    vi.resetModules();
    vi.stubEnv('JWT_SECRET', '');
    try {
      const auth = await import('../lib/auth.ts');
      const token = await auth.signAccessToken('usr_x');
      const [row] = await db.select().from(s.appMeta).where(eq(s.appMeta.key, 'jwt_secret'));
      expect(row.value.length).toBeGreaterThanOrEqual(48);
      expect(await auth.verifyAccessToken(token)).toBe('usr_x');

      /* A fresh isolate reads the same key instead of minting another. */
      vi.resetModules();
      const again = await import('../lib/auth.ts');
      expect(await again.verifyAccessToken(token)).toBe('usr_x');
      expect(await db.select().from(s.appMeta).where(eq(s.appMeta.key, 'jwt_secret'))).toHaveLength(1);
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});

describe('what the Workers runtime refuses', () => {
  it('the router has no code generated from strings (patches/find-my-way)', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { createRequire } = await import('node:module');
    const lib = join(dirname(createRequire(import.meta.url).resolve('find-my-way')), 'lib');
    for (const file of readdirSync(lib).filter((f) => f.endsWith('.js'))) {
      expect(readFileSync(join(lib, file), 'utf8'), file).not.toMatch(/new Function\(/);
    }
  });
});
