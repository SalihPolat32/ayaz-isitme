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
  it('explorer models and hotspots match the viewer part ids', () => {
    const PART_IDS: Record<string, string[]> = {
      ric: ['mics', 'body', 'button', 'wire', 'receiver', 'dome', 'battery-door', 'battery'],
      bte: ['mics', 'body', 'button', 'hook', 'tube', 'earmold', 'battery-door', 'battery'],
      cic: ['shell', 'faceplate', 'mic', 'battery-door', 'battery', 'vent', 'pull-string', 'receiver-outlet'],
    };
    for (const c of [tr, en]) {
      expect(c.explorer.models.map((m) => m.id)).toEqual(['ric', 'bte', 'cic']);
      for (const m of c.explorer.models) expect(m.hotspots.map((h) => h.id)).toEqual(PART_IDS[m.id]);
    }
  });
  it('device types cover all six form factors in the same order', () => {
    const codes = ['bte', 'ric', 'ite', 'itc', 'cic', 'iic'];
    for (const c of [tr, en]) expect(c.devices.types.map((t) => t.id)).toEqual(codes);
  });
  it('visibility dots: more filled dots = MORE visible (BTE most, IIC least), TR/EN levels match', () => {
    const lv = (c: typeof tr) => Object.fromEntries(c.devices.types.map((t) => [t.id, t.visibility.level]));
    const t = lv(tr);
    expect(lv(en)).toEqual(t);
    expect(t).toEqual({ bte: 5, ric: 3, ite: 4, itc: 3, cic: 2, iic: 1 });
    expect(t.bte!).toBeGreaterThan(t.ite!);
    expect(t.ite!).toBeGreaterThan(t.itc!);
    expect(t.itc!).toBeGreaterThan(t.iic!);
    expect(t.cic!).toBeGreaterThan(t.iic!);
    // Aynı seviye = aynı etiket (bir nokta sayısı tek anlam taşır), 1..5 aralığı kullanılır
    for (const c of [tr, en]) {
      const byLevel = new Map<number, Set<string>>();
      for (const d of c.devices.types) byLevel.set(d.visibility.level, (byLevel.get(d.visibility.level) ?? new Set()).add(d.visibility.label));
      for (const labels of byLevel.values()) expect(labels.size).toBe(1);
      expect(Math.min(...byLevel.keys())).toBe(1);
      expect(Math.max(...byLevel.keys())).toBe(5);
    }
    expect(tr.devices.figure.visibilityAria(2, 'Az görünür')).toBe('Görünürlük: 5 üzerinden 2 (Az görünür)');
    expect(en.devices.figure.visibilityAria(2, 'Discreet')).toBe('Visibility: 2 out of 5 (Discreet)');
    // Görünür "dolu nokta arttıkça…" açıklaması kaldırıldı; nokta + etiket + ekran okuyucu metni yeterli
    for (const c of [tr, en]) expect(Object.keys(c.devices.figure)).not.toContain('visibilityHint');
    expect(JSON.stringify(tr)).not.toMatch(/Dolu nokta arttıkça/);
    expect(JSON.stringify(en)).not.toMatch(/filled dots/i);
  });
  it('team card text: TR as approved, EN same meaning', () => {
    expect(tr.center.teamText).toBe('Sizi dinleyerek başlıyor, ihtiyaçlarınızı ve günlük yaşamınızı birlikte değerlendiriyoruz. Cihaz seçiminden kişiye özel uygulamaya, alışma sürecinden bakım ve düzenli takibe kadar her adımda size eşlik ediyoruz. Sorularınızı yanıtlamak ve cihazınızı günlük hayatınızda rahatça kullanabilmeniz için yanınızdayız.');
    expect(en.center.teamText).toBe('We begin by listening, and together we look at your needs and your everyday life. From choosing your device and fitting it to your ears, through getting used to it, to care and regular follow-up, we are with you at every step. We are here to answer your questions and to help you use your hearing aid comfortably in daily life.');
  });
  it('device pictures are called illustrations / representative renders, never photos', () => {
    for (const c of [tr, en]) {
      const f = c.devices.figure;
      const texts = [f.earLabel('X'), f.thumbAlt('X'), f.behindEarNote, f.inEarNote, ...c.explorer.models.map((m) => m.caption)];
      for (const s of texts) expect(s.toLowerCase()).not.toMatch(/foto|photo/);
    }
    expect(tr.devices.figure.earLabel('BTE')).toContain('Temsili çizim');
    expect(tr.devices.figure.thumbAlt('BTE')).toContain('temsili görsel');
    expect(en.devices.figure.earLabel('BTE')).toContain('Illustration');
    expect(en.devices.figure.thumbAlt('BTE')).toContain('Representative render');
    expect(tr.devices.figure.behindEarNote).toContain('yarı saydam');
    expect(en.devices.figure.behindEarNote).toContain('semi-transparent');
  });
  it('görsel bölümler: TR/EN aynı kimlikler, aynı marka grupları; kalıp görseli "temsili"', () => {
    for (const c of [tr, en]) {
      expect(c.devices.systems.items.map((s) => s.id)).toEqual(['cros', 'power', 'kids']);
      expect(c.earMold.styles.map((t) => t.id)).toEqual(['full-shell', 'half-shell', 'skeleton', 'semi-skeleton', 'canal', 'canal-lock', 'cros', 'micro']);
      expect(c.earMold.materials.map((t) => t.id)).toEqual(['acrylic', 'silicone', 'dome']);
      expect(c.process.steps).toHaveLength(4);
      expect(c.earMold.steps).toHaveLength(4);
      expect(c.brands.tech).toHaveLength(6);
    }
    const groups = (c: typeof tr) => c.brands.groups.map((g) => [g.group, g.brands]);
    expect(groups(en)).toEqual(groups(tr));
    expect(tr.earMold.imageAlt).toContain('temsili görsel');
    expect(en.earMold.imageAlt).toContain('Representative render');
    for (const c of [tr, en]) expect(c.earMold.imageAlt.toLowerCase()).not.toMatch(/foto|photo/);
    // Kalıp galerisi: görseller temsili ve aynı ölçekte olduğu açıkça yazılır
    expect(tr.earMold.stylesNote).toMatch(/^Temsili görseller, aynı ölçekte/);
    // Silikon için kaynaklarla desteklenmeyen "sızdırmazlığı yüksek" iddiası yok (ötmeyi belirleyen doğru oturmadır)
    for (const c of [tr, en]) expect(c.earMold.materials.find((m) => m.id === 'silicone')!.text).not.toMatch(/sızdırmaz|seal/i);
    expect(en.earMold.stylesNote).toMatch(/^Representative renders, shown to the same scale/);
  });
  it('kısaltılmış bölümler: kart metinleri kısa kalır (yazı yığını olmasın)', () => {
    for (const c of [tr, en]) {
      const short = [
        ...c.devices.systems.items.map((s) => s.text),
        ...c.brands.tech.map((t) => t.text),
        ...c.services.items.map((s) => s.text),
        ...c.earMold.steps.map((s) => s.text),
        ...c.earMold.styles.map((t) => t.text),
        ...c.earMold.materials.map((t) => t.text),
        ...c.process.steps.map((s) => s.text),
      ];
      for (const t of short) expect(t.length, t).toBeLessThanOrEqual(160);
    }
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
    expect(canShow({ status: 'unverified' })).toBe(false);
    expect(canShow(business.geo)).toBe(false);
  });
  it('Place ID and opening hours come from the verified Google profile', () => {
    expect(business.google.placeId.value).toMatch(/^ChIJ[\w-]{20,}$/);
    expect(canShow(business.google.placeId)).toBe(true);
    expect(canShow(business.hours)).toBe(true);
    expect(business.hours.weekly[0]).toMatchObject({ opens: '09:00', closes: '19:00' });
    expect(business.google.placeUrl).toContain(`query_place_id=${business.google.placeId.value}`);
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
