import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { db, type Db } from './client.ts';
import { atomically, insertChunks } from './atomic.ts';

/**
 * What the seed scripts write through. The fixtures insert dozens of rows at
 * a time, past D1's 100-value limit per statement, so each insert is split by
 * insertChunks and sent as one batch. Writes run immediately — later seed
 * steps read rows earlier ones made.
 */
type InsertChain = PromiseLike<void> & {
  onConflictDoNothing(...args: unknown[]): PromiseLike<void>;
  onConflictDoUpdate(...args: unknown[]): PromiseLike<void>;
};

export interface SeedTx {
  insert<T extends SQLiteTable>(table: T): {
    values(rows: T['$inferInsert'] | T['$inferInsert'][]): InsertChain;
  };
  update: Db['update'];
  select: Db['select'];
}

function insert<T extends SQLiteTable>(table: T) {
  return {
    values(rows: T['$inferInsert'] | T['$inferInsert'][]): InsertChain {
      const list = Array.isArray(rows) ? rows : [rows];
      const chain = (tail?: (insert: never) => unknown): PromiseLike<void> => ({
        then: (resolve, reject) =>
          atomically(insertChunks(table, list, tail as never)).then(resolve, reject),
      });
      return {
        ...chain(),
        onConflictDoNothing: (...args: unknown[]) =>
          chain((i: { onConflictDoNothing: (...a: unknown[]) => unknown }) => i.onConflictDoNothing(...args)),
        onConflictDoUpdate: (...args: unknown[]) =>
          chain((i: { onConflictDoUpdate: (...a: unknown[]) => unknown }) => i.onConflictDoUpdate(...args)),
      };
    },
  };
}

export const seedTx: SeedTx = {
  insert,
  update: ((table: never) => db.update(table)) as Db['update'],
  select: ((...fields: never[]) => (db.select as (...a: never[]) => unknown)(...fields)) as Db['select'],
};
