import 'dotenv/config';
import { buildApp } from './app.ts';
import { env } from './lib/env.ts';
import { sql } from './db/client.ts';
import { backfillCityCentrePins } from './lib/backfill-pins.ts';

const app = await buildApp();

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

/* In the background: serving requests never waits on it. */
void backfillCityCentrePins((msg) => app.log.info(msg)).catch((err) => app.log.warn({ err }, 'pin backfill stopped'));

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    app.log.info(`${signal} received, shutting down`);
    await app.close();
    await sql.end();
    process.exit(0);
  });
}
