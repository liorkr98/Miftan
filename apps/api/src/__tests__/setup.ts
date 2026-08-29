import { afterAll, beforeEach } from 'vitest';
import { sql } from '../db/client.ts';

/**
 * Every test starts from an empty database.
 *
 * TRUNCATE … CASCADE rather than dropping and re-migrating: it is far faster,
 * and it resets the tables in dependency order without anyone having to
 * maintain a list of what references what.
 */
beforeEach(async () => {
  const tables = await sql<{ tablename: string }[]>`
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> '__drizzle_migrations'
  `;
  if (tables.length === 0) return;
  const names = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await sql.unsafe(`truncate ${names} restart identity cascade`);
});

afterAll(async () => {
  await sql.end();
});
