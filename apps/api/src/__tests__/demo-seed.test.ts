import { beforeAll, describe, expect, it } from 'vitest';
import { bindDatabase, rawDatabase } from '../db/client.ts';
import { seedIfEmpty } from '../db/demo-seed.ts';
import { DEV_PASSWORD } from '../db/demo-data.ts';
import { DEMO_EMAIL } from '../db/seed-demo.ts';
import { renderDemoSeed } from '../../scripts/render-demo-seed.ts';

/* What the deployed Worker loads into an empty database: the rendered
   statements must apply cleanly, produce a portfolio someone can sign in to,
   and never touch a database that already has people in it. */

let statements: string[];

beforeAll(async () => {
  const testDb = rawDatabase();
  statements = await renderDemoSeed();
  /* The renderer binds its own scratch database; put this file's back. */
  bindDatabase(testDb);
}, 60_000);

const { handleApi } = await import('../worker.ts');

describe('the demo portfolio for an empty database', () => {
  it('stays small enough to bundle', () => {
    const bytes = statements.reduce((n, s) => n + s.length, 0);
    expect(bytes).toBeLessThan(400_000);
    expect(statements.every((s) => s.length < 100_000)).toBe(true);
  });

  it('loads, and the demo account can sign in', async () => {
    const d1 = rawDatabase();
    expect(await seedIfEmpty(d1, { statements })).toBe(true);
    const views = await d1.prepare('select count(*) as n from listing_views').first<{ n: number }>();
    expect(views!.n).toBeGreaterThan(0);

    const res = await handleApi(
      new Request('https://miftan.example/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: DEMO_EMAIL, password: DEV_PASSWORD }),
      }),
      { DB: d1 },
      '/auth/login',
    );
    expect(res.status).toBe(200);
  });

  it('leaves a database that already has a user alone', async () => {
    const d1 = rawDatabase();
    await d1.prepare("insert into users (id, email, name) values ('usr_real', 'real@example.co.il', 'אמיתי')").run();
    expect(await seedIfEmpty(d1, { statements })).toBe(false);
    const n = await d1.prepare('select count(*) as n from users').first<{ n: number }>();
    expect(n!.n).toBe(1);
  });
});
