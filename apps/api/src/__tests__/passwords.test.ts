import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../lib/auth.ts';

describe('password hashing (PBKDF2-SHA256)', () => {
  it('verifies the right password and refuses a wrong one', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(await verifyPassword(hash, 'correct horse battery')).toBe(true);
    expect(await verifyPassword(hash, 'correct horse batterY')).toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('reads the iteration count from the hash, so it can be raised later', async () => {
    const old = await hashPassword('pw', 2_000);
    expect(old.split('$')[1]).toBe('2000');
    expect(await verifyPassword(old, 'pw')).toBe(true);
  });

  it('refuses anything that is not one of its hashes', async () => {
    for (const bad of ['', 'plain', '$argon2id$v=19$m=19456,t=2,p=1$abc$def', 'pbkdf2_sha256$0$AA==$AA==', 'pbkdf2_sha256$x$AA==$AA==']) {
      expect(await verifyPassword(bad, 'pw'), bad).toBe(false);
    }
  });
});
