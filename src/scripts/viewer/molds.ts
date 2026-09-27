/**
 * Kulak kalıbı biçimleri — YALNIZCA render için (dev sayfası `window.__ayazRenderMold`, betik
 * `scripts/render-mold-styles.mjs`). Sitede bu modül çalışmaz; yalnızca ürettiği PNG'ler kullanılır.
 *
 * Her biçim, işaretli uzaklık alanlarının (SDF) yumuşak birleşimidir: kanal, kanal girişi gövdesi,
 * konka çerçevesi, crus köprüsü, heliks kilidi kolu, konka plakası. Ses deliği ve vent çıkarılır.
 * Alan MarchingCubes ile tek parça, pürüzsüz bir yüzeye çevrilir (birleşim yerlerinde dikiş yok).
 * Temsilidir: gerçek kalıp kişinin kulak izinden üretilir.
 *
 * Birim: mm. Eksenler (sağ kulak kalıbı, yandan bakış): +x ön (yüz tarafı), +y yukarı, +z dışa (yanal).
 * Kanal girişi (aperture) orijinde; kanal −z yönünde içeri, hafif öne-yukarı kıvrılarak ilerler.
 * Ölçüler yetişkin kulak için tipik değerlerdir (konka boşluğu ≈ 18 × 16 mm, kanal ucu Ø ≈ 6 mm).
 */
import {
  ACESFilmicToneMapping,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { UNIT_MM } from './parts.ts';
import { collectPoints, fitView } from './scene.ts';

export type MoldStyle = 'full-shell' | 'half-shell' | 'skeleton' | 'semi-skeleton' | 'canal' | 'canal-lock' | 'cros' | 'micro';
export const MOLD_STYLES: readonly MoldStyle[] = ['full-shell', 'half-shell', 'skeleton', 'semi-skeleton', 'canal', 'canal-lock', 'cros', 'micro'];
export type MoldMaterial = 'acrylic-clear' | 'silicone' | 'acrylic-skin';

type P3 = [number, number, number];
/** Kontrol noktası + yarıçap (mm) */
type CP = [number, number, number, number];

/* ------------------------------------------------------------------ */
/* SDF yardımcıları                                                     */
/* ------------------------------------------------------------------ */

/** Polinom yumuşak birleşim (k: geçiş genişliği, mm) */
const smin = (a: number, b: number, k: number): number => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
/** Yumuşak çıkarma: a − b */
const ssub = (a: number, b: number, k: number): number => -smin(-a, b, k);

interface Seg {
  ax: number; ay: number; az: number;
  bx: number; by: number; bz: number;
  ra: number; rb: number; len2: number;
}
interface Chain {
  segs: Seg[];
  min: P3;
  max: P3;
}

/** Kontrol noktalarından (yarıçaplı) Catmull-Rom zinciri: kısa konik kapsüllerin birleşimi. */
function chain(cps: CP[], samples = 48): Chain {
  const curve = new CatmullRomCurve3(cps.map(([x, y, z]) => new Vector3(x, y, z)), false, 'centripetal');
  // Yarıçap: kontrol noktaları arasında doğrusal (eğri parametresine göre)
  const radiusAt = (u: number): number => {
    const f = u * (cps.length - 1);
    const i = Math.min(cps.length - 2, Math.floor(f));
    const t = f - i;
    return cps[i]![3] * (1 - t) + cps[i + 1]![3] * t;
  };
  const pts = curve.getPoints(samples);
  const segs: Seg[] = [];
  const min: P3 = [Infinity, Infinity, Infinity];
  const max: P3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const ra = radiusAt(i / samples);
    const rb = radiusAt((i + 1) / samples);
    const s: Seg = { ax: a.x, ay: a.y, az: a.z, bx: b.x, by: b.y, bz: b.z, ra, rb, len2: Math.max(1e-9, a.distanceToSquared(b)) };
    segs.push(s);
    const r = Math.max(ra, rb);
    min[0] = Math.min(min[0], a.x - r, b.x - r); max[0] = Math.max(max[0], a.x + r, b.x + r);
    min[1] = Math.min(min[1], a.y - r, b.y - r); max[1] = Math.max(max[1], a.y + r, b.y + r);
    min[2] = Math.min(min[2], a.z - r, b.z - r); max[2] = Math.max(max[2], a.z + r, b.z + r);
  }
  return { segs, min, max };
}

