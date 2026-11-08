import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema.ts';

/**
 * Cloudflare D1. The Worker binds it per isolate (worker.ts), tests and the
 * seed script bind a local one through Miniflare. Everything else imports
 * `db` and does not care which.
 */
export type Db = DrizzleD1Database<typeof schema>;

/* On globalThis so a test that re-imports this module still finds the
   database bound before it. */
const state = ((globalThis as Record<symbol, unknown>)[Symbol.for('miftan.db')] ??= {
  current: null,
  raw: null,
}) as { current: Db | null; raw: D1Database | null };

export function bindDatabase(d1: D1Database): void {
  if (state.raw === d1) return;
  state.raw = d1;
  state.current = drizzle(d1, { schema });
}

export function rawDatabase(): D1Database {
  if (!state.raw) throw new Error('no database bound: call bindDatabase() first');
  return state.raw;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const current = state.current;
    if (!current) throw new Error('no database bound: call bindDatabase() first');
    const value = Reflect.get(current, prop, current);
    return typeof value === 'function' ? value.bind(current) : value;
  },
});

export { schema };
