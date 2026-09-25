import { describe, it, expect, vi } from 'vitest';
import { readJson } from '../src/http';
import { fetchPlace } from '../src/reviews';

describe('bounded request reading', () => {
  it('limits actual UTF-8 bytes without relying on Content-Length', async () => {
    const request = new Request('https://example.test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: 'ş'.repeat(20) }) });
    expect(await readJson(request, 40)).toEqual({ ok: false, reason: 'too_large' });
  });
  it('cancels a stream as soon as it exceeds the limit', async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(100)); }, cancel });
    const request = { headers: new Headers({ 'Content-Type': 'application/json' }), body: stream } as Request;
    expect(await readJson(request, 16)).toEqual({ ok: false, reason: 'too_large' });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('still parses a normal multibyte payload', async () => {
    const request = new Request('https://example.test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"name":"Çağrı"}' });
    expect(await readJson(request)).toEqual({ ok: true, value: { name: 'Çağrı' } });
  });
});
it('requests English review text and dates for the English page', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('{}'));
  await fetchPlace('place-id', 'test-key', fetcher as typeof fetch, 'en');
  expect(new URL(fetcher.mock.calls[0]![0]).searchParams.get('languageCode')).toBe('en');
});
