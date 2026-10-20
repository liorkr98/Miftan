import 'dotenv/config';
import { sql } from './client.ts';
import { assertSafeToErase } from './demo-guard.ts';

/**
 * Drops and recreates the public schema. Demo only — this is how the demo
 * database gets back to a clean slate before re-seeding. It will not run
 * against a database that holds real accounts.
 */
await assertSafeToErase();

/* Drizzle keeps its migration journal in its own `drizzle` schema, so dropping
   only `public` leaves the journal behind — migrate then believes everything is
   already applied and silently creates nothing. Both schemas have to go. */
await sql.unsafe(`
  drop schema if exists public cascade;
  drop schema if exists drizzle cascade;
  create schema public;
`);
console.log('schema dropped and recreated');
await sql.end();
