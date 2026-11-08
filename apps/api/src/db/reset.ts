import 'dotenv/config';
import { assertSafeToErase } from './demo-guard.ts';
import { openLocalDatabase } from './local.ts';

/**
 * Drops every table in the local D1 and migrates it back to empty. Demo only —
 * this is how the demo database gets back to a clean slate before re-seeding.
 * It will not run against a database that holds real accounts.
 */
const local = await openLocalDatabase();
try {
  await assertSafeToErase();
  const tables = (
    await local.d1
      .prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '_cf_%'")
      .all<{ name: string }>()
  ).results.map((r) => r.name);
  await local.d1.batch([
    local.d1.prepare('PRAGMA defer_foreign_keys = on'),
    ...tables.map((t) => local.d1.prepare(`drop table if exists "${t}"`)),
  ]);
  console.log(`dropped ${tables.length} tables`);
} finally {
  await local.close();
}
