import { afterAll, beforeAll, beforeEach } from 'vitest';
import { Miniflare } from 'miniflare';
import { bindDatabase, rawDatabase } from '../db/client.ts';
import { migrate } from '../db/migrate.ts';
import { sentMail } from '../email/index.ts';

/**
 * A real D1 — Miniflare runs the same SQLite engine the Worker gets — fresh
 * for each test file, and emptied before every test.
 */
let mf: Miniflare | null = null;
let tables: string[] = [];

/* Module level, so files that build the app at import time find a database. */
mf = new Miniflare({
  modules: true,
  script: 'export default { fetch() { return new Response(null, { status: 404 }) } }',
  d1Databases: { DB: 'test' },
});
const d1 = (await mf.getD1Database('DB')) as unknown as D1Database;
bindDatabase(d1);
await migrate(d1);
tables = (
  await d1
    .prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not in ('__migrations', '_cf_KV', '_cf_METADATA')")
    .all<{ name: string }>()
).results.map((r) => r.name);

beforeAll(() => {
  bindDatabase(d1);
});

beforeEach(async () => {
  sentMail.length = 0;
  const db = rawDatabase();
  await db.batch([db.prepare('PRAGMA defer_foreign_keys = on'), ...tables.map((t) => db.prepare(`delete from "${t}"`))]);
});

afterAll(async () => {
  await mf?.dispose();
  mf = null;
});
