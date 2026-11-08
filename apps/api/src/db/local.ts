import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';
import { bindDatabase } from './client.ts';
import { migrate } from './migrate.ts';

/**
 * The same local D1 that `wrangler dev` serves — same state directory, same
 * database id as the `DB` binding in wrangler.jsonc — opened from Node, so
 * seed and reset scripts write the database the dev server reads.
 */
export const D1_DATABASE_ID = 'a1fd7db5-0041-4a3a-a4ae-939a1ec190dd';
const STATE_DIR = fileURLToPath(new URL('../../../../.wrangler/state/v3/d1', import.meta.url));

export async function openLocalDatabase(): Promise<{ d1: D1Database; close: () => Promise<void> }> {
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response(null, { status: 404 }) } }',
    d1Databases: { DB: D1_DATABASE_ID },
    d1Persist: STATE_DIR,
  });
  const d1 = (await mf.getD1Database('DB')) as unknown as D1Database;
  bindDatabase(d1);
  await migrate(d1);
  return { d1, close: () => mf.dispose() };
}
