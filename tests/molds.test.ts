import { describe, expect, it } from 'vitest';
import { buildMoldGeometry, MOLD_STYLES, moldSdf } from '../src/scripts/viewer/molds';
import { UNIT_MM } from '../src/scripts/viewer/parts';

// Kalıp biçimleri (yalnızca render için): biçimin tanımı geometride doğru mu?
// SDF < 0 → malzemenin içi. Noktalar mm, yan görünüş eksenleri (+x ön, +y yukarı, +z yanal).
const inside = (style: (typeof MOLD_STYLES)[number], p: [number, number, number]) => moldSdf(style)(...p) < 0;

/** Konka boşluğunun ortası (plaka orta düzlemi) */
const CAVUM: [number, number, number] = [-8, -3, 0.6];
/** Kanal omurgasının ortası, ses deliğinin dışında (duvar) */
const CANAL_WALL: [number, number, number] = [1.3, -1.6, -5.6];
/** Ses deliği ekseni (kanal ortası) */
const BORE: [number, number, number] = [1.3, 1.1, -5.6];
/** Heliks kilidi kolunun tepesi */
const HELIX_TOP: [number, number, number] = [-4.8, 15.2, -0.8];
/** Konka çerçevesinin alt-arkası (antitragus) */
const RIM_LOWER: [number, number, number] = [-10.8, -11.0, 1.0];

describe('kulak kalıbı biçimleri', () => {
  it('tam konka konkayı doldurur; iskelet ve yarım iskeletin ortası boştur', () => {
    expect(inside('full-shell', CAVUM)).toBe(true);
    expect(inside('half-shell', CAVUM)).toBe(true);
    expect(inside('skeleton', CAVUM)).toBe(false);
    expect(inside('semi-skeleton', CAVUM)).toBe(false);
    expect(inside('cros', CAVUM)).toBe(false);
  });

  it('heliks kilidi: tam konka, iskelet, yarım iskelet ve CROS\'ta var; yarım konka ve kanal biçimlerinde yok', () => {
    for (const s of ['full-shell', 'skeleton', 'semi-skeleton', 'cros'] as const) expect(inside(s, HELIX_TOP), s).toBe(true);
    for (const s of ['half-shell', 'canal', 'canal-lock', 'micro'] as const) expect(inside(s, HELIX_TOP), s).toBe(false);
  });

  it('kanal, kilitli kanal ve kanal içi (mikro) konkayı doldurmaz; yalnız kilitli kanalda konka tabanına uzanan kilit var', () => {
    for (const s of ['canal', 'canal-lock', 'micro'] as const) expect(inside(s, CAVUM), s).toBe(false);
    const LOCK: [number, number, number] = [-7.6, -8.2, 1.0];
    expect(inside('canal-lock', LOCK)).toBe(true);
    expect(inside('canal', LOCK)).toBe(false);
    expect(inside('micro', LOCK)).toBe(false);
  });

  it('iskeletin alt çerçevesi var; yarım iskeletin yok', () => {
    expect(inside('skeleton', RIM_LOWER)).toBe(true);
    expect(inside('semi-skeleton', RIM_LOWER)).toBe(false);
  });

  it('kanal bölümü kapalı kalıplarda dolu, ses deliği açık; CROS kanalı tıkamaz', () => {
    for (const s of ['full-shell', 'half-shell', 'skeleton', 'semi-skeleton', 'canal', 'canal-lock'] as const) {
      expect(inside(s, CANAL_WALL), `${s} kanal duvarı`).toBe(true);
      expect(inside(s, BORE), `${s} ses deliği`).toBe(false);
    }
    // CROS: kanal derinliğinde malzeme yok (kulak kanalı açık kalır)
    expect(inside('cros', CANAL_WALL)).toBe(false);
    expect(inside('cros', [2.4, 1.6, -8.4])).toBe(false);
  });

  it('boyut makul: iskelet ≈ 30–36 mm yüksek, kanal kalıbı ondan belirgin küçük', () => {
    const height = (s: (typeof MOLD_STYLES)[number]) => {
      const b = buildMoldGeometry(s, 64).boundingBox!;
      return (b.max.y - b.min.y) * UNIT_MM;
    };
    const skel = height('skeleton');
    expect(skel).toBeGreaterThan(28);
    expect(skel).toBeLessThan(38);
    expect(height('canal')).toBeLessThan(skel * 0.6);
  });
});