function chainDist(c: Chain, x: number, y: number, z: number, band: number): number {
  if (x < c.min[0] - band || x > c.max[0] + band || y < c.min[1] - band || y > c.max[1] + band || z < c.min[2] - band || z > c.max[2] + band) return band;
  let d = band;
  for (const s of c.segs) {
    const bax = s.bx - s.ax, bay = s.by - s.ay, baz = s.bz - s.az;
    const pax = x - s.ax, pay = y - s.ay, paz = z - s.az;
    let t = (pax * bax + pay * bay + paz * baz) / s.len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = pax - bax * t, dy = pay - bay * t, dz = paz - baz * t;
    const v = Math.sqrt(dx * dx + dy * dy + dz * dz) - (s.ra + (s.rb - s.ra) * t);
    if (v < d) d = v;
  }
  return d;
}

/** Elipsoit (yaklaşık SDF) */
function ellipsoid(x: number, y: number, z: number, c: P3, r: P3): number {
  const px = (x - c[0]) / r[0], py = (y - c[1]) / r[1], pz = (z - c[2]) / r[2];
  const k0 = Math.sqrt(px * px + py * py + pz * pz);
  const qx = (x - c[0]) / (r[0] * r[0]), qy = (y - c[1]) / (r[1] * r[1]), qz = (z - c[2]) / (r[2] * r[2]);
  const k1 = Math.sqrt(qx * qx + qy * qy + qz * qz);
  return k1 < 1e-9 ? -Math.min(r[0], r[1], r[2]) : (k0 * (k0 - 1)) / k1;
}

/** Kapalı 2B çokgen (xy) için işaretli uzaklık (içeride negatif). */
function polygon2d(poly: readonly [number, number][], x: number, y: number): number {
  let d = Infinity;
  let s = 1;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i++) {
    const [vix, viy] = poly[i]!;
    const [vjx, vjy] = poly[j]!;
    const ex = vjx - vix, ey = vjy - viy;
    const wx = x - vix, wy = y - viy;
    const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey)));
    const bx = wx - ex * t, by = wy - ey * t;
    d = Math.min(d, bx * bx + by * by);
    const c1 = y >= viy, c2 = y < vjy, c3 = ex * wy > ey * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
  }
  return s * Math.sqrt(d);
}

/** Kapalı düzgün dış hat: kontrol noktalarından kapalı Catmull-Rom örneklemesi */
function closedOutline(pts: [number, number][], samples = 96): [number, number][] {
  const curve = new CatmullRomCurve3(pts.map(([x, y]) => new Vector3(x, y, 0)), true, 'centripetal');
  return curve.getPoints(samples).slice(0, -1).map((p) => [p.x, p.y] as [number, number]);
}

/* ------------------------------------------------------------------ */
/* Anatomik yapı taşları (mm)                                           */
/* ------------------------------------------------------------------ */

