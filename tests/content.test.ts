import { describe, it, expect } from 'vitest';
import { tr } from '../src/content/tr';
import { en } from '../src/content/en';
import { business, canShow, isPublishable } from '../src/config/business';

const keysOf = (o: unknown, prefix = ''): string[] => {
  if (Array.isArray(o)) return [prefix + '[]'];
  if (o && typeof o === 'object') return Object.entries(o).flatMap(([k, v]) => keysOf(v, `${prefix}${k}.`));
  return [prefix.replace(/\.$/, '')];
};

describe('content dictionaries', () => {
  it('TR and EN have identical structure', () => {
    expect(keysOf(en).sort()).toEqual(keysOf(tr).sort());
  });
  it('nav anchors point to existing section ids used by components', () => {
    const ids = ['#cihazlar', '#hizmetler', '#merkezimiz', '#yorumlar', '#iletisim'];
    for (const c of [tr, en]) expect(c.nav.map((n) => n.href)).toEqual(ids);
  });
  it('explorer hotspots use the viewer part ids', () => {
    const parts = ['mics', 'body', 'button', 'wire', 'receiver', 'dome', 'power'];
    for (const c of [tr, en]) expect(c.explorer.hotspots.map((h) => h.id)).toEqual(parts);
  });
  it('device types cover all six form factors in the same order', () => {
    const codes = ['bte', 'ric', 'ite', 'itc', 'cic', 'iic'];
    for (const c of [tr, en]) expect(c.devices.types.map((t) => t.id)).toEqual(codes);
  });
  it('SEO title/description lengths are within limits', () => {
    for (const c of [tr, en]) {
      expect(c.seo.title.length).toBeLessThanOrEqual(65);
      expect(c.seo.description.length).toBeLessThanOrEqual(160);
    }
  });
  it('FAQ has 8–10 items', () => {
    for (const c of [tr, en]) expect(c.faq.items.length).toBeGreaterThanOrEqual(8);
    for (const c of [tr, en]) expect(c.faq.items.length).toBeLessThanOrEqual(10);
  });
});

describe('business config publishing rules', () => {
  it('unverified data is never publishable', () => {
    expect(isPublishable('unverified')).toBe(false);
    expect(canShow(business.google.placeId)).toBe(false);
    expect(canShow(business.geo)).toBe(false);
  });
  it('phone and WhatsApp are consistent', () => {
    expect(business.phone.href).toBe(`tel:${business.phone.e164}`);
    expect(business.whatsapp.href.endsWith(business.whatsapp.number)).toBe(true);
    expect(business.phone.e164).toBe(`+${business.whatsapp.number}`);
  });
  it('no other business data leaks in (Med-SEM guard)', () => {
    const blob = JSON.stringify({ business, tr, en }).toLowerCase();
    expect(blob).not.toContain('med-sem');
    expect(blob).not.toContain('medsem');
    expect(blob).not.toContain('sincan');
  });
});

it('does not publish an explicitly disabled claim even when its source is verified', () => {
  expect(canShow({ status: 'verified', value: false })).toBe(false);
});
