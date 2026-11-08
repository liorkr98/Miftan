import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.ts';
import { bindDatabase } from './db/client.ts';
import { migrate } from './db/migrate.ts';
import { seedIfEmpty, type DemoSeed } from './db/demo-seed.ts';
import { loadServerSecret } from './lib/auth.ts';
import { env } from './lib/env.ts';
import { bindBucket, type FileBucket } from './storage/index.ts';

/**
 * The API, inside the web app's Cloudflare Worker.
 *
 * The browser calls /api/* on the app's own origin; the Worker strips the
 * prefix and hands the request to Fastify in-process — no network hop, no
 * second service to keep alive, and the refresh cookie stays first-party.
 * The database is the D1 binding and files go to the R2 binding, so a deploy
 * needs no connection strings or keys.
 */
export interface ApiBindings {
  DB: D1Database;
  FILES?: FileBucket;
  /** The rendered demo portfolio, bundled by the web Worker. */
  DEMO_SEED?: DemoSeed;
}

/* Once per isolate: bring the schema up to date, load the signing key and
   build the app. Not at module load: the Workers runtime forbids timers and
   random values in global scope, and Fastify's boot uses both. A failure is
   not cached, so the next request tries again. */
type Dispatch = (request: Request) => Promise<Response>;

let prepared: Promise<Dispatch> | null = null;
function prepare(d1: D1Database, demoSeed?: DemoSeed): Promise<Dispatch> {
  prepared ??= (async () => {
    await migrate(d1);
    if (process.env.DEMO_DATABASE === 'true' && demoSeed && (await seedIfEmpty(d1, demoSeed))) {
      console.log('demo portfolio loaded into an empty database');
    }
    await loadServerSecret();
    /* The Worker's own forwarding secret, for this isolate only: it is how
       clientIp() knows the address header came from here (lib/http.ts). */
    env.PROXY_SECRET ??= randomBytes(32).toString('hex');
    const app = await buildApp();
    await app.ready();
    return inWorkers ? await viaNodeHttp(app) : viaInject(app);
  })().catch((err) => {
    prepared = null;
    throw err;
  });
  return prepared;
}

const inWorkers = typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';

/* In the Workers runtime: Fastify behind the runtime's own node:http server,
   which turns the fetch Request into the IncomingMessage Fastify expects. */
async function viaNodeHttp(app: FastifyInstance): Promise<Dispatch> {
  const [{ httpServerHandler }, http] = await Promise.all([import('cloudflare:node'), import('node:http')]);
  const server = http.createServer((req, res) => app.routing(req, res));
  const handler = httpServerHandler(server as never) as { fetch: (r: Request) => Promise<Response> };
  return (request) => handler.fetch(request);
}

/* Under Node (the tests): light-my-request, which needs Node's own http
   classes and so cannot run in the Workers runtime. */
function viaInject(app: FastifyInstance): Dispatch {
  return async (request) => {
    const headers: Record<string, string> = {};
    request.headers.forEach((value, name) => {
      headers[name] = value;
    });
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    const url = new URL(request.url);
    const res = await app.inject({
      method: request.method as 'GET',
      url: url.pathname + url.search,
      headers,
      payload: hasBody ? Buffer.from(await request.arrayBuffer()) : undefined,
    });
    const out = new Headers();
    for (const [name, value] of Object.entries(res.headers)) {
      if (value === undefined || name === 'content-length' || name === 'transfer-encoding' || name === 'connection') continue;
      for (const v of Array.isArray(value) ? value : [value]) out.append(name, String(v));
    }
    const empty = res.statusCode === 204 || res.statusCode === 304 || request.method === 'HEAD';
    return new Response(empty ? null : new Uint8Array(res.rawPayload), { status: res.statusCode, headers: out });
  };
}

/* Headers only the Worker may set. A copy from the browser is dropped, or a
   caller could pick their own address and walk around the rate limits. */
const UNTRUSTED = ['x-forwarded-for', 'x-real-ip', 'x-bb-client-ip', 'x-bb-proxy-secret', 'host'];

/* Links in emails point at the app. Unless WEB_ORIGIN says otherwise, that is
   the origin this Worker is serving — Cloudflare only routes this Worker's
   own hostnames here, so the request cannot name someone else's. */
const originConfigured = Boolean(process.env.WEB_ORIGIN);

export async function handleApi(request: Request, bindings: ApiBindings, path: string): Promise<Response> {
  if (!originConfigured) env.WEB_ORIGIN = new URL(request.url).origin;
  bindDatabase(bindings.DB);
  if (bindings.FILES) bindBucket(bindings.FILES);
  const dispatch = await prepare(bindings.DB, bindings.DEMO_SEED);

  const headers = new Headers(request.headers);
  for (const name of UNTRUSTED) headers.delete(name);
  headers.set('x-bb-client-ip', request.headers.get('cf-connecting-ip') ?? '');
  headers.set('x-bb-proxy-secret', env.PROXY_SECRET!);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  return dispatch(
    new Request(new URL(path, 'http://api.internal'), {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: 'manual',
    }),
  );
}
