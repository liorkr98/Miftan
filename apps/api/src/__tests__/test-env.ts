/**
 * One definition of where the test database lives.
 *
 * `globalSetup` runs before vitest applies `test.env`, so it cannot rely on the
 * config's env block — both have to read this instead.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  `postgres://${process.env.USER ?? 'postgres'}@127.0.0.1:5432/miftan_test`;
