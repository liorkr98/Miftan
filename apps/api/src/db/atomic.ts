import { getTableColumns, sql } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { BatchItem } from 'drizzle-orm/batch';
import type { ApiError } from '@miftan/shared';
import { db, type Db } from './client.ts';

/**
 * D1 has no interactive transactions — drizzle's `db.transaction` sends a
 * BEGIN that D1 refuses — but a batch commits or rolls back as one. So a
 * handler does its reads and checks first, then hands every write here
 * unawaited: all of them land, or none do.
 *
 * What a row lock used to protect becomes a conditional write followed by
 * `expectChanged()`: if the write matched nothing because someone else got
 * there first, the whole batch rolls back and `onConflict` is thrown.
 */
type Write = BatchItem<'sqlite'> | null | undefined | false;

const GUARD = 'miftan_expect_changed';

/** Fails the batch unless the statement just before it changed a row. */
export function expectChanged(): BatchItem<'sqlite'> {
  /* Inlined, not bound: drizzle's D1 batch mishandles a raw statement with parameters. */
  return db.run(sql.raw(`select json('${GUARD}') where changes() = 0`));
}

export async function atomically(writes: ReadonlyArray<Write>, onConflict?: () => ApiError): Promise<void> {
  const items = writes.filter((w): w is BatchItem<'sqlite'> => Boolean(w));
  if (items.length === 0) return;
  try {
    await db.batch(items as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
  } catch (err) {
    if (onConflict && isGuardFailure(err)) throw onConflict();
    throw err;
  }
}

/**
 * The shape of the old `db.transaction(async (tx) => …)`, on a batch. Writes
 * made through `tx` are queued rather than run, and the queue commits as one
 * batch once `fn` returns; a throw inside `fn` discards it, which is the
 * rollback. Reads go straight to the database, so they do not see this
 * transaction's own queued writes, and an awaited write resolves to nothing —
 * no `.returning()` inside.
 */
export interface Tx {
  insert: Db['insert'];
  update: Db['update'];
  delete: Db['delete'];
  select: Db['select'];
  query: Db['query'];
  /** Roll everything back, with `onConflict`, if the write before matched no row. */
  expectChanged(): void;
}

export async function transaction<T>(fn: (tx: Tx) => Promise<T>, onConflict?: () => ApiError): Promise<T> {
  const queue: BatchItem<'sqlite'>[] = [];
  const deferred = <B extends object>(builder: B): B =>
    new Proxy(builder, {
      get(target, prop) {
        if (prop === 'then') {
          return (resolve: (v: undefined) => void) => {
            queue.push(target as unknown as BatchItem<'sqlite'>);
            resolve(undefined);
          };
        }
        const value = Reflect.get(target, prop, target);
        if (typeof value !== 'function') return value;
        return (...args: unknown[]) => {
          const out = value.apply(target, args);
          return out && typeof out === 'object' && 'then' in out ? deferred(out) : out;
        };
      },
    });
  const tx: Tx = {
    insert: ((table: never) => deferred(db.insert(table))) as Db['insert'],
    update: ((table: never) => deferred(db.update(table))) as Db['update'],
    delete: ((table: never) => deferred(db.delete(table))) as Db['delete'],
    select: db.select.bind(db) as Db['select'],
    get query() {
      return db.query;
    },
    expectChanged: () => void queue.push(expectChanged()),
  };
  const result = await fn(tx);
  await atomically(queue, onConflict);
  return result;
}

/**
 * One multi-row insert, split into statements under D1's 100-value limit.
 * `finish` adds the same tail to each — usually `onConflictDoNothing`.
 */
const MAX_PARAMS = 100;
type InsertValues<T extends SQLiteTable> = ReturnType<ReturnType<typeof db.insert<T>>['values']>;

export function insertChunks<T extends SQLiteTable>(
  table: T,
  rows: readonly T['$inferInsert'][],
  finish: (insert: InsertValues<T>) => BatchItem<'sqlite'> = (insert) => insert as unknown as BatchItem<'sqlite'>,
): BatchItem<'sqlite'>[] {
  const perStatement = Math.max(1, Math.floor(MAX_PARAMS / Object.keys(getTableColumns(table)).length));
  const out: BatchItem<'sqlite'>[] = [];
  for (let i = 0; i < rows.length; i += perStatement) {
    out.push(finish(db.insert(table).values(rows.slice(i, i + perStatement) as T['$inferInsert'][]) as InsertValues<T>));
  }
  return out;
}

function isGuardFailure(err: unknown): boolean {
  for (let e: unknown = err; e instanceof Error; e = e.cause) {
    if (e.message.includes('malformed JSON')) return true;
  }
  return false;
}
