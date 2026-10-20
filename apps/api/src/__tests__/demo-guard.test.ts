import { afterEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import {
  assertDemoFlag,
  assertDemoSeedAllowed,
  assertSafeToErase,
  ERASE_CONFIRMATION,
} from '../db/demo-guard.ts';

const ORIGINAL = {
  DEMO_DATABASE: process.env.DEMO_DATABASE,
  CONFIRM_RESET: process.env.CONFIRM_RESET,
};

afterEach(() => {
  if (ORIGINAL.DEMO_DATABASE === undefined) delete process.env.DEMO_DATABASE;
  else process.env.DEMO_DATABASE = ORIGINAL.DEMO_DATABASE;
  if (ORIGINAL.CONFIRM_RESET === undefined) delete process.env.CONFIRM_RESET;
  else process.env.CONFIRM_RESET = ORIGINAL.CONFIRM_RESET;
});

describe('demo database guard', () => {
  it('refuses without the explicit flag', async () => {
    delete process.env.DEMO_DATABASE;
    expect(() => assertDemoFlag()).toThrow(/DEMO_DATABASE/);
  });

  it('refuses to erase without the typed confirmation', async () => {
    process.env.DEMO_DATABASE = 'true';
    delete process.env.CONFIRM_RESET;
    await expect(assertSafeToErase()).rejects.toThrow(/CONFIRM_RESET/);
  });

  it('refuses to seed or erase a database that holds a real account', async () => {
    const id = newId('user');
    await db.insert(s.users).values({ id, name: 'אמיתי', email: `${id}@example.com` });
    process.env.DEMO_DATABASE = 'true';
    process.env.CONFIRM_RESET = ERASE_CONFIRMATION;
    await expect(assertSafeToErase()).rejects.toThrow(/non-demo/);
    await expect(assertDemoSeedAllowed()).rejects.toThrow(/non-demo/);
    await db.delete(s.users).where(eq(s.users.id, id));
  });
});
