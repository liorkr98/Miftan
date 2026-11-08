import { inArray as drizzleInArray, sql, type SQL, type SQLWrapper } from 'drizzle-orm';

/**
 * `inArray`, for D1. D1 refuses more than 100 bound values in one statement,
 * and an owner's property ids or a page of leads can pass that alone. A long
 * list goes over as a single JSON parameter instead. Dates become epoch
 * milliseconds, which is how timestamp columns store them.
 */
const INLINE_MAX = 20;

export function inArray(column: SQLWrapper, values: readonly unknown[] | SQLWrapper): SQL {
  if (!Array.isArray(values) || values.length <= INLINE_MAX) {
    return drizzleInArray(column as never, values as never);
  }
  return sql`${column} in (select value from json_each(${JSON.stringify(values.map((v) => (v instanceof Date ? v.getTime() : v)))}))`;
}
