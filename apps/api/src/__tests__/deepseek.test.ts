import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { normalizeModelIntent } from '@miftan/shared';
import { buildApp } from '../app.ts';
import { interpretWithModel } from '../lib/deepseek.ts';

/**
 * The model is a third party: these tests never reach it. They check what we
 * send, that a bad reply cannot become a filter, and that search still answers
 * when no key is configured.
 */

const cfg = { apiKey: 'test-key', baseUrl: 'https://model.test', model: 'deepseek-chat' };

function fakeFetch(reply: unknown, status = 200) {
  const calls: { url: string; body: Record<string, unknown>; headers: Record<string, string> }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)), headers: init.headers as Record<string, string> });
    return new Response(JSON.stringify(reply), { status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('interpretWithModel', () => {
  it('sends only the text, and parses the JSON the model returns', async () => {
    const { impl, calls } = fakeFetch({
      choices: [{ message: { content: JSON.stringify({ areas: ['פלורנטין', 'לבונטין'], minRooms: 3, maxRooms: 3, maxPrice: 8500 }) } }],
    });
    const raw = await interpretWithModel('3 חדרים בפלורנטין או לבונטין עד 8,500', { ...cfg, fetchImpl: impl });
    const intent = normalizeModelIntent(raw);

    expect(intent.areas).toEqual(['פלורנטין', 'לבונטין']);
    expect(intent.maxPrice).toBe(8500);
    expect(calls[0]!.url).toBe('https://model.test/chat/completions');
    expect(calls[0]!.headers.authorization).toBe('Bearer test-key');
    const messages = calls[0]!.body.messages as { role: string; content: string }[];
    expect(messages.at(-1)).toEqual({ role: 'user', content: '3 חדרים בפלורנטין או לבונטין עד 8,500' });
  });

  it('throws on a failed call so the caller can fall back', async () => {
    const { impl } = fakeFetch({ error: 'nope' }, 401);
    await expect(interpretWithModel('x', { ...cfg, fetchImpl: impl })).rejects.toThrow();
  });

  it('throws on a reply that is not JSON', async () => {
    const { impl } = fakeFetch({ choices: [{ message: { content: 'sure! here you go' } }] });
    await expect(interpretWithModel('x', { ...cfg, fetchImpl: impl })).rejects.toThrow();
  });
});

describe('POST /search/interpret without a key', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it('answers from the rule parser', async () => {
    const res = await app.inject({ method: 'POST', url: '/search/interpret', payload: { text: '2-3 חדרים בפלורנטין עד 7.5 אלף' } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.source).toBe('rules');
    expect(body.intent.areas).toEqual(['פלורנטין']);
    expect(body.intent.maxPrice).toBe(7500);
  });

  it('refuses empty text', async () => {
    const res = await app.inject({ method: 'POST', url: '/search/interpret', payload: { text: '   ' } });
    expect(res.statusCode).toBe(422);
  });
});
