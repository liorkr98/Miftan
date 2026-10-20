import { describe, expect, it } from 'vitest';
import { redactUrl, safeError, scrubMessage } from '../lib/log.ts';

describe('log redaction', () => {
  it('hides invite, reset and verify tokens in paths', () => {
    expect(redactUrl('/join/abc123XYZ')).toBe('/join/[redacted]');
    expect(redactUrl('/join/abc123XYZ/accept')).toBe('/join/[redacted]/accept');
    expect(redactUrl('/auth/reset/tok')).toBe('/auth/reset/[redacted]');
    expect(redactUrl('/properties/prop_1')).toBe('/properties/prop_1');
  });

  it('keeps query keys and drops their values', () => {
    expect(redactUrl('/reviews?userId=usr_1&x=2')).toBe('/reviews?userId=…&x=…');
  });

  it('drops the bound values from a failed query', () => {
    const msg = 'Failed query: insert into "users" values ($1, $2)\nparams: dana@x.co.il,0501234567,$argon2id$...';
    expect(scrubMessage(msg)).not.toContain('dana@x.co.il');
    expect(scrubMessage(msg)).toContain('insert into "users"');
  });

  it('scrubs the cause chain and never copies detail', () => {
    const cause = Object.assign(new Error('duplicate key'), {
      code: '23505',
      detail: 'Key (email)=(dana@x.co.il) already exists.',
    });
    const err = new Error('Failed query: select 1\nparams: dana@x.co.il', { cause });
    const out = JSON.stringify(safeError(err));
    expect(out).not.toContain('dana@x.co.il');
    expect(out).toContain('23505');
  });
});
