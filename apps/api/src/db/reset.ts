import 'dotenv/config';
import { sql } from './client.ts';

/**
 * Drops and recreates the public schema. Development only — this is how you
 * get back to a clean slate before re-seeding.
 */
if (process.env.NODE_ENV === 'production') {
  throw new Error('db:reset refuses to run with NODE_ENV=production');
}

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
