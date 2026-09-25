import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

let saved: Map<string, string>;
let scripts: { src: string }[];
const gtag = vi.fn();
const reload = vi.fn();
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  saved = new Map(); scripts = [];
  vi.stubGlobal('localStorage', { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) });
  vi.stubGlobal('window', Object.assign(new EventTarget(), { gtag, location: { reload } }));
  vi.stubGlobal('location', { origin: 'https://example.test', pathname: '/en/' });
  vi.stubGlobal('document', { referrer: 'https://example.test/?name=private', createElement: () => ({}), head: { appendChild: (s: {src: string}) => scripts.push(s) } });
});
afterEach(() => vi.unstubAllGlobals());

const config = { locale: 'en' as const, apiBase: '', ga4: 'G-TEST', gads: 'AW-TEST', gadsLabel: '', meta: '', openai: '', turnstile: '', env: 'preview' as const, placeId: '', whatsapp: '' };

describe('consent boundaries with configured analytics IDs', () => {
  it('rejects malformed and expired saved permissions', async () => {
    const { getConsent } = await import('../src/scripts/consent');
    for (const state of [
      { v: 1, necessary: true, analytics: 'false', marketing: true, ts: Date.now() },
      { v: 1, necessary: true, analytics: true, marketing: true, ts: 1 },
    ]) {
      saved.set('ayaz.consent.v1', JSON.stringify(state));
      expect(getConsent()).toBeNull();
    }
  });
  it('does not configure GA4 with marketing-only consent; configures it when separately allowed', async () => {
    const { setConsent } = await import('../src/scripts/consent');
    const { initAnalytics } = await import('../src/scripts/analytics');
    initAnalytics(config);
    expect(scripts).toHaveLength(0);
    setConsent(false, true);
    expect(scripts[0].src).toContain('id=AW-TEST');
    expect(gtag.mock.calls.some(([op, id]) => op === 'config' && id === 'G-TEST')).toBe(false);
    setConsent(true, true);
    expect(gtag).toHaveBeenCalledWith('config', 'G-TEST', expect.objectContaining({ page_location: 'https://example.test/en/', page_referrer: 'https://example.test/' }));
    expect(scripts).toHaveLength(1);
  });
  it('discards arbitrary event names and personal parameters, then unloads adapters on withdrawal', async () => {
    const { setConsent } = await import('../src/scripts/consent');
    const { initAnalytics, track } = await import('../src/scripts/analytics');
    initAnalytics(config);
    setConsent(true, false);
    track('appointment_start', { mode: 'api', name: 'Private', phone: '05071234567' });
    expect(gtag).toHaveBeenCalledWith('event', 'appointment_start', { mode: 'api', send_to: 'G-TEST' });
    track('private-diagnosis', { mode: 'api' });
    expect(gtag.mock.calls.some(([, event]) => event === 'private-diagnosis')).toBe(false);
    setConsent(false, false);
    expect(reload).toHaveBeenCalledOnce();
  });
  it('keeps the choice for this page if browser storage is unavailable', async () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('disabled'); }, setItem: () => { throw new Error('disabled'); } });
    const { setConsent, getConsent } = await import('../src/scripts/consent');
    setConsent(false, true);
    expect(getConsent()?.marketing).toBe(true);
  });
});
