import { afterEach, describe, expect, it, vi } from 'vitest';
import { MiftanClient } from '../api/client';
import { ApiError } from '../api/errors';

/**
 * The one job this client has that is easy to get quietly wrong: telling "the
 * API sent an error" apart from "something that is not the API answered at
 * all". They must never share a code, because the second one is a deploy
 * problem a user cannot fix by trying again, and the first one might be.
 *
 * The case that actually shipped: a static host with no backend behind it
 * returns a plain 404 for an unmatched POST route. That is not JSON, and it is
 * not 2xx, so it fell through every check into the generic `internal` code —
 * indistinguishable from a genuine server fault. Every test here is a shape
 * of "not talking to the API" that must resolve to `api_unreachable` instead.
 */

const ok = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });

function client() {
  return new MiftanClient({ baseUrl: 'https://app.test/api' });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a non-JSON error response', () => {
  it('is reported as api_unreachable, not internal — the exact bug that shipped', async () => {
    /* A static host's own 404 for a route no server handles. This is the case
       that produced "משהו השתבש אצלנו" for a user hitting a Cloudflare deploy
       with no API behind it. */
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<!doctype html>not found', { status: 404, headers: { 'content-type': 'text/html' } })),
    );

    await expect(client().request('/auth/register')).rejects.toMatchObject({
      code: 'api_unreachable',
    });
  });

  it('reports the same code for a non-JSON 500, not just a 404', async () => {
    /* A proxy's own error page, or an upstream that died before the API's
       error handler ran. Still not our API talking. */
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>Bad Gateway</html>', { status: 502, headers: { 'content-type': 'text/html' } })),
    );

    await expect(client().request('/auth/register')).rejects.toMatchObject({
      code: 'api_unreachable',
    });
  });

  it('reports api_unreachable for a 401 with no JSON body', async () => {
    /* A 401 is the one status this client treats specially when the body IS
       JSON-less-but-parseable — but a 401 that is not even JSON (a Cloudflare
       Access wall, say) is still "not the API", not "not authenticated". */
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('unauthorized', { status: 401, headers: { 'content-type': 'text/plain' } })),
    );

    await expect(client().request('/me', {}, false)).rejects.toMatchObject({
      code: 'api_unreachable',
    });
  });

  it('still reports api_unreachable on a 200 with an HTML body — the SPA-fallback case', async () => {
    /* A static host with SPA fallback answers /api/anything with index.html
       and a 200. Covered before this fix; kept here so the two code paths
       (ok and !ok) cannot regress independently of each other. */
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<!doctype html><html>app shell</html>', { status: 200, headers: { 'content-type': 'text/html' } })),
    );

    await expect(client().request('/me')).rejects.toMatchObject({
      code: 'api_unreachable',
    });
  });
});

describe('a genuine API error', () => {
  it('still reports the server’s own code when the body is real JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: 'invalid_credentials', message: 'bad password' } }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    );

    await expect(client().request('/auth/login', {}, false)).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
  });

  it('falls back to internal only for a JSON content-type body that fails to parse', async () => {
    /* The one case left for the generic fallback: our own API claiming JSON
       and then not sending any — genuinely unexpected, not a deploy mismatch. */
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not actually json', { status: 500, headers: { 'content-type': 'application/json' } })),
    );

    await expect(client().request('/me')).rejects.toMatchObject({ code: 'internal' });
  });

  it('parses a normal successful response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok({ id: 'usr_1', name: 'דנה', email: 'd@x.test' })));
    const me = await client().request<{ id: string }>('/me');
    expect(me.id).toBe('usr_1');
  });
});

describe('ApiError shape', () => {
  it('is an instance of ApiError, not a generic Error, for every mapped case', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('gone', { status: 404, headers: { 'content-type': 'text/plain' } })));
    try {
      await client().request('/anything');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
    }
  });
});
