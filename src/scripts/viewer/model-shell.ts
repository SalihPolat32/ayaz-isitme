/**
 * Kulak içi kabuk modelleri: etkileşimli CIC (10 pil) ve yalnızca render için ITE / ITC / IIC.
 * Hepsi aynı parametrik üreticiden (`buildShellDevice`) çıkar; parça kimlikleri `PART_IDS.cic`.
 *
 * Eksenler (model uzayı): +Z lateral (faceplate, dışarı bakan), −Z medial (kanal ucu),
 * +Y yukarı, +X öne (yüze doğru). Faceplate dıştan bakıldığında (kamera +Z): sağ = ön.
 *
 * Kabuk: faceplate'ten başlayıp kanal ucuna giden kıvrık omurga boyunca loft; her istasyonda kesit,
 * faceplate dış hattı (yuvarlak üçgen / böbrek, heliks kilidi çıkıntısı) ile eliptik kanal kesiti
 * arasında yumuşak geçiştir (fasulye biçimi, düz koni değil). Faceplate hattı kabuğun ilk kesitiyle
 * aynıdır (hizalı kenar).
 *
 * Pil kapağı: faceplate üzerinde YUVARLAK KÖŞELİ DİKDÖRTGEN kapak; menteşe bir kısa kenarda
 * (pim ekseni kapağın kısa ekseni boyunca), serbest kenar 88° dışarı (+Z) açılır, serbest kenarda
 * tırnak çentiği. Kapak deliğinin çevresinde her yerde düz faceplate bandı kalır (`plateClearance`). Pil gerçek kulak içi cihazlardaki gibi kapağın altında DİK (yuvarlak yüzü kapağın
 * uzun ekseni ve Z ile aynı düzlemde) durur; kapakla birlikte kendi düzleminde döner ve yuvadan çıkar.
 */
import {
  BackSide,
  type BufferGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Matrix4,
  Path,
  Quaternion,
  Shape,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildLoft, loftFrame, loftPoint, type LoftSpec } from './loft.ts';
import { makeMaterial } from './materials.ts';
import { addBattery, addMesh, BATTERY_SPEC, type BatterySize, createModelDraft, finalizeModel, localizeTo, smoothstep } from './parts.ts';
import { type DeviceModel, PART_IDS } from './types.ts';

const Y_AXIS = new Vector3(0, 1, 0);
const Z_AXIS = new Vector3(0, 0, 1);
const quatFromTo = (from: Vector3, to: Vector3): Quaternion => new Quaternion().setFromUnitVectors(from, to.clone().normalize());
const basisQuat = (x: Vector3, y: Vector3, z: Vector3): Quaternion => new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));

/** Açısal Gauss (sarılı). */
const lobe = (theta: number, c: number, w: number): number => {
  let d = (theta - c) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return Math.exp(-(d / w) * (d / w));
};
/** Döndürülmüş (süper)elipsin θ yönündeki yarıçapı (p = 2: elips; p > 2: dolgun köşeler). */
const ellipseR = (theta: number, a: number, b: number, rot: number, p = 2): number => {
  const t = theta - rot;
  return Math.pow(Math.abs(Math.cos(t) / a) ** p + Math.abs(Math.sin(t) / b) ** p, -1 / p);
};

interface Lobe {
  amp: number;
  /** Açı (rad, faceplate görünüşünde: 0 = +X ön, π/2 = üst). */
  at: number;
  width: number;
  /** Bu `u` değerine kadar söner (heliks kilidi gibi sığ çıkıntılar için). Varsayılan: kesit geçişiyle birlikte. */
  fade?: number;
}

export interface ShellSpec {
  battery: BatterySize;
  /** Faceplate dış hattı (XY, birim): yarı eksenler a (X), b (Y), dönüş ve açısal çıkıntılar. */
  face: { a: number; b: number; rot: number; p: number; lobes: Lobe[] };
  /** Kanal kesiti yarı eksenleri: başlangıç (a0, b0) → uç (a1, b1), ve kesit burulması (rad). */
  canal: { a0: number; b0: number; a1: number; b1: number; rot: number; twist: number };
  /** Omurga (ilk nokta faceplate merkezi, z = 0). */
  spine: Vector3[];
  /** Faceplate hattından kanal kesitine geçiş aralığı (u). */
  blend: [number, number];
  /**
   * Geçiş profilinin dışbükeyliği: w = 1 − (1 − s^q)^(1/q). q = 1 doğrusal (koni), q ≈ 1.7 mermi/fasulye
   * (boyun / içbükey bel oluşmaz). `fillet: true` → w = smoothstep(s^q): kubbe biçimli konka kısmı kanala
   * yumuşak bir dolguyla bağlanır (ITE).
   */
  profileQ: number;
  fillet?: boolean;
  /** Faceplate'in hemen altında hafif şişkinlik (fasulye). */
  bulge: number;
  tipCap: { length: number; power: number };
  shellColor: number;
  plateColor: number;
  /** Kapak rengi (verilmezse faceplate rengi). */
  doorColor?: number;
  /** Yarı saydam akrilik mi (ten tonları) yoksa opak mı (koyu IIC)? */
  translucent: boolean;
  door: {
    cx: number;
    cy: number;
    /** Uzun eksenin açısı (rad). */
    rot: number;
    len: number;
    wid: number;
    corner: number;
    /** Menteşe uzun eksenin − ucunda mı (true) yoksa + ucunda mı? */
    hingeAtStart: boolean;
    angle: number;
    /**
     * Pil merkezinin menteşeden serbest uca uzaklığı (birim). Verilmezse delik boyuna göre izin verilen en büyük
     * değer; `'center'` = kapağın ortası (yalnızca kapağı hiç açılmayan render türevleri için).
     */
    batteryF?: number | 'center';
  };
  /** Faceplate altındaki görünen koyu cebin derinliği (birim). */
  pocketDepth: number;
  mics: [number, number][];
  /** Mikrofon portu halka yarıçapı (birim). */
  micR: number;
  vent: [number, number];
  /** Çıkarma ipi: taban konumu, uç topuzu ve taban göbeği yarıçapı (birim; varsayılan 0.05). */
  cord?: { at: [number, number]; end: Vector3; baseR?: number };
  /** Ses ayar tekerleği: faceplate'e yatık, tırtıllı kenarlı disk (ekseni faceplate'e dik). */
  wheel?: { at: [number, number]; r: number };
  homeDir: Vector3;
  explode: { faceplate: number; door: number; battery: number; features: number; outlet: number };
}

