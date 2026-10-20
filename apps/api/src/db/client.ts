import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is not set. Copy apps/api/.env.example to apps/api/.env');
}

/**
 * Neon (and any PgBouncer) hands out a *pooled* endpoint that runs in
 * transaction mode: a connection is handed back to the pool at the end of every
 * transaction. A prepared statement does not survive that, and postgres.js
 * prepares by default — so against a pooler the app works until it suddenly
 * reports `prepared statement "s1" does not exist` under load, which is a
 * miserable thing to debug at 2am.
 *
 * Providers name the pooled host differently — Neon uses `<id>-pooler.<...>`,
 * Supabase (Supavisor) uses `aws-0-<region>.pooler.supabase.com` — so match the
 * `pooler.` label either way rather than one vendor's hyphen. Supabase also
 * serves transaction mode on 6543 specifically, which is worth treating as
 * pooled on its own: a hostname check that quietly misses is how this bug
 * comes back.
 */
const isPooled = /(^|[.-])pooler\./.test(url) || /:6543(\/|$|\?)/.test(url);

/** One connection pool per process. Scripts close it explicitly. */
export const sql = postgres(url, {
  /* The pooler is doing the real pooling; ours just needs to reach it. */
  max: isPooled ? 20 : 10,
  prepare: !isPooled,
});

export const db = drizzle(sql, { schema });

export type Db = typeof db;
export { schema };
