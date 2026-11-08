import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Miniflare } from 'miniflare';
import { bindDatabase } from '../src/db/client.ts';
import { migrate } from '../src/db/migrate.ts';
import { seedDemoData } from '../src/db/demo-data.ts';

/**
 * Renders the demo portfolio as SQL for the Worker to load into an empty D1
 * (src/db/demo-seed.ts). Run at build time, so the dates in it — leases
 * ending "in 112 days", rent due "this month" — are as fresh as the deploy.
 *
 * The seed itself cannot run inside the Worker: hashing the shared password
 * and building a few thousand rows is more CPU than one request may use. A
 * batch of ready-made statements is almost all database time instead.
 *
 * Output: apps/api/.demo/seed.json (gitignored), imported by the web Worker.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../.demo/seed.json');

/* Never shipped: per-isolate secrets and sign-ins, and the bulky synthetic
   traffic, which is generated in the database instead (see VIEWS below). */
const SKIP = new Set(['__migrations', 'listing_views', 'sessions', 'auth_tokens']);
const MAX_STATEMENT_BYTES = 90_000;

const literal = (v: unknown): string => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number' || typeof v === 'bigint') return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  return `'${String(v).replace(/'/g, "''")}'`;
};

/* Background traffic for the listed flats: up to six visitors a day over the
   last sixty days, so the owner's charts are not empty. */
const VIEWS = `
INSERT OR IGNORE INTO listing_views (id, property_id, viewer_key, day, at)
WITH RECURSIVE d(n) AS (SELECT 0 UNION ALL SELECT n + 1 FROM d WHERE n < 59),
               v(k) AS (SELECT 0 UNION ALL SELECT k + 1 FROM v WHERE k < 5)
SELECT 'lv_seed_' || p.id || '_' || d.n || '_' || v.k, p.id, 'a:seed-' || d.n || '-' || v.k,
       date('now', '-' || d.n || ' days'),
       (unixepoch('now', '-' || d.n || ' days') - v.k * 3600) * 1000
FROM properties p, d, v
WHERE p.listed = 1 AND p.deleted_at IS NULL AND abs(random()) % 6 > v.k`;

export async function renderDemoSeed(): Promise<string[]> {
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response(null, { status: 404 }) } }',
    d1Databases: { DB: 'render' },
  });
  try {
    const d1 = (await mf.getD1Database('DB')) as unknown as D1Database;
    bindDatabase(d1);
    await migrate(d1);
    await seedDemoData();

    const tables = (
      await d1
        .prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite!_%' escape '!' and name not like '!_cf!_%' escape '!'")
        .all<{ name: string }>()
    ).results
      .map((r) => r.name)
      .filter((t) => !SKIP.has(t))
      .sort();

    const statements: string[] = [];
    for (const table of tables) {
      const rows = (await d1.prepare(`select * from "${table}"`).all<Record<string, unknown>>()).results;
      if (rows.length === 0) continue;
      const columns = Object.keys(rows[0]);
      const head = `INSERT OR IGNORE INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES `;
      let values: string[] = [];
      let size = head.length;
      for (const row of rows) {
        const tuple = `(${columns.map((c) => literal(row[c])).join(', ')})`;
        if (values.length && size + tuple.length + 1 > MAX_STATEMENT_BYTES) {
          statements.push(head + values.join(','));
          values = [];
          size = head.length;
        }
        values.push(tuple);
        size += tuple.length + 1;
      }
      statements.push(head + values.join(','));
    }
    statements.push(VIEWS.trim());
    return statements;
  } finally {
    await mf.dispose();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const statements = await renderDemoSeed();
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), statements }));
  const bytes = statements.reduce((n, s) => n + s.length, 0);
  console.log(`demo seed rendered: ${statements.length} statements, ${Math.round(bytes / 1024)} KB`);
}
