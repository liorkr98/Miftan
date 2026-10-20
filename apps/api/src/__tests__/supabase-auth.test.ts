import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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

  server = createServer((_req, res) => {
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
    await expect(verifySupabaseToken(await supabaseToken(sub, privateKey))).resolves.toBe(sub);
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
