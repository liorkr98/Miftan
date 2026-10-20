import 'dotenv/config';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, sql } from './client.ts';

await migrate(db, { migrationsFolder: './drizzle' });
console.log('migrations applied');

/*
 * Supabase publishes the public schema through its Data API, reachable with a
 * key that is public by design. This app never uses that API — it talks to
 * Postgres directly — so every table gets row-level security and no policies:
 * the API sees nothing, while the app's own connection (the tables' owner)
 * is unaffected. Harmless on plain Postgres. It runs after every migration,
 * so a table somebody adds later is covered the first time it is deployed.
 */
const [{ secured }] = await sql<{ secured: number }[]>`
  with t as (
    select tablename from pg_tables where schemaname = 'public' and not rowsecurity
  ) select count(*)::int as secured from t
`;
await sql.unsafe(`
  do $$
  declare t record;
  begin
    for t in select tablename from pg_tables where schemaname = 'public' and not rowsecurity loop
      execute format('alter table public.%I enable row level security', t.tablename);
    end loop;
  end $$;
`);
if (secured > 0) console.log(`row-level security enabled on ${secured} table(s)`);
await sql.end();
