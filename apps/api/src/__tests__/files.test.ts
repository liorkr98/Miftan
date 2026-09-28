import { describe, expect, it } from 'vitest';
import { fileLink, toStoredKey } from '../storage/files.ts';

const KEY = 'tickets/33333333-3333-4333-8333-333333333333.jpg';

describe('stored file references', () => {
  it('keeps a bare key', () => {
    expect(toStoredKey(KEY)).toBe(KEY);
  });

  it('reduces the preview link it handed out back to the key', () => {
    expect(toStoredKey(fileLink(KEY))).toBe(KEY);
  });

  it('refuses outside URLs, paths that escape, and made-up keys', () => {
    for (const bad of [
      'https://tracker.example/pixel.gif',
      'http://127.0.0.1:4000/files/../../etc/passwd',
      'tickets/not-a-uuid.jpg',
      'secrets/33333333-3333-4333-8333-333333333333.jpg',
      'javascript:alert(1)',
    ]) {
      expect(() => toStoredKey(bad), bad).toThrow();
    }
  });

  it('passes seed placeholders through untouched when showing them', () => {
    expect(fileLink('https://picsum.photos/seed/x/800/600')).toBe('https://picsum.photos/seed/x/800/600');
  });
});