/** Kanal omurgası: girişten (z≈+2) içeri ≈ 12 mm; ön-yukarı hafif kıvrım (ilk kıvrım). Ø ≈ 7,2 → 5,2 mm. */
const CANAL: CP[] = [
  [0.2, 0.0, 2.0, 3.6],
  [0.4, 0.3, -2.0, 3.45],
  [1.3, 0.9, -5.6, 3.15],
  [2.4, 1.6, -8.4, 2.85],
  [3.1, 2.2, -10.2, 2.6],
];
/** Konka çerçevesi (alt-ön): kanal girişinin altından (intertragik çentik) arkaya, antitragus boyunca */
const RIM_LOWER: CP[] = [
  [1.6, -3.2, 1.2, 2.2],
  [-1.2, -8.2, 1.4, 2.0],
  [-5.8, -11.4, 1.3, 1.95],
  [-10.8, -11.0, 1.0, 1.95],
  [-14.8, -7.6, 0.6, 1.95],
  [-16.4, -2.6, 0.3, 1.95],
];
/** Konka çerçevesi (arka-üst): antiheliks boyunca yukarı, cymba'ya */
const RIM_BACK: CP[] = [
  [-16.4, -2.6, 0.3, 1.95],
  [-16.0, 2.4, 0.2, 1.95],
  [-13.8, 6.2, 0.2, 1.95],
];
/** Heliks kilidi kolu: cymba'dan yukarı-öne, heliks kökünün altına kıvrılır; ucu incelir */
const HELIX: CP[] = [
  [-13.8, 6.2, 0.2, 1.95],
  [-12.2, 9.8, 0.0, 1.9],
  [-9.0, 13.2, -0.4, 1.8],
  [-4.8, 15.2, -0.8, 1.65],
  [-0.8, 15.4, -1.2, 1.45],
  [2.2, 13.8, -1.6, 1.25],
];
/** Crus köprüsü: kanal gövdesinin üstünden arkaya, çerçeveye (iskelet halkasını kapatır) */
const CRUS: CP[] = [
  [0.8, 3.6, 1.4, 2.0],
  [-3.6, 5.6, 1.2, 1.9],
  [-8.4, 6.6, 0.8, 1.9],
  [-13.8, 6.2, 0.2, 1.95],
];
/** Kilitli kanal kilidi: kanal girişinden konka tabanını geçip antitragusa (intertragik çentiğin üstü) dayanan kısa kuyruk */
const LOCK_ARM: CP[] = [
  [0.6, -2.6, 1.2, 2.1],
  [-3.2, -6.2, 1.2, 1.95],
  [-7.6, -8.2, 1.0, 1.75],
  [-10.8, -7.6, 0.8, 1.5],
];
/** Konka plakası dış hatları */
const FULL_OUTLINE = closedOutline([
  [3.0, 1.0], [2.4, -2.4], [1.2, -4.8], [-1.6, -8.8], [-6.0, -11.8], [-11.0, -11.3], [-15.2, -7.8], [-16.8, -2.6],
  [-16.3, 2.6], [-14.0, 6.6], [-11.6, 9.8], [-8.4, 12.2], [-5.0, 12.6], [-2.4, 10.6], [0.2, 7.4], [2.4, 4.0],
]);
const HALF_OUTLINE = closedOutline([
  [3.0, 1.0], [2.4, -2.4], [1.2, -4.8], [-1.6, -8.8], [-6.0, -11.8], [-11.0, -11.3], [-15.2, -7.8], [-16.4, -3.0],
  [-15.2, 1.2], [-11.0, 3.2], [-5.4, 4.4], [-0.6, 4.6], [2.2, 3.4],
]);

interface StyleSpec {
  /** Yanal düz yüz (faceplate): z ≤ değer olacak biçimde kesilir */
  faceZ?: number;
  chains: Chain[];
  /** Konka plakası: dış hat, yarım kalınlık, kenar yuvarlatması */
  plate?: { outline: [number, number][]; h: number; round: number };
  ellipsoids: { c: P3; r: P3 }[];
  /** Çıkarılan kanallar: ses deliği, vent */
  holes: Chain[];
  /** Yanal yüzde hafif çukur (konka çanağı) */
  dish?: { c: P3; r: P3 };
  k: number;
}

const BORE_R = 0.97; // #13 hortum iç çapı ≈ 1,93 mm
/** Ses deliği: kanal ucundan yanal yüze (hortum girişi) */
function bore(canal: CP[], exitZ = 4.6, r = BORE_R): Chain {
  const tip = canal[canal.length - 1]!;
  const pts: CP[] = [
    [tip[0] + 0.4, tip[1] + 0.25, tip[2] - 1.2, r],
    ...canal.slice(1).reverse().map(([x, y, z]) => [x, y + 0.2, z, r] as CP),
    [0.4, 1.1, 1.6, r],
    [0.6, 1.8, exitZ, r],
  ];
  return chain(pts, 40);
}
/** Vent: ses deliğine paralel ince kanal (ön-üst tarafta, kanal duvarının içinde kalır) */
function vent(canal: CP[], r = 0.5): Chain {
  const tip = canal[canal.length - 1]!;
  const pts: CP[] = [
    [tip[0] + 1.0, tip[1] + 0.9, tip[2] - 1.2, r],
    ...canal.slice(1).reverse().map(([x, y, z]) => [x + 0.9, y + 1.25, z, r] as CP),
    [1.4, 2.6, 4.8, r],
  ];
  return chain(pts, 40);
}

