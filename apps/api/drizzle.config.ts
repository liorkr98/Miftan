import { defineConfig } from 'drizzle-kit';

/* D1 is SQLite. Migrations are generated here and applied by the Worker
   itself on its first request (src/db/migrate.ts), so a deploy never needs a
   separate migration step. */
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './migrations',
  verbose: true,
  strict: true,
});