export type ShellKind = 'cic' | 'ite' | 'itc' | 'iic';

/** Kapak ile faceplate deliği arasındaki çevresel aralık (birim, kenar başına; 0.12 mm). */
const HOLE_GAP = 0.012;
/**
 * Faceplate dış kenar pahı (birim). ExtrudeGeometry pahı üst yüzde dış hattı içeri, deliği dışarı bu kadar
 * kaydırır; kapak deliği ile dış hat arasındaki en dar bant bunun iki katından geniş olmalı (aksi halde üst
 * yüz üçgenleri ters döner ve deliğin bir kısmını kapatır — `plateClearance`, tests/viewer-door.test.ts).
 */
const PLATE_BEVEL_SIZE = 0.02;

/** Ana bakış: ön-üst-dış 3/4 — faceplate ve kanala doğru incelen kabuk birlikte görünür. */
const SHELL_HOME = new Vector3(0.62, 0.3, 0.72);

/**
 * Tür başına tanımlar (1 birim = 10 mm). Boyutlar faceplate (Y × X) ve faceplate→uç uzunluğu:
 * CIC 9 × 7.5 mm, ≈ 11.5 mm · ITC 12.5 × 11 mm, ≈ 14 mm · ITE 17 × 15.5 mm (heliks kilidi dahil ≈ 19 mm), ≈ 16 mm ·
 * IIC 7.2 × 5.8 mm, ≈ 10 mm.
 */
export const SHELL_VARIANTS: Record<ShellKind, ShellSpec> = {
  cic: {
    battery: '10',
    face: {
      a: 0.375,
      b: 0.45,
      rot: -0.12,
      p: 2.35,
      lobes: [
        { amp: 0.05, at: 1.75, width: 0.7 },
        { amp: 0.045, at: -2.4, width: 0.7 },
        { amp: 0.045, at: -0.55, width: 0.7 },
      ],
    },
    canal: { a0: 0.24, b0: 0.27, a1: 0.205, b1: 0.232, rot: 0.25, twist: 0.35 },
    spine: [new Vector3(0, 0, 0), new Vector3(0, 0, -0.32), new Vector3(0.04, -0.03, -0.68), new Vector3(0.15, -0.08, -1.04)],
    blend: [0.0, 1.0],
    profileQ: 1.75,
    bulge: 0.03,
    tipCap: { length: 0.16, power: 2.2 },
    shellColor: 0xb27d5b,
    plateColor: 0x946446,
    translucent: true,
    door: { cx: -0.025, cy: -0.01, rot: Math.PI / 2 - 0.02, len: 0.72, wid: 0.41, corner: 0.1, hingeAtStart: false, angle: (88 * Math.PI) / 180, batteryF: 0.214 },
    pocketDepth: 0.24,
    mics: [[0.26, 0.225]],
    micR: 0.042,
    vent: [0.26, -0.05],
    cord: { at: [0.25, -0.28], end: new Vector3(0.34, -0.61, 0.42), baseR: 0.045 },
    homeDir: SHELL_HOME,
    explode: { faceplate: 0.45, door: 1.5, battery: -0.35, features: 0.75, outlet: 0.45 },
  },
  itc: {
    battery: '312',
    face: {
      a: 0.54,
      b: 0.63,
      rot: -0.2,
      p: 2.25,
      lobes: [
        { amp: 0.06, at: 1.95, width: 0.6 },
        { amp: 0.05, at: -2.3, width: 0.7 },
        { amp: 0.05, at: -0.45, width: 0.7 },
      ],
    },
    canal: { a0: 0.33, b0: 0.37, a1: 0.285, b1: 0.325, rot: 0.3, twist: 0.35 },
    spine: [new Vector3(0, 0, 0), new Vector3(0, 0, -0.36), new Vector3(0.1, -0.09, -0.8), new Vector3(0.3, -0.17, -1.26)],
    blend: [0.0, 1.0],
    profileQ: 1.75,
    bulge: 0.03,
    tipCap: { length: 0.14, power: 2.2 },
    shellColor: 0xc59772,
    plateColor: 0xae8260,
    translucent: true,
    door: { cx: -0.06, cy: 0.02, rot: Math.PI / 2 - 0.08, len: 0.86, wid: 0.45, corner: 0.15, hingeAtStart: false, angle: (88 * Math.PI) / 180, batteryF: 'center' },
    pocketDepth: 0.3,
    mics: [[0.31, 0.3]],
    micR: 0.046,
    vent: [0.33, -0.22],
    homeDir: SHELL_HOME,
    explode: { faceplate: 0.5, door: 1.7, battery: -0.4, features: 0.85, outlet: 0.5 },
  },
  ite: {
    battery: '13',
    face: {
      a: 0.74,
      b: 0.76,
      rot: 0.3,
      p: 2.1,
      lobes: [
        { amp: 0.36, at: 2.0, width: 0.3, fade: 0.55 },
        { amp: -0.1, at: -0.15, width: 0.45 },
        { amp: 0.07, at: -1.9, width: 0.6 },
        { amp: 0.05, at: 0.9, width: 0.5 },
      ],
    },
    canal: { a0: 0.37, b0: 0.4, a1: 0.29, b1: 0.32, rot: 0.35, twist: 0.3 },
    spine: [new Vector3(0, 0, 0), new Vector3(0, 0, -0.36), new Vector3(0.2, -0.13, -0.86), new Vector3(0.46, -0.22, -1.48)],
    blend: [0.0, 0.66],
    profileQ: 1.7,
    fillet: true,
    bulge: 0.03,
    tipCap: { length: 0.12, power: 2.2 },
    shellColor: 0xdba386,
    plateColor: 0xc88e70,
    translucent: true,
    door: { cx: 0.04, cy: -0.13, rot: 0.08, len: 0.88, wid: 0.64, corner: 0.18, hingeAtStart: true, angle: (88 * Math.PI) / 180, batteryF: 'center' },
    pocketDepth: 0.34,
    mics: [
      [-0.42, 0.33],
      [-0.22, 0.44],
    ],
    micR: 0.05,
    vent: [0.1, -0.56],
    wheel: { at: [0.36, 0.43], r: 0.18 },
    homeDir: SHELL_HOME,
    explode: { faceplate: 0.55, door: 1.9, battery: -0.5, features: 0.95, outlet: 0.55 },
  },
  iic: {
    battery: '10',
    face: {
      a: 0.3,
      b: 0.375,
      rot: -0.08,
      p: 2.6,
      lobes: [
        { amp: 0.03, at: 1.7, width: 0.7 },
        { amp: 0.03, at: -2.4, width: 0.7 },
        { amp: 0.03, at: -0.6, width: 0.7 },
      ],
    },
    canal: { a0: 0.23, b0: 0.26, a1: 0.19, b1: 0.215, rot: 0.2, twist: 0.3 },
    spine: [new Vector3(0, 0, 0), new Vector3(0, 0, -0.3), new Vector3(0.03, -0.02, -0.64), new Vector3(0.11, -0.06, -0.96)],
    blend: [0.0, 1.0],
    profileQ: 1.85,
    bulge: 0.03,
    tipCap: { length: 0.17, power: 2.2 },
    shellColor: 0x3a3e44,
    plateColor: 0x1c1e21,
    doorColor: 0x25282c,
    translucent: false,
    door: { cx: -0.03, cy: 0.01, rot: Math.PI / 2 - 0.12, len: 0.58, wid: 0.36, corner: 0.14, hingeAtStart: false, angle: (88 * Math.PI) / 180, batteryF: 'center' },
    pocketDepth: 0.2,
    mics: [[0.215, 0.235]],
    micR: 0.032,
    vent: [0.225, -0.08],
    cord: { at: [0.165, -0.27], end: new Vector3(0.24, -0.58, 0.44), baseR: 0.04 },
    homeDir: SHELL_HOME,
    explode: { faceplate: 0.4, door: 1.4, battery: -0.33, features: 0.7, outlet: 0.4 },
  },
};

