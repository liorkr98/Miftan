import { MIGRATIONS } from './migrations.gen.ts';

/**
 * Brings a D1 database up to date. The Worker calls this once per isolate
 * before its first request, so a deploy that adds a table carries its own
 * migration and nobody has to run anything by hand.
 *
 * Each migration and its bookkeeping row go in one batch, which D1 runs as a
 * single transaction: a migration is either fully applied or not at all.
 */
export async function migrate(d1: D1Database): Promise<void> {
  await d1
    .prepare('create table if not exists __migrations (tag text primary key, applied_at integer not null)')
    .run();
  const applied = async () =>
    new Set((await d1.prepare('select tag from __migrations').all<{ tag: string }>()).results.map((r) => r.tag));

  let done = await applied();
  for (const m of MIGRATIONS) {
    if (done.has(m.tag)) continue;
    const statements = m.sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => d1.prepare(s));
    try {
      await d1.batch([
        ...statements,
        d1.prepare('insert into __migrations (tag, applied_at) values (?, ?)').bind(m.tag, Date.now()),
      ]);
    } catch (err) {
      /* Another isolate may have applied it in the same moment. */
      done = await applied();
      if (!done.has(m.tag)) throw err;
    }
  }
}
