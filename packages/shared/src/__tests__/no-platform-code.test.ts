import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * @miftach/shared must stay runnable in Node, a browser and a Capacitor
 * webview alike, because the API and the app both depend on it.
 *
 * The tsconfig includes the DOM lib so the API client can use `fetch` — which
 * is a genuinely universal API — but that also makes `document` typecheck. So
 * the real guard is here rather than in the compiler: a rule enforced by a test
 * is a rule, a rule enforced by a comment is a wish.
 */

const ROOT = new URL('../', import.meta.url).pathname;

const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  { pattern: /from ['"]react/, why: 'React is a UI concern' },
  { pattern: /from ['"]node:/, why: 'Node built-ins do not exist in a browser' },
  { pattern: /\bdocument\s*\./, why: 'the DOM does not exist on the server' },
  { pattern: /\bwindow\s*\./, why: 'window does not exist on the server' },
  { pattern: /\blocalStorage\b/, why: 'storage is platform-specific' },
  { pattern: /\bprocess\.env\b/, why: 'env access belongs to the app, not the domain' },
];

/** Comments discuss platform APIs legitimately; only code should be matched. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === '__tests__' ? [] : sourceFiles(full);
    }
    return full.endsWith('.ts') ? [full] : [];
  });
}

describe('@miftach/shared stays platform-free', () => {
  const files = sourceFiles(ROOT);

  it('finds source files to check', () => {
    expect(files.length).toBeGreaterThan(4);
  });

  it.each(FORBIDDEN)('contains no $why', ({ pattern }) => {
    const offenders = files.filter((f) => pattern.test(stripComments(readFileSync(f, 'utf8'))));
    expect(offenders.map((f) => f.replace(ROOT, ''))).toEqual([]);
  });
});
