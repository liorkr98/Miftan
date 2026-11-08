import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderMigrations } from '../../scripts/bundle-migrations.ts';

describe('migrations bundled into the Worker', () => {
  it('match migrations/*.sql — run `npm run db:generate -w @miftan/api` if this fails', () => {
    const bundled = readFileSync(new URL('../db/migrations.gen.ts', import.meta.url), 'utf8');
    expect(bundled).toBe(renderMigrations());
  });
});