/** Kanal girişi gövdesi (tragus arkası dolgu): basık, yumuşak geçişli */
const BASE = { c: [0.0, 0.0, 1.2] as P3, r: [4.4, 4.8, 2.3] as P3 };

function specFor(style: MoldStyle): StyleSpec {
  switch (style) {
    case 'full-shell':
      return {
        chains: [chain(CANAL), chain(HELIX)],
        plate: { outline: FULL_OUTLINE, h: 2.5, round: 1.7 },
        ellipsoids: [BASE],
        holes: [bore(CANAL), vent(CANAL)],
        dish: { c: [-7.0, -1.5, 5.4], r: [7.2, 7.6, 3.0] },
        k: 1.8,
      };
    case 'half-shell':
      return {
        chains: [chain(CANAL)],
        plate: { outline: HALF_OUTLINE, h: 2.4, round: 1.7 },
        ellipsoids: [BASE],
        holes: [bore(CANAL), vent(CANAL)],
        dish: { c: [-7.0, -3.6, 5.2], r: [6.6, 5.2, 2.8] },
        k: 1.8,
      };
    case 'skeleton':
      return {
        chains: [chain(CANAL), chain(RIM_LOWER), chain(RIM_BACK, 16), chain(CRUS), chain(HELIX)],
        ellipsoids: [BASE],
        holes: [bore(CANAL)],
        k: 1.6,
      };
    case 'semi-skeleton':
      return {
        chains: [chain(CANAL), chain([[-15.6, -5.2, 0.4, 1.6], ...RIM_BACK.slice(0)] as CP[], 20), chain(CRUS), chain(HELIX)],
        ellipsoids: [BASE],
        holes: [bore(CANAL)],
        k: 1.6,
      };
    case 'canal':
      // Yalnız kanal + kanal girişini dolduran küçük gövde (konkaya taşmaz)
      return {
        chains: [chain(CANAL), chain([[0.6, -1.2, 1.6, 2.6], [-1.8, -3.6, 1.8, 2.2], [-3.4, -4.4, 1.6, 1.7]], 12)],
        ellipsoids: [{ c: [-0.4, -0.6, 1.3], r: [4.2, 4.6, 2.4] }],
        holes: [bore(CANAL, 4.0), vent(CANAL)],
        k: 2.0,
      };
    case 'canal-lock':
      return {
        chains: [chain(CANAL), chain(LOCK_ARM)],
        ellipsoids: [BASE],
        holes: [bore(CANAL)],
        k: 1.6,
      };
    case 'cros': {
      // Açık kalıp: kanalı tıkamaz; çerçeve + heliks kilidi + kısa, geniş delikli hortum tutucu
      const stub: CP[] = [
        [0.4, 0.6, 2.4, 2.5],
        [0.8, 0.9, -1.2, 2.4],
        [1.6, 1.4, -3.6, 2.2],
      ];
      const stubHole: CP[] = [
        [1.9, 1.6, -5.0, 1.45],
        [0.8, 0.9, -1.2, 1.45],
        [0.3, 0.5, 4.2, 1.45],
      ];
      return {
        chains: [chain(stub, 16), chain(RIM_LOWER), chain(RIM_BACK, 16), chain(CRUS), chain(HELIX)],
        ellipsoids: [{ c: [0.4, 0.4, 1.4], r: [3.4, 3.6, 2.2] }],
        holes: [chain(stubHole, 16)],
        k: 1.5,
      };
    }
    case 'micro': {
      // Kanal içi (mikro) kalıp: tamamen kanalda durur, konkaya taşmaz; çoğunlukla RIC alıcısını tutar (ten rengi akrilik)
      const canal: CP[] = [
        [0.2, 0.0, 2.0, 3.7],
        [0.5, 0.3, -1.8, 3.5],
        [1.4, 0.9, -5.2, 3.1],
        [2.4, 1.6, -8.0, 2.75],
      ];
      return {
        chains: [chain(canal)],
        ellipsoids: [{ c: [0.1, 0.0, 1.2], r: [3.9, 4.3, 1.8] }],
        holes: [bore(canal, 5.0, 0.8)],
        faceZ: 2.4,
        k: 1.8,
      };
    }
  }
}