/** Yuvarlak köşeli dikdörtgenin yerel (x uzun, y kısa) dış hattı; `n` köşe başına örnek. */
function roundedRectPoints(len: number, wid: number, r: number, n = 8): Vector2[] {
  const pts: Vector2[] = [];
  const hx = len / 2 - r;
  const hy = wid / 2 - r;
  const corners: [number, number, number][] = [
    [hx, -hy, -Math.PI / 2],
    [hx, hy, 0],
    [-hx, hy, Math.PI / 2],
    [-hx, -hy, Math.PI],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (Math.PI / 2) * (i / n);
      pts.push(new Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a)));
    }
  }
  return pts;
}

/** Faceplate dış hattı (z = 0 kesiti; kabuğun ilk istasyonu ile aynı) θ yönünde. */
function faceOutlineXY(S: ShellSpec, th: number): [number, number] {
  let k = 1;
  for (const l of S.face.lobes) k += l.amp * lobe(th, l.at, l.width);
  const r = ellipseR(th, S.face.a, S.face.b, S.face.rot, S.face.p) * k;
  return [r * Math.cos(th), r * Math.sin(th)];
}

/** Kapak deliğinin faceplate XY'sindeki dış hattı (kapak + `HOLE_GAP`). */
function doorHoleXY(S: ShellSpec, n = 8): Vector2[] {
  const D = S.door;
  const c = Math.cos(D.rot);
  const s = Math.sin(D.rot);
  return roundedRectPoints(D.len + 2 * HOLE_GAP, D.wid + 2 * HOLE_GAP, D.corner + HOLE_GAP, n).map((p) => new Vector2(D.cx + c * p.x - s * p.y, D.cy + s * p.x + c * p.y));
}

const segmentDistance = (p: Vector2, a: Vector2, b: Vector2): number => {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby || 1)));
  return Math.hypot(a.x + abx * t - p.x, a.y + aby * t - p.y);
};

/**
 * Kapak deliği çevresindeki faceplate bandı (birim): `outline` = delik ile dış hat arasındaki en dar mesafe
 * (üst yüzde görünen düz bant ≈ `outline − 2·PLATE_BEVEL_SIZE`), `features` = delik ile mikrofon / vent / ip
 * tabanı / tekerlek kenarı arasındaki en dar mesafe (negatif = çakışma), `featuresEdge` = aynı parçaların dış
 * hatta en dar mesafesi. `minOutline` üst yüz üçgenlerinin ters dönmediği alt sınırdır.
 */
