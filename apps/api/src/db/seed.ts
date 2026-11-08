import 'dotenv/config';
import { openLocalDatabase } from './local.ts';
import { assertDemoSeedAllowed } from './demo-guard.ts';
import { seedDemoData } from './demo-data.ts';
import { DEMO_EMAIL } from './seed-demo.ts';

/**
 * Loads the demo portfolio into the local D1 that `wrangler dev` serves.
 * Refuses unless DEMO_DATABASE=true, and again if the database already holds
 * a real account (demo-guard.ts).
 */
const local = await openLocalDatabase();
try {
  await assertDemoSeedAllowed();
  console.log('seeding…');
  console.log('seeded —', await seedDemoData());
  console.log(`demo marker written. Accounts are @demo.baalabait.invalid (for example ${DEMO_EMAIL}).`);
  console.log('The shared password is not printed. It lives in the demo password manager.');
} finally {
  await local.close();
}