/* ------------------------------------------------------------------ */
/* Alan → yüzey                                                         */
/* ------------------------------------------------------------------ */

const BAND = 3.0;

/** Biçimin SDF'si (mm). Test ve alan üretimi için dışa açık. */
export function moldSdf(style: MoldStyle): (x: number, y: number, z: number) => number {
  const s = specFor(style);
  const plate = s.plate;
  return (x, y, z) => {
    let d = BAND;
    if (plate) {
      const d2 = polygon2d(plate.outline, x, y);
      // Plaka hafif kavisli (konka çanağını izler): kenarlar yana doğru açılır
      const zc = 0.4 + 0.0065 * ((x + 7) * (x + 7) + (y + 1) * (y + 1));
      const R = plate.round;
      const wx = d2 + R;
      const wy = Math.abs(z - zc) - (plate.h - R);
      d = Math.min(Math.max(wx, wy), 0) + Math.hypot(Math.max(wx, 0), Math.max(wy, 0)) - R;
    }
    for (const e of s.ellipsoids) d = smin(d, ellipsoid(x, y, z, e.c, e.r), s.k);
    for (const c of s.chains) d = smin(d, chainDist(c, x, y, z, BAND), s.k);
    if (s.dish) d = ssub(d, ellipsoid(x, y, z, s.dish.c, s.dish.r), 1.2);
    // Yumuşak kesişim: z ≤ faceZ yarı uzayı (SDF = z − faceZ)
    if (s.faceZ !== undefined) d = -smin(-d, s.faceZ - z, 0.9);
    for (const h of s.holes) d = ssub(d, chainDist(h, x, y, z, BAND), 0.5);
    return d;
  };
}

/** Alan sınırları (mm): tüm biçimleri kapsayan küp */
const DOMAIN_C: P3 = [-6.5, 1.8, -4.6];
const DOMAIN_S = 40;

const geoCache = new Map<string, BufferGeometry>();

/** Biçimin yüzeyi (sahne birimi, 1 = UNIT_MM mm). `res`: ızgara çözünürlüğü (hücre ≈ 40/res mm). */
export function buildMoldGeometry(style: MoldStyle, res = 150): BufferGeometry {
  const key = `${style}@${res}`;
  const hit = geoCache.get(key);
  if (hit) return hit;
  const sdf = moldSdf(style);
  const mc = new MarchingCubes(res, new MeshPhysicalMaterial(), false, false, 900_000);
  mc.isolation = 0;
  const half = mc.halfsize as number;
  const f = mc.field as Float32Array;
  const scale = DOMAIN_S / 2;
  for (let k = 0; k < res; k++) {
    const z = DOMAIN_C[2] + ((k - half) / half) * scale;
    for (let j = 0; j < res; j++) {
      const y = DOMAIN_C[1] + ((j - half) / half) * scale;
      const row = k * res * res + j * res;
      for (let i = 0; i < res; i++) {
        const x = DOMAIN_C[0] + ((i - half) / half) * scale;
        const d = sdf(x, y, z);
        f[row + i] = -(d > BAND ? BAND : d < -BAND ? -BAND : d);
      }
    }
  }
  mc.update();
  const n = (mc.count as number) * 3;
  const pos = (mc.positionArray as Float32Array).slice(0, n);
  const nor = (mc.normalArray as Float32Array).slice(0, n);
  const s = scale / UNIT_MM;
  for (let i = 0; i < n; i += 3) {
    pos[i] = (pos[i]! * scale + DOMAIN_C[0]) / UNIT_MM;
    pos[i + 1] = (pos[i + 1]! * scale + DOMAIN_C[1]) / UNIT_MM;
    pos[i + 2] = (pos[i + 2]! * scale + DOMAIN_C[2]) / UNIT_MM;
    const l = Math.hypot(nor[i]!, nor[i + 1]!, nor[i + 2]!) || 1;
    nor[i] = nor[i]! / l;
    nor[i + 1] = nor[i + 1]! / l;
    nor[i + 2] = nor[i + 2]! / l;
  }
  void s;
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  mc.geometry.dispose();
  geoCache.set(key, geo);
  return geo;
}

