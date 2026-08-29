import { execFileSync } from 'node:child_process';
import { TEST_DATABASE_URL } from './test-env.ts';

/**
 * Migrations run once for the whole suite rather than per file — the schema is
 * identical for every test and re-applying it each time is just slow.
 */
export default function setup() {
  execFileSync('npx', ['tsx', 'src/db/migrate.ts'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