export function plateClearance(S: ShellSpec): { outline: number; features: number; featuresEdge: number; minOutline: number } {
  const hole = doorHoleXY(S, 16);
  // Deliğin düz kenarlarını da örnekle (köşe yayları arasındaki doğrular)
  const pts: Vector2[] = [];
  for (let i = 0; i < hole.length; i++) {
    const a = hole[i]!;
    const b = hole[(i + 1) % hole.length]!;
    for (let k = 0; k < 6; k++) pts.push(a.clone().lerp(b, k / 6));
  }
  const N = 720;
  const out: Vector2[] = [];
  for (let i = 0; i < N; i++) {
    const [x, y] = faceOutlineXY(S, (2 * Math.PI * i) / N);
    out.push(new Vector2(x, y));
  }
  let outline = Infinity;
  for (const p of pts) for (let i = 0; i < N; i++) outline = Math.min(outline, segmentDistance(p, out[i]!, out[(i + 1) % N]!));
  const circles: [number, number, number][] = [
    ...S.mics.map(([x, y]): [number, number, number] => [x, y, S.micR * 1.08]),
    [S.vent[0], S.vent[1], 0.05],
    ...(S.cord ? [[S.cord.at[0], S.cord.at[1], S.cord.baseR ?? 0.05] as [number, number, number]] : []),
    ...(S.wheel ? [[S.wheel.at[0], S.wheel.at[1], S.wheel.r + 0.02] as [number, number, number]] : []),
  ];
  let features = Infinity;
  let featuresEdge = Infinity;
  for (const [x, y, r] of circles) {
    // Merkez deliğin içindeyse (çift-tek kuralı) çakışma: negatif
    let inside = false;
    for (let i = 0, j = hole.length - 1; i < hole.length; j = i++) {
      const a = hole[i]!;
      const b = hole[j]!;
      if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    let d = Infinity;
    for (let i = 0; i < pts.length; i++) d = Math.min(d, segmentDistance(new Vector2(x, y), pts[i]!, pts[(i + 1) % pts.length]!));
    features = Math.min(features, inside ? -d - r : d - r);
    let e = Infinity;
    for (let i = 0; i < N; i++) e = Math.min(e, segmentDistance(new Vector2(x, y), out[i]!, out[(i + 1) % N]!));
    featuresEdge = Math.min(featuresEdge, e - r);
  }
  return { outline, features, featuresEdge, minOutline: 2 * PLATE_BEVEL_SIZE };
}

/**
 * Pahlı ExtrudeGeometry için yumuşak normaller: `toCreasedNormals` ilk pah halkasını düz kapak yüzüyle ortaladığından
 * kapak kenarındaki normaller eğilir ve kapağın uzun ince üçgenleri boyunca çapraz gölge kamaları oluşur. Çeyrek
 * yuvarlak pah kapak düzlemine teğettir → kapak düzlemindeki (z = zMin / zMax) tüm köşelerin normali tam ±Z.
 */
function smoothBevelNormals(geo: BufferGeometry, crease = 0.7): BufferGeometry {
  const g = toCreasedNormals(geo, crease);
  g.computeBoundingBox();
  const { min, max } = g.boundingBox!;
  const pos = g.getAttribute('position');
  const nrm = g.getAttribute('normal');
  const eps = 1e-6;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    if (Math.abs(z - max.z) < eps) nrm.setXYZ(i, 0, 0, 1);
    else if (Math.abs(z - min.z) < eps) nrm.setXYZ(i, 0, 0, -1);
  }
  nrm.needsUpdate = true;
  return g;
}

/** Tırtıllı tekerlek dış hattı (dişli). */
function knurledShape(r: number, teeth: number): Shape {
  const s = new Shape();
  const N = teeth * 4;
  for (let i = 0; i <= N; i++) {
    const a = (2 * Math.PI * i) / N;
    const rr = r * (1 - 0.05 * (0.5 + 0.5 * Math.cos(teeth * a)));
    if (i === 0) s.moveTo(rr * Math.cos(a), rr * Math.sin(a));
    else s.lineTo(rr * Math.cos(a), rr * Math.sin(a));
  }
  return s;
}