/* ------------------------------------------------------------------ */
/* Malzemeler ve render                                                 */
/* ------------------------------------------------------------------ */

export function moldMaterial(kind: MoldMaterial): MeshPhysicalMaterial {
  switch (kind) {
    case 'acrylic-clear':
      // Şeffaf sert akrilik: yüksek geçirgenlik, akrilik kırılma indisi, çok parlak yüzey
      return new MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.05,
        metalness: 0,
        transmission: 1,
        thickness: 0.45,
        ior: 1.49,
        attenuationColor: new Color(0xd2dde3),
        attenuationDistance: 0.75,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        specularIntensity: 1,
        dispersion: 0.25,
        side: DoubleSide,
      });
    case 'silicone':
      // Yumuşak silikon: mat, yarı saydam, açık pembe
      return new MeshPhysicalMaterial({
        color: 0xf3c7bd,
        roughness: 0.42,
        metalness: 0,
        transmission: 0.45,
        thickness: 0.5,
        ior: 1.41,
        attenuationColor: new Color(0xe79d8f),
        attenuationDistance: 0.5,
        sheen: 0.3,
        sheenColor: new Color(0xffe4dc),
        sheenRoughness: 0.6,
        side: DoubleSide,
      });
    case 'acrylic-skin':
      return new MeshPhysicalMaterial({
        color: 0xe9ad98,
        roughness: 0.2,
        metalness: 0,
        clearcoat: 0.85,
        clearcoatRoughness: 0.1,
        transmission: 0.25,
        thickness: 0.5,
        ior: 1.49,
        attenuationColor: new Color(0xd9806a),
        attenuationDistance: 0.4,
        side: DoubleSide,
      });
  }
}

export interface MoldRenderOptions {
  width?: number;
  height?: number;
  /** Modelden kameraya yön (mm eksenleri) */
  dir?: [number, number, number];
  fovDeg?: number;
  /** Silüetin kadrajı doldurma oranı (verilmezse sabit ölçek: `viewMm`) */
  fit?: number;
  /** Sabit ölçek: kadraj yüksekliğinin model merkez düzlemindeki karşılığı (mm). Tüm biçimler aynı ölçekte → gerçek boy farkı görünür. */
  viewMm?: number;
  res?: number;
  material?: MoldMaterial;
  background?: string;
}

export interface MoldRenderResult {
  style: MoldStyle;
  dataUrl: string;
  width: number;
  height: number;
  triangles: number;
  ms: number;
}

/** Varsayılan bakış: yanal-ön-üstten (kanal sağa doğru görünür), katalog fotoğrafı gibi */
export const MOLD_DIR: [number, number, number] = [0.62, 0.34, 1];

interface Ctx {
  canvas: HTMLCanvasElement;
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  key: DirectionalLight;
  fill: DirectionalLight;
}
let ctx: Ctx | null = null;

function context(): Ctx {
  if (ctx) return ctx;
  const canvas = document.createElement('canvas');
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: false });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setPixelRatio(1);
  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const env = new RoomEnvironment();
  scene.environment = pmrem.fromScene(env, 0.03).texture;
  scene.environmentIntensity = 1.0;
  env.dispose();
  pmrem.dispose();
  const key = new DirectionalLight(0xffffff, 1.4);
  const fill = new DirectionalLight(0xffffff, 0.5);
  scene.add(key, key.target, fill, fill.target);
  const camera = new PerspectiveCamera(20, 1, 0.1, 100);
  ctx = { canvas, renderer, scene, camera, key, fill };
  return ctx;
}

