/**
 * EarView.astro içindeki elle ölçülmüş piksel sabitleri (MOLD_BORE: kalıp hortum yuvası halkası, HOOK_FRONT: kancanın
 * kulak önünde çizilen kolu) render PNG'lerine bağlıdır. `render-device-views.mjs` yeniden çalışıp PNG boyutu ya da
 * bağlantı noktası değişirse bu test düşer → sabitleri yeni PNG'den yeniden ölçün (aksi hâlde hortum–yuva birleşimi
 * sessizce kayar).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import anchors from '../src/assets/device/views/anchors.json';

const src = readFileSync(new URL('../src/components/EarView.astro', import.meta.url), 'utf8');
const grab = (name: string) => {
  const m = src.match(new RegExp(`const ${name} = \\{([^\\n]*)\\};`));
  if (!m) throw new Error(`${name} bulunamadı`);
  const num = (k: string) => Number(m[1]!.match(new RegExp(`\\b${k}: (-?[\\d.]+)`))![1]);
  const s = m[1]!.match(/src: \{ w: (\d+), h: (\d+) \}/);
  return { num, src: s ? { w: Number(s[1]), h: Number(s[2]) } : null };
};

describe('EarView piksel sabitleri render PNG\'leriyle uyumlu', () => {
  it('MOLD_BORE, ear-bte-mold.png boyutu ve hortum girişiyle eşleşir', () => {
    const b = grab('MOLD_BORE');
    const a = anchors['ear-bte-mold'];
    expect(b.src).toEqual({ w: a.width, h: a.height });
    expect(Math.abs(b.num('cx') - a.tubeInlet.x)).toBeLessThanOrEqual(4);
    expect(Math.abs(b.num('cy') - a.tubeInlet.y)).toBeLessThanOrEqual(6);
  });
  it('HOOK_FRONT, ear-bte-body.png boyutuyla eşleşir ve kanca ucunu kapsar', () => {
    const h = grab('HOOK_FRONT');
    const a = anchors['ear-bte-body'];
    expect(h.src).toEqual({ w: a.width, h: a.height });
    const x = h.num('x'), y = h.num('y'), w = h.num('w'), hh = h.num('h');
    expect(a.hookTip.x).toBeGreaterThanOrEqual(x);
    expect(a.hookTip.x).toBeLessThanOrEqual(x + w);
    expect(a.hookTip.y).toBeLessThanOrEqual(y + hh);
  });
});
