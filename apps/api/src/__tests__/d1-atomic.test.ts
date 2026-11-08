import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { ApiError } from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { atomically, expectChanged, insertChunks, transaction } from '../db/atomic.ts';
import { inArray } from '../db/in-list.ts';

/* D1 has no BEGIN/COMMIT. These pin down what stands in for it: a batch that
   lands whole or not at all, and a guard that turns "someone got there
   first" into a rollback instead of a half-written change. */

const user = (id: string) => ({ id, email: `${id}@example.co.il`, name: id, passwordHash: null });

describe('transaction()', () => {
  it('writes nothing when the body throws part-way', async () => {
    await expect(
      transaction(async (tx) => {
        await tx.insert(s.users).values(user('usr_a'));
        throw new ApiError('forbidden', 'changed my mind');
      }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(await db.select().from(s.users)).toHaveLength(0);
  });

  it('commits every queued write together', async () => {
    await transaction(async (tx) => {
      await tx.insert(s.users).values(user('usr_a'));
      await tx.insert(s.users).values(user('usr_b'));
    });
    expect(await db.select().from(s.users)).toHaveLength(2);
  });

  it('rolls everything back, with the caller’s error, when a claim matches nothing', async () => {
    await db.insert(s.users).values(user('usr_a'));
    const taken = () => new ApiError('forbidden', 'already taken');
    const claim = () =>
      transaction(async (tx) => {
        await tx.insert(s.users).values(user(`usr_${Math.random().toString(36).slice(2, 10)}`));
        await tx.update(s.users).set({ name: 'claimed' }).where(eq(s.users.name, 'usr_a'));
        tx.expectChanged();
      }, taken);

    await claim();
    await expect(claim()).rejects.toThrow('already taken');
    /* The first claim's insert landed; the second's did not. */
    expect(await db.select().from(s.users)).toHaveLength(2);
  });
});

describe('atomically()', () => {
  it('passes through errors that are not a failed guard', async () => {
    await expect(
      atomically([db.insert(s.users).values(user('usr_a')), db.insert(s.users).values(user('usr_a'))], () => new ApiError('forbidden', 'x')),
    ).rejects.not.toBeInstanceOf(ApiError);
    expect(await db.select().from(s.users)).toHaveLength(0);
  });

  it('accepts a guard in the list directly', async () => {
    await expect(
      atomically(
        [db.insert(s.users).values(user('usr_a')), db.update(s.users).set({ name: 'x' }).where(eq(s.users.id, 'nobody')), expectChanged()],
        () => new ApiError('not_found', 'nobody'),
      ),
    ).rejects.toThrow('nobody');
    expect(await db.select().from(s.users)).toHaveLength(0);
  });
});

describe('D1’s 100-value limit', () => {
  const many = Array.from({ length: 250 }, (_, i) => user(`usr_${String(i).padStart(4, '0')}`));

  it('insertChunks splits a large insert into statements that fit', async () => {
    await atomically(insertChunks(s.users, many));
    expect(await db.select().from(s.users)).toHaveLength(250);
  });

  it('inArray takes a list longer than the limit', async () => {
    await atomically(insertChunks(s.users, many));
    const ids = many.map((u) => u.id).slice(0, 180);
    const rows = await db.select({ id: s.users.id }).from(s.users).where(inArray(s.users.id, ids));
    expect(rows).toHaveLength(180);
  });
});