/** Tek bir kalıp biçimini beyaz zeminde çizer (PNG data URL). */
export function renderMoldStyle(style: MoldStyle, opts: MoldRenderOptions = {}): MoldRenderResult {
  const t0 = performance.now();
  const width = Math.round(opts.width ?? 900);
  const height = Math.round(opts.height ?? 700);
  const fov = opts.fovDeg ?? 20;
  const { renderer, scene, camera, key, fill, canvas } = context();
  scene.background = new Color(opts.background ?? '#ffffff');
  const root = new Group();
  const geo = buildMoldGeometry(style, opts.res ?? 150);
  const mat = moldMaterial(opts.material ?? (style === 'micro' ? 'acrylic-skin' : 'acrylic-clear'));
  root.add(new Mesh(geo, mat));
  if (style === 'micro') {
    // Alıcı kablosu (dış yüzün üstünden yukarı-arkaya, kulak arkasındaki gövdeye) + çıkarma ipi (aşağı, uçta boncuk)
    const mm = (pts: number[][]) => pts.map(([x, y, z]) => new Vector3(x! / UNIT_MM, y! / UNIT_MM, z! / UNIT_MM));
    const cable = new MeshPhysicalMaterial({ color: 0xd9dcdf, roughness: 0.35, clearcoat: 0.4 });
    const line = new MeshPhysicalMaterial({ color: 0xf2f2f0, roughness: 0.3, transmission: 0.3, thickness: 0.02 });
    const wire = new CatmullRomCurve3(mm([[0.4, 1.4, 2.2], [0.3, 3.6, 4.2], [-1.6, 8.0, 5.6], [-5.4, 12.6, 5.4], [-9.6, 15.2, 4.6]]));
    const pull = new CatmullRomCurve3(mm([[-0.6, -2.0, 2.2], [-1.0, -3.8, 3.6], [-1.6, -6.4, 4.4], [-2.0, -8.6, 4.6]]));
    root.add(new Mesh(new TubeGeometry(wire, 64, 0.42 / UNIT_MM, 12, false), cable));
    root.add(new Mesh(new TubeGeometry(pull, 32, 0.22 / UNIT_MM, 8, false), line));
    const bead = new Mesh(new SphereGeometry(0.75 / UNIT_MM, 16, 12), line);
    bead.position.copy(pull.getPoint(1));
    root.add(bead);
  }
  scene.add(root);

  const box = geo.boundingBox!;
  const center = box.getCenter(new Vector3());
  const dir = new Vector3(...(opts.dir ?? MOLD_DIR)).normalize();
  const fit = opts.fit
    ? fitView(collectPoints(root), dir, center, fov, width / height, opts.fit)
    : { target: center, distance: (opts.viewMm ?? 46) / UNIT_MM / (2 * Math.tan((fov * Math.PI) / 360)) };
  camera.fov = fov;
  camera.aspect = width / height;
  camera.position.copy(fit.target).addScaledVector(dir, fit.distance);
  camera.near = Math.max(0.05, fit.distance - 8);
  camera.far = fit.distance + 8;
  camera.lookAt(fit.target);
  camera.updateProjectionMatrix();
  // Işıklar kameraya göre: ana ışık sol-üst-önden, dolgu sağdan
  key.position.copy(fit.target).add(new Vector3(-0.5, 1.2, 0.8).normalize().multiplyScalar(10));
  key.target.position.copy(fit.target);
  fill.position.copy(fit.target).add(new Vector3(1, 0.2, 0.4).normalize().multiplyScalar(10));
  fill.target.position.copy(fit.target);

  renderer.setSize(width, height, false);
  renderer.render(scene, camera);
  const dataUrl = canvas.toDataURL('image/png');
  scene.remove(root);
  mat.dispose();
  const triangles = (geo.getAttribute('position').count / 3) | 0;
  return { style, dataUrl, width, height, triangles, ms: Math.round(performance.now() - t0) };
}
