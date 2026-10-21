import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';

/**
 * Supabase Auth as the password-checker.
 *
 * Cloudflare's free plan allows 10ms of CPU per request and argon2 needs
 * 50-150ms by design, so a Worker cannot check a password itself. Supabase
 * checks it and signs a token; this API verifies the signature against
 * Supabase's published keys, which costs well under a millisecond. These tests
 * cover that verification, because it is the part standing between a stranger
 * and every account.
 *
 * `SUPABASE_JWKS_URL` is unset in vitest.config.ts, so the rest of the suite
 * exercises the API's own tokens exactly as before. This file stubs the
 * variable and re-imports the module to turn the Supabase path on.
 */

let server: Server;
let jwksUrl: string;
let privateKey: CryptoKey;
let otherPrivateKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair('ES256');
  privateKey = pair.privateKey;
  const publicJwk = await exportJWK(pair.publicKey);
  publicJwk.kid = 'test-key';
  publicJwk.alg = 'ES256';
  publicJwk.use = 'sig';

  /* A key Supabase never published, for the forgery case below. */
  otherPrivateKey = (await generateKeyPair('ES256')).privateKey;

  server = createServer((req, res) => {
    /* Stands in for Supabase's GET /auth/v1/user: the server's own record of
       whether the address is confirmed, which a user cannot edit. The test
       tokens carry that answer in a claim only this fake server reads. */
    if (req.url?.endsWith('/user')) {
      const bearer = String(req.headers.authorization ?? '').slice(7);
      const payload = JSON.parse(Buffer.from(bearer.split('.')[1] ?? '', 'base64url').toString() || '{}');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ email_confirmed_at: payload.test_confirmed ? '2026-01-01T00:00:00Z' : null }));
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ keys: [publicJwk] }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  jwksUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/jwks.json`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

/** Import the auth module with the Supabase variable set to our local JWKS. */
async function authWithSupabase() {
  vi.resetModules();
  vi.stubEnv('SUPABASE_JWKS_URL', jwksUrl);
  return import('../lib/auth.ts');
}

function supabaseToken(sub: string, key: CryptoKey, audience = 'authenticated') {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .setSubject(sub)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);
}

describe('supabase token verification', () => {
  it('accepts a token Supabase signed and returns its subject', async () => {
    const { verifySupabaseToken, supabaseAuthEnabled } = await authWithSupabase();
    expect(supabaseAuthEnabled()).toBe(true);

    const sub = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
    await expect(verifySupabaseToken(await supabaseToken(sub, privateKey))).resolves.toMatchObject({
      sub,
      emailVerified: false,
    });
  });

  it('rejects a token signed by a key Supabase never published', async () => {
    const { verifySupabaseToken } = await authWithSupabase();
    const forged = await supabaseToken('attacker', otherPrivateKey);
    await expect(verifySupabaseToken(forged)).rejects.toThrow(/invalid or expired supabase token/);
  });

  it('rejects a token meant for a different audience', async () => {
    const { verifySupabaseToken } = await authWithSupabase();
    const wrongAudience = await supabaseToken('someone', privateKey, 'anon');
    await expect(verifySupabaseToken(wrongAudience)).rejects.toThrow(
      /invalid or expired supabase token/,
    );
  });

  it('rejects an expired token', async () => {
    const { verifySupabaseToken } = await authWithSupabase();
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setSubject('someone')
      .setAudience('authenticated')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(privateKey);
    await expect(verifySupabaseToken(expired)).rejects.toThrow(
      /invalid or expired supabase token/,
    );
  });

  it('does not accept this API\'s own access token as a Supabase one', async () => {
    const { verifySupabaseToken, signAccessToken } = await authWithSupabase();
    const ours = await signAccessToken('usr_someone');
    await expect(verifySupabaseToken(ours)).rejects.toThrow(/invalid or expired supabase token/);
  });

  it('is off, and says so, when the JWKS address is unset', async () => {
    vi.resetModules();
    vi.stubEnv('SUPABASE_JWKS_URL', '');
    const { verifySupabaseToken, supabaseAuthEnabled } = await import('../lib/auth.ts');
    expect(supabaseAuthEnabled()).toBe(false);
    await expect(verifySupabaseToken('anything')).rejects.toThrow(/not configured/);
  });
});

/* ── Claiming a row ────────────────────────────────────────
   The verification above proves a token is genuine. These prove what a
   genuine token is allowed to *become* here, which is the part that decides
   whether one person can end up holding another's portfolio. */

describe('claiming a row for a supabase account', () => {
  let app: FastifyInstance;
  let db: typeof import('../db/client.ts')['db'];
  let s: typeof import('../db/client.ts')['schema'];
  let sql: typeof import('../db/client.ts')['sql'];
  let newId: typeof import('../lib/ids.ts')['newId'];

  beforeAll(async () => {
    vi.resetModules();
    vi.stubEnv('SUPABASE_JWKS_URL', jwksUrl);
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    ({ db, schema: s, sql } = await import('../db/client.ts'));
    ({ newId } = await import('../lib/ids.ts'));
    const { buildApp } = await import('../app.ts');
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    /* resetModules gave this file its own copy of db/client, and so its own
       connection pool. setup.ts closes the original module's pool, not this
       one, so without this the suite leaks a pool per run — which is the kind
       of thing that shows up later as one flaky file rather than a clear
       failure here. */
    await sql.end();
  });

  const BODY = { name: 'דנה לוי', acceptedTerms: true as const };

  const claim = (token: string, body: object = BODY) =>
    app.inject({
      method: 'POST',
      url: '/auth/supabase',
      payload: body,
      headers: { authorization: `Bearer ${token}` },
    });

  /* verified = what Supabase's server says (see the fake /user above). The
     user-editable metadata always claims verified, as an attacker's would. */
  function token(sub: string, email: string | null, verified: boolean) {
    const claims: Record<string, unknown> = {
      test_confirmed: verified,
      user_metadata: { email_verified: true },
    };
    if (email) claims.email = email;
    return new SignJWT(claims)
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setSubject(sub)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);
  }

  async function seedUser(email: string, supabaseUserId?: string) {
    const id = newId('user');
    await db.insert(s.users).values({ id, name: 'קיים', email, supabaseUserId: supabaseUserId ?? null });
    return id;
  }

  it('creates a row the first time, and returns the same one after that', async () => {
    const t = await token('sub-new', 'new@example.co.il', true);

    const first = await claim(t);
    expect(first.statusCode).toBe(200);
    const created = first.json().user;
    expect(created.email).toBe('new@example.co.il');
    expect(created.name).toBe('דנה לוי');

    const again = await claim(t);
    expect(again.statusCode).toBe(200);
    expect(again.json().user.id).toBe(created.id);
  });

  it('adopts an existing account when the address is confirmed', async () => {
    const id = await seedUser('owner@example.co.il');
    const res = await claim(await token('sub-owner', 'owner@example.co.il', true));

    expect(res.statusCode).toBe(200);
    /* The same row, not a second one — the portfolio comes with it. */
    expect(res.json().user.id).toBe(id);

    const [row] = await db.select().from(s.users).where(eq(s.users.id, id));
    expect(row.supabaseUserId).toBe('sub-owner');
  });

  it('refuses an existing account when the address is unconfirmed', async () => {
    const id = await seedUser('victim@example.co.il');
    const res = await claim(await token('sub-attacker', 'victim@example.co.il', false));

    expect(res.statusCode).toBe(403);

    const [row] = await db.select().from(s.users).where(eq(s.users.id, id));
    expect(row.supabaseUserId).toBeNull();
  });

  it('refuses an account another supabase login already holds', async () => {
    await seedUser('taken@example.co.il', 'sub-first');
    const res = await claim(await token('sub-second', 'taken@example.co.il', true));

    expect(res.statusCode).toBe(403);
  });

  it('refuses a token with no email', async () => {
    const res = await claim(await token('sub-emailless', null, true));
    expect(res.statusCode).toBe(422);
  });

  it('lets the claimed row authenticate with its supabase token afterwards', async () => {
    const t = await token('sub-roundtrip', 'round@example.co.il', true);
    const claimed = await claim(t);
    expect(claimed.statusCode).toBe(200);

    const me = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${t}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.id).toBe(claimed.json().user.id);
  });

  it('still refuses a forged token', async () => {
    const forged = await new SignJWT({ email: 'x@example.co.il' })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setSubject('sub-forged')
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(otherPrivateKey);

    expect((await claim(forged)).statusCode).toBe(401);
  });

  it('refuses an address that belongs to a closed account', async () => {
    const id = newId('user');
    await db.insert(s.users).values({
      id, name: 'נמחק', email: 'gone@example.co.il', deletedAt: new Date(),
    });
    const res = await claim(await token('sub-gone', 'gone@example.co.il', true));

    /* Neither adopted nor duplicated: users_email_key is unique on the address
       whether or not the row is deleted, so a second one cannot exist. */
    expect(res.statusCode).toBe(403);
    const [old] = await db
      .select()
      .from(s.users)
      .where(and(eq(s.users.id, id)));
    expect(old.supabaseUserId).toBeNull();
  });

  it('ignores email_verified in user metadata, which the user can write', async () => {
    const id = await seedUser('landlord@example.co.il');
    const res = await claim(await token('sub-forger', 'landlord@example.co.il', false));
    expect(res.statusCode).toBe(403);
    const [row] = await db.select().from(s.users).where(eq(s.users.id, id));
    expect(row!.supabaseUserId).toBeNull();
  });
});
