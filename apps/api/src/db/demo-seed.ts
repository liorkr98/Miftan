/**
 * Loads the rendered demo portfolio (scripts/render-demo-seed.ts) into a D1
 * that has nobody in it yet.
 *
 * HUMAN REVIEW: this creates the demo accounts, which share a published
 * password, in whatever database the Worker is bound to. It runs only when
 * DEMO_DATABASE=true is set on the Worker and the users table is empty, so it
 * can never land on top of real sign-ups. Remove DEMO_DATABASE before the
 * first real user, and this never runs again.
 */
export interface DemoSeed {
  statements: readonly string[];
}

export async function seedIfEmpty(d1: D1Database, seed: DemoSeed): Promise<boolean> {
  const existing = await d1.prepare('select count(*) as n from users').first<{ n: number }>();
  if ((existing?.n ?? 0) > 0) return false;
  /* One batch: the whole portfolio or none of it. INSERT OR IGNORE, so two
     isolates seeding at the same moment do not trip over each other. */
  await d1.batch([d1.prepare('PRAGMA defer_foreign_keys = on'), ...seed.statements.map((sql) => d1.prepare(sql))]);
  return true;
}
