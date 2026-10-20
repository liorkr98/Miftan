import { sql } from './client.ts';

/** The only value that marks a database as safe to erase and re-seed. */
export const DEMO_MARKER_KEY = 'environment';
export const DEMO_MARKER_VALUE = 'demo';

/** Typed confirmation. A checkbox is too easy to leave on. */
export const ERASE_CONFIRMATION = 'erase-demo-database';

/**
 * Seed and reset used to trust NODE_ENV. CI never sets it to production, so
 * the guard never fired and a deploy option could wipe the live database.
 * The explicit flag is the gate. Production deploys do not set it.
 */
export function assertDemoFlag(): void {
  if (process.env.DEMO_DATABASE !== 'true') {
    throw new Error(
      'Refusing to seed or reset without DEMO_DATABASE=true. Production never sets this.',
    );
  }
}

interface IdRow {
  id: string;
}

/**
 * Erase is allowed only when someone typed the confirmation, and the database
 * is empty, already marked demo, or contains nothing but seeded accounts.
 * A database with a real signup and no marker is left alone.
 */
export async function assertSafeToErase(): Promise<void> {
  assertDemoFlag();
  if (process.env.CONFIRM_RESET !== ERASE_CONFIRMATION) {
    throw new Error(
      `Refusing to erase without CONFIRM_RESET=${ERASE_CONFIRMATION}.`,
    );
  }
  await assertNoRealAccounts('erase');
}

/** Seed may add demo rows. It may not land on top of people who signed up. */
export async function assertDemoSeedAllowed(): Promise<void> {
  assertDemoFlag();
  await assertNoRealAccounts('seed');
}

async function assertNoRealAccounts(action: 'seed' | 'erase'): Promise<void> {
  const [reg] = await sql<{ users: string | null }[]>`
    select to_regclass('public.users')::text as users
  `;
  if (!reg?.users) return;

  const rows = await sql<IdRow[]>`select id from users`;
  if (rows.length === 0) return;

  const [metaReg] = await sql<{ meta: string | null }[]>`
    select to_regclass('public.app_meta')::text as meta
  `;
  if (metaReg?.meta) {
    const [marker] = await sql<{ value: string }[]>`
      select value from app_meta where key = ${DEMO_MARKER_KEY}
    `;
    if (marker?.value === DEMO_MARKER_VALUE) return;
  }

  const real = rows.filter((row) => !row.id.startsWith('usr_seed_'));
  if (real.length === 0) return;

  throw new Error(
    `Refusing to ${action}: ${real.length} non-demo account(s) and no demo marker. This is not the demo database.`,
  );
}