export function buildShellDevice(S: ShellSpec): DeviceModel {
  const D = S.door;
  const md = createModelDraft('cic', PART_IDS.cic, S.homeDir, {
    axis: new Vector3(1, 0, 0),
    angle: D.angle,
    slideDir: new Vector3(0, 1, 0),
    slideDistance: 0,
  });

  /* ---- dış hat (faceplate görünüşü, XY) ve kanal kesiti ---- */
  const faceR = (th: number, u: number): number => {
    let k = 1;
    for (const l of S.face.lobes) {
      const fade = l.fade !== undefined ? 1 - smoothstep(0, l.fade, u) : 1;
      k += l.amp * fade * lobe(th, l.at, l.width);
    }
    // Süperelips üssü derinlikte 2'ye iner (kanal kesiti eliptik)
    const pe = S.face.p + (2 - S.face.p) * profile(u);
    return ellipseR(th, S.face.a, S.face.b, S.face.rot, pe) * k;
  };
  const faceXY = (th: number): [number, number] => faceOutlineXY(S, th);
  const profile = (u: number): number => {
    const t = Math.min(1, Math.max(0, (u - S.blend[0]) / (S.blend[1] - S.blend[0])));
    if (S.fillet) {
      const k = Math.pow(t, S.profileQ);
      return k * k * (3 - 2 * k);
    }
    return 1 - Math.pow(1 - Math.pow(t, S.profileQ), 1 / S.profileQ);
  };
  const sectionXY = (th: number, u: number): [number, number] => {
    const w = profile(u);
    const rf = faceR(th, u);
    const k = smoothstep(S.blend[0], 1, u);
    const a = S.canal.a0 + (S.canal.a1 - S.canal.a0) * k;
    const b = S.canal.b0 + (S.canal.b1 - S.canal.b0) * k;
    const rc = ellipseR(th, a, b, S.canal.rot + S.canal.twist * u);
    const bulge = 1 + S.bulge * Math.sin(Math.PI * Math.min(1, u / 0.4));
    const r = (rf + (rc - rf) * w) * bulge;
    return [r * Math.cos(th), r * Math.sin(th)];
  };

  const spine = new CatmullRomCurve3(S.spine, false, 'centripetal');
  // Faceplate düzlemi z = 0: omurganın ilk parçası −Z boyunca olmalı (aksi halde kenarda aralık açılır)
  if (Math.abs(S.spine[1]!.x) > 1e-9 || Math.abs(S.spine[1]!.y) > 1e-9) throw new Error('Kabuk omurgasının ikinci noktası (0, 0, −d) olmalı.');
  const spec: LoftSpec = {
    spine,
    ref: Y_AXIS,
    uFrom: 0,
    uTo: 1,
    radii: () => ({ ry: 1, rz: 1 }),
    // (n, b) = (−X, +Y) çerçevesinde saat yönünün tersine: θ_xy = π − θ
    section: (theta, u) => {
      const [x, y] = sectionXY(Math.PI - theta, u);
      return [-x, y];
    },
    capStart: { kind: 'open' },
    capEnd: { kind: 'round', length: S.tipCap.length, power: S.tipCap.power },
    stations: 50,
    radial: 64,
  };

  const shellMat = S.translucent ? makeMaterial('shellAcrylic', S.shellColor) : makeMaterial('faceplate', S.shellColor);
  if (!S.translucent) {
    shellMat.roughness = 0.38;
    shellMat.clearcoat = 0.4;
  }
  /* ---- shell ---- */
  {
    const d = md.part('shell');
    // Faceplate ucunda AÇIK kabuk; faceplate parçalanınca içi görünür → çift taraflı.
    shellMat.side = DoubleSide;
    const shell = addMesh(d, buildLoft(spec), shellMat);
    shell.userData.collision = 'solid'; // açık faceplate ucu testte kapatılır (kabuk hacmi)
    shell.userData.collisionGroup = 'shell';
    const u = 0.42;
    const th = (3 * Math.PI) / 4; // ön-üst (n = −X → cos < 0 = +X, b = +Y): ana bakışa dönük
    const f = loftFrame(spine, Y_AXIS, u);
    const p = loftPoint(spec, f, u, th);
    d.anchorLocal.copy(p);
    d.anchorNormal.copy(p.clone().sub(f.p)).normalize();
    d.explodeDirection.set(0, 0, 0);
    d.explodeDistance = 0;
  }

  /* ---- faceplate: kabuk hattıyla aynı plaka + kapak deliği + pil cebi (+ ITE tekerlek yuvası) ---- */
  const { radius: R, thickness: h } = BATTERY_SPEC[S.battery];
  const plateDepth = 0.052;
  const plateBevel = 0.026;
  const plateTop = plateDepth + plateBevel;
  const Lh = new Vector3(Math.cos(D.rot), Math.sin(D.rot), 0); // kapak uzun ekseni
  const Sh = new Vector3(-Math.sin(D.rot), Math.cos(D.rot), 0); // kısa eksen
  const plateColor = S.plateColor;
  {
    const d = md.part('faceplate');
    const outline = new Shape();
    const N = 128;
    for (let i = 0; i < N; i++) {
      const [x, y] = faceXY((2 * Math.PI * i) / N);
      if (i === 0) outline.moveTo(x, y);
      else outline.lineTo(x, y);
    }
    outline.closePath();
    const holePts = doorHoleXY(S);
    outline.holes.push(new Path(holePts.slice().reverse()));
    const geo = new ExtrudeGeometry(outline, {
      depth: plateDepth,
      curveSegments: 12,
      bevelEnabled: true,
      bevelThickness: plateBevel,
      bevelSize: PLATE_BEVEL_SIZE,
      bevelOffset: -PLATE_BEVEL_SIZE,
      bevelSegments: 4,
    });
    const plate = addMesh(d, smoothBevelNormals(geo), makeMaterial('faceplate', plateColor));
    plate.name = 'faceplate-plate';
    plate.userData.collision = 'solid';
    plate.userData.collisionGroup = 'faceplate';
    // Pil cebi (görünen): delik altında koyu kuyu (kabuğun içinde kalır). Pilin açılış yayını kapsayan
    // bölme hacmi aşağıda kapakla birlikte (`compartment`) tanımlanır.
    const pocketMat = makeMaterial('cavity');
    pocketMat.side = BackSide;
    const wellDepth = S.pocketDepth;
    const well = addMesh(
      d,
      new ExtrudeGeometry(new Shape(roundedRectPoints(D.len + 0.04, D.wid + 0.04, D.corner + 0.02)), { depth: wellDepth, bevelEnabled: false, curveSegments: 6 }),
      pocketMat,
    );
    well.quaternion.copy(basisQuat(Lh, Sh, Z_AXIS));
    well.position.set(D.cx, D.cy, plateTop - 0.004 - wellDepth);
    well.castShadow = false;
    well.userData.collision = 'cavity';
    well.userData.carves = 'shell'; // yalnızca kabuk iç hacmini oyar; faceplate malzemesini asla
    if (S.wheel) {
      // Ses ayar tekerleği: plakadan ~0.7 mm yükselen tırtıllı disk + ortada koyu çukur + yön çizgisi
      const W = S.wheel;
      const wheelGeo = new ExtrudeGeometry(knurledShape(W.r, 34), { depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 2, curveSegments: 4 });
      const wheel = addMesh(d, wheelGeo, makeMaterial('faceplate', 0xb27c5f));
      wheel.position.set(W.at[0], W.at[1], plateTop - 0.004);
      const rim = addMesh(d, new CylinderGeometry(W.r + 0.02, W.r + 0.02, 0.01, 40, 1, true), pocketMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(W.at[0], W.at[1], plateTop - 0.002);
      const dimple = addMesh(d, new CircleGeometry(W.r * 0.28, 24), makeMaterial('faceplate', 0x8d5f46));
      dimple.position.set(W.at[0], W.at[1], plateTop + 0.071);
      dimple.castShadow = false;
      const mark = addMesh(d, new RoundedBoxGeometry(0.018, W.r * 0.55, 0.006, 1, 0.003), makeMaterial('portDark'));
      mark.position.set(W.at[0], W.at[1] + W.r * 0.55, plateTop + 0.072);
      mark.castShadow = false;
    }
    // Çapa: kapak ile mikrofon arasında boş bir plaka noktası
    const [ax, ay] = faceXY(Math.PI * 0.62);
    d.anchorLocal.set(ax * 0.72, ay * 0.72, plateTop + 0.01);
    d.anchorNormal.set(0, 0, 1);
    d.explodeDirection.set(0, 0, 1);
    d.explodeDistance = S.explode.faceplate;
  }

  /* ---- battery-door: ince (0.3 mm) yuvarlak köşeli kapak, menteşe bir kısa kenarda (pim yüzeyde) ----
   * Pim ekseni kapağın kısa ekseni boyunca, plaka yüzeyinin 0.12 mm altında. Kapak ve pil pimin
   * çevresinde döner: plaka düzlemini kesen her pil noktası pime ≤ delik boyu uzaklıkta olmalı
   * (aksi halde delik kenarından geçer) → pil menteşeye yakın (`batteryF`) ve kapağın hemen altında durur. */
  const free = Lh.clone().multiplyScalar(D.hingeAtStart ? 1 : -1); // menteşeden serbest uca
  const doorCenter = new Vector3(D.cx, D.cy, 0);
  const hinge = doorCenter.clone().addScaledVector(free, -D.len / 2 + 0.02).setZ(plateTop - 0.012);
  const doorAxis = new Vector3().crossVectors(free, Z_AXIS).normalize(); // +açı: serbest uç dışarı (+Z)
  const door = md.part('battery-door');
  const flapBevel = 0.01;
  const flapTop = plateTop - 0.004; // dış yüz plakadan 0.04 mm içeride
  const flapThick = 0.03;
  {
    const geo = new ExtrudeGeometry(new Shape(roundedRectPoints(D.len - 0.012, D.wid - 0.012, D.corner - 0.006)), {
      depth: flapThick - 2 * flapBevel,
      curveSegments: 6,
      bevelEnabled: true,
      bevelThickness: flapBevel,
      bevelSize: 0.01,
      bevelOffset: -0.01,
      bevelSegments: 2,
    });
    const flap = addMesh(door, smoothBevelNormals(geo), makeMaterial('faceplate', S.doorColor ?? plateColor));
    flap.name = 'door-outer';
    flap.userData.collision = 'door';
    flap.userData.collisionGroup = 'door-panel';
    flap.quaternion.copy(basisQuat(Lh, Sh, Z_AXIS));
    flap.position.set(D.cx, D.cy, flapTop - flapThick + flapBevel);
    // Tırnak çentiği: serbest kenarda kısa koyu oluk
    const notch = addMesh(door, new RoundedBoxGeometry(0.035, D.wid * 0.42, 0.02, 2, 0.008), makeMaterial('portDark'));
    notch.quaternion.copy(basisQuat(Lh, Sh, Z_AXIS));
    notch.position.copy(doorCenter).addScaledVector(free, D.len / 2 - 0.05).setZ(flapTop - 0.004);
    // Menteşe pimi: kapağın menteşe kenarında, dönme ekseninde ince metal çubuk
    // Pim boyu: menteşe hizasında deliğin (yuvarlak köşeler dahil) içinde, iki uçta 0.2 mm pay
    const rc = D.corner + HOLE_GAP;
    const aPin = 0.02 + HOLE_GAP; // pimin delik ucuna uzaklığı
    const halfAtPin = D.wid / 2 + HOLE_GAP - rc + (aPin < rc ? Math.sqrt(rc * rc - (rc - aPin) ** 2) : rc);
    const pin = addMesh(door, new CylinderGeometry(0.011, 0.011, Math.min(D.wid * 0.7, 2 * (halfAtPin - 0.02)), 10), makeMaterial('screw'));
    pin.quaternion.copy(quatFromTo(Y_AXIS, Sh));
    pin.position.copy(hinge);
    door.anchorLocal.copy(doorCenter).addScaledVector(free, 0.08).setZ(flapTop + 0.006).sub(hinge);
    // Çapa normali: pilin etiketli yüzünün tarafı (menteşe eksenine paralel → kapakla dönmez) + biraz dışarı.
    // Kapak açıkken odak kamerası pili karşıdan, açık kapağı yandan görür (kapak pili örtmez).
    const labelSide = Sh.clone().multiplyScalar(Sh.dot(S.homeDir) >= 0 ? 1 : -1);
    door.anchorNormal.copy(labelSide).multiplyScalar(0.9).addScaledVector(Z_AXIS, 0.4).normalize();
    door.explodeDirection.set(0, 0, 1);
    door.explodeDistance = S.explode.door;
  }

  /* ---- battery: kapağın altında dik (yuvarlak yüzü dönme düzleminde); etiket ana bakışa dönük ---- */
  // Delik serbest ucunun pime uzaklığı — pilin yan yüzleri hizasında (yuvarlak köşe deliği orada kısaltır)
  const holeR = D.corner + HOLE_GAP;
  const sideOff = Math.max(0, h / 2 + 0.005 - ((D.wid + 2 * HOLE_GAP) / 2 - holeR));
  const holeFar = D.len - 0.02 + HOLE_GAP - (holeR - Math.sqrt(Math.max(0, holeR * holeR - sideOff * sideOff)));
  const dzB = plateTop - 0.04 - R - hinge.z; // pil merkezi: pil üstü kapağın 0.1 mm altında
  // Pilin pime en uzak noktası delik ucundan en az 0.05 mm içeride kalmalı
  const fMax = Math.sqrt(Math.max(0, (holeFar - 0.005 - R) ** 2 - dzB * dzB));
  // Etkileşimli CIC: `batteryF` testle doğrulanmış (≤ fMax). Yalnızca render türevleri (ITE/ITC/IIC, kapak hep kapalı)
  // pili kapağın ortasına koyar (`batteryF: 'center'`) — küçük kabuklarda menteşe yanı yerleşim kabuktan taşar.
  const opens = D.batteryF !== 'center';
  if (typeof D.batteryF === 'number' && D.batteryF > fMax + 1e-9) {
    throw new Error(`Kabuk pil kapağı: batteryF ${D.batteryF} > ${fMax.toFixed(4)} (pil açılırken delik ucuna çarpar).`);
  }
  const fB = D.batteryF === undefined ? fMax : D.batteryF === 'center' ? D.len / 2 - 0.02 : D.batteryF;
  const batteryCenter = hinge.clone().addScaledVector(free, fB).setZ(hinge.z + dzB);
  {
    const d = md.part('battery', 'body', door);
    addBattery(d, S.battery, 1);
    const axis = Sh.clone().multiplyScalar(Sh.dot(S.homeDir) >= 0 ? 1 : -1);
    d.group.quaternion.copy(quatFromTo(Z_AXIS, axis));
    d.group.position.copy(batteryCenter);
    d.anchorLocal.set(0, 0, h / 2 + 0.012);
    d.anchorNormal.set(0, 0, 1);
    d.explodeDirection.set(0, 0, 1);
    d.explodeDistance = S.explode.battery;
  }
  /* ---- compartment: pilin açılış yayını kapsayan bölme hacmi (plaka altında, kabuğun içinde).
   * Görünmez çarpışma hacmi (pime göre dönme düzleminde, pil kalınlığı + 0.16 mm genişlikte): pil + 0.08 mm
   * payın süpürdüğü disklerin alt zarfından yukarı; delik boyunca plaka tabanına kadar, deliğin menteşe
   * ucunun gerisinde (plaka altında, delik dışında) yalnızca disklerin üst zarfına kadar — böylece bölme
   * kabuğun daralan üst duvarına taşmaz (bkz. tests/viewer-door.test.ts). Görünen koyu cep = `well`.
   * Yalnızca açılan kapakta (etkileşimli CIC); render türevlerinde (`batteryF: 'center'`) bölme yoktur. */
  if (opens) {
    const rho = R + 0.008;
    const bf = fB;
    const bz = dzB;
    const rB = Math.hypot(bf, bz);
    const phiB = Math.atan2(bz, bf);
    const centers: [number, number][] = [];
    for (let i = 0; i <= 90; i++) {
      const ph = phiB + (D.angle * i) / 90;
      centers.push([rB * Math.cos(ph), rB * Math.sin(ph)]);
    }
    const zTop = -hinge.z - 0.001; // plaka tabanının hemen altı (pime göre)
    const fHole = -0.02 - HOLE_GAP - 0.004; // deliğin menteşe ucu (pime göre) − küçük pay
    const fLo = Math.min(...centers.map((c) => c[0] - rho));
    const fHi = Math.max(...centers.filter((c) => c[1] - rho < zTop).map((c) => c[0] + Math.sqrt(Math.max(0, rho * rho - (zTop - c[1]) ** 2))));
    const envelope = (f: number): [number, number] => {
      let lo = Infinity;
      let hi = -Infinity;
      for (const [cf, cz] of centers) {
        const dx = f - cf;
        if (Math.abs(dx) > rho) continue;
        const k = Math.sqrt(rho * rho - dx * dx);
        lo = Math.min(lo, cz - k);
        hi = Math.max(hi, cz + k);
      }
      return [lo, hi];
    };
    const N = 96;
    const lower: Vector2[] = [];
    const upper: Vector2[] = [];
    for (let i = 0; i <= N; i++) {
      const f = fLo + ((fHi - fLo) * i) / N;
      const [lo, hi] = envelope(f);
      const zl = Math.min(lo, zTop - 0.002);
      lower.push(new Vector2(f, zl));
      const zu = f >= fHole ? zTop : Math.min(zTop, Math.max(hi, zl + 0.002));
      upper.push(new Vector2(f, zu));
    }
    // Menteşe ucundaki basamak (disk üst zarfından plaka tabanına) keskin olsun
    const iStep = upper.findIndex((p) => p.x >= fHole);
    if (iStep > 0) upper.splice(iStep, 0, new Vector2(fHole, upper[iStep - 1]!.y), new Vector2(fHole, zTop));
    const pts: Vector2[] = [...lower, ...upper.reverse()];
    const width = h + 0.016;
    const side = new Vector3().crossVectors(free, Z_AXIS).normalize();
    const geo = new ExtrudeGeometry(new Shape(pts), { depth: width, bevelEnabled: false, curveSegments: 1 });
    const comp = addMesh(md.drafts['shell']!, geo, makeMaterial('cavity'));
    comp.name = 'compartment';
    comp.visible = false;
    comp.userData.proxy = true;
    comp.castShadow = false;
    comp.userData.collision = 'cavity';
    comp.userData.carves = 'shell';
    comp.quaternion.copy(basisQuat(free, Z_AXIS, side));
    comp.position.copy(hinge).addScaledVector(side, -width / 2);
  }
  localizeTo(door, hinge);
  md.door.axis.copy(doorAxis);
  md.door.angle = D.angle;
  md.door.slideDir.copy(free);
  md.door.slideDistance = 0;

  /* ---- mic: vida başı görünümlü port(lar) ---- */
  {
    const d = md.part('mic');
    for (const [x, y] of S.mics) {
      const mr = S.micR;
      const ring = addMesh(d, new CylinderGeometry(mr, mr * 1.08, 0.02, 20), makeMaterial('screw', 0x9a9ea3));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, y, plateTop + 0.002);
      const hole = addMesh(d, new CircleGeometry(mr * 0.5, 16), makeMaterial('portDark'));
      hole.position.set(x, y, plateTop + 0.0125);
      hole.castShadow = false;
      const slot = addMesh(d, new RoundedBoxGeometry(mr * 1.45, mr * 0.2, 0.004, 1, 0.002), makeMaterial('portDark'));
      slot.position.set(x, y, plateTop + 0.0118);
      slot.rotation.z = 0.6;
      slot.castShadow = false;
    }
    const [x, y] = S.mics[0]!;
    d.anchorLocal.set(x, y, plateTop + 0.03);
    d.anchorNormal.set(0, 0, 1);
    d.explodeDirection.set(0, 0, 1);
    d.explodeDistance = S.explode.features;
  }

  /* ---- vent: faceplate'te küçük havalandırma ağzı ---- */
  {
    const d = md.part('vent');
    const [x, y] = S.vent;
    const hole = addMesh(d, new CylinderGeometry(0.036, 0.036, 0.12, 16), makeMaterial('portDark'));
    hole.rotation.x = Math.PI / 2;
    hole.position.set(x, y, plateTop - 0.058);
    const lip = addMesh(d, new CylinderGeometry(0.05, 0.05, 0.01, 18), makeMaterial('faceplate', S.translucent ? plateColor : 0x34373c));
    lip.rotation.x = Math.PI / 2;
    lip.position.set(x, y, plateTop + 0.001);
    lip.castShadow = false;
    const face = addMesh(d, new CircleGeometry(0.036, 18), makeMaterial('portDark'));
    face.position.set(x, y, plateTop + 0.0065);
    face.castShadow = false;
    d.anchorLocal.set(x, y, plateTop + 0.02);
    d.anchorNormal.set(0, 0, 1);
    d.explodeDirection.set(0, 0, 1);
    d.explodeDistance = S.explode.features;
  }

  /* ---- pull-string: şeffaf naylon ip (~6 mm) + küçük topuz (ITE/ITC'de yok → boş grup) ---- */
  {
    const d = md.part('pull-string');
    if (S.cord) {
      const [x, y] = S.cord.at;
      const p0 = new Vector3(x, y, plateTop - 0.02);
      const e = S.cord.end;
      const curve = new CatmullRomCurve3(
        [p0, new Vector3(x + 0.02, y - 0.03, plateTop + 0.1), new Vector3(x + (e.x - x) * 0.5, y + (e.y - y) * 0.45, e.z * 0.62), e.clone()],
        false,
        'centripetal',
      );
      addMesh(d, new TubeGeometry(curve, 32, 0.014, 8, false), makeMaterial('nylon'));
      const baseR = S.cord.baseR ?? 0.05;
      const base = addMesh(d, new CylinderGeometry(baseR * 0.8, baseR, 0.03, 16), makeMaterial('faceplate', plateColor));
      base.rotation.x = Math.PI / 2;
      base.position.set(x, y, plateTop + 0.005);
      const endT = curve.getTangentAt(1).normalize();
      const knob = addMesh(d, new SphereGeometry(0.048, 18, 12), makeMaterial('knob'));
      knob.position.copy(e).addScaledVector(endT, 0.035);
      d.anchorLocal.copy(knob.position).add(new Vector3(0, 0, 0.06));
      d.anchorNormal.set(0.2, -0.2, 1).normalize();
      d.explodeDirection.set(0.3, -0.35, 0.88).normalize();
      d.explodeDistance = S.explode.features;
    } else {
      d.anchorLocal.set(0, 0, plateTop);
      d.anchorNormal.set(0, 0, 1);
    }
  }

  /* ---- receiver-outlet: medial uçta kulak kiri koruyucusu + ses çıkışı + uç vent deliği ---- */
  {
    const d = md.part('receiver-outlet');
    const tf = loftFrame(spine, Y_AXIS, 1);
    const guard = addMesh(d, new CylinderGeometry(0.075, 0.075, 0.03, 22), makeMaterial('waxGuard'));
    guard.quaternion.copy(quatFromTo(Y_AXIS, tf.t));
    guard.position.copy(tf.p).addScaledVector(tf.t, -0.008);
    const mesh = addMesh(d, new CircleGeometry(0.036, 16), makeMaterial('portDark'));
    mesh.quaternion.copy(quatFromTo(Z_AXIS, tf.t));
    mesh.position.copy(tf.p).addScaledVector(tf.t, 0.0075);
    mesh.castShadow = false;
    const tipVent = addMesh(d, new CylinderGeometry(0.03, 0.03, 0.1, 12), makeMaterial('portDark'));
    tipVent.quaternion.copy(quatFromTo(Y_AXIS, tf.t));
    tipVent.position.copy(tf.p).addScaledVector(tf.t, -0.058).addScaledVector(tf.b, 0.13);
    const u = 0.93;
    const f = loftFrame(spine, Y_AXIS, u);
    const th = Math.PI * 0.8; // ön-üst yan
    const sp = loftPoint(spec, f, u, th);
    d.anchorLocal.copy(sp);
    d.anchorNormal.copy(sp.clone().sub(f.p)).normalize().addScaledVector(f.t, 0.35).normalize();
    d.explodeDirection.copy(tf.t);
    d.explodeDistance = S.explode.outlet;
  }

  return finalizeModel(md);
}

/** Etkileşimli CIC. */
export function buildCicModel(): DeviceModel {
  return buildShellDevice(SHELL_VARIANTS.cic);
}

/** Yalnızca render için kabuk türevi (aynı DeviceModel sözleşmesi; tip alanı 'cic'). */
export function buildShellVariant(kind: ShellKind): DeviceModel {
  return buildShellDevice(SHELL_VARIANTS[kind]);
}
