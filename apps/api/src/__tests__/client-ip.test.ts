import type { FastifyRequest } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The address the rate limits key on. Behind the web Worker every request
 * comes from Cloudflare, so the Worker forwards the caller's address — and
 * that header must only be believed when it carries the shared secret, or
 * anyone could name their own address and never be limited.
 */

const SECRET = 'proxy-secret-that-is-long-enough-0123456789';

function request(headers: Record<string, string>): FastifyRequest {
  return { headers, socket: { remoteAddress: '10.0.0.9' } } as unknown as FastifyRequest;
}

async function load(secret?: string) {
  vi.resetModules();
  if (secret) vi.stubEnv('PROXY_SECRET', secret);
  return import('../lib/http.ts');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('clientIp', () => {
  it('uses the Worker’s address when the secret matches', async () => {
    const { clientIp } = await load(SECRET);
    const ip = clientIp(
      request({ 'x-bb-client-ip': '203.0.113.7', 'x-bb-proxy-secret': SECRET, 'x-forwarded-for': '198.51.100.1' }),
    );
    expect(ip).toBe('203.0.113.7');
  });

  it('ignores a forwarded address with the wrong secret', async () => {
    const { clientIp } = await load(SECRET);
    const ip = clientIp(
      request({ 'x-bb-client-ip': '203.0.113.7', 'x-bb-proxy-secret': 'guess', 'x-forwarded-for': '198.51.100.1' }),
    );
    expect(ip).toBe('198.51.100.1');
  });

  it('ignores the header entirely when no secret is configured', async () => {
    const { clientIp } = await load();
    const ip = clientIp(request({ 'x-bb-client-ip': '203.0.113.7', 'x-bb-proxy-secret': SECRET }));
    expect(ip).toBe('10.0.0.9');
  });
});
