import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is not set. Copy apps/api/.env.example to apps/api/.env');
}

/** One connection pool per process. Scripts close it explicitly. */
export const sql = postgres(url, { max: 10 });
export const db = drizzle(sql, { schema });

export type Db = typeof db;
export { schema };
