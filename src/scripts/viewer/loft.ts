/**
 * Loft (omurga boyunca kesit süpürme) geometrisi — gövdeler, kapaklar ve CIC kabuğu için.
 *
 * Kesit: `p(u) + n·ry·cosθ + b·rz·shape(θ)·sinθ`; `n = normalize(ref × t)`, `b = t × n`.
 * Uçlar yuvarlatılmış (süperelips profil), düz (fan / halka + yuva) ya da açık olabilir.
 * Düz kapak köşe noktaları yan yüzeyden AYRI tutulur (keskin kenar, normal yumuşamaz).
 */
import { BufferGeometry, type CatmullRomCurve3, Float32BufferAttribute, Vector3 } from 'three';

export interface LoftFrame {
  p: Vector3;
  t: Vector3;
  n: Vector3;
  b: Vector3;
}

export type CapSpec =
  | { kind: 'round'; length: number; power?: number }
  | { kind: 'flat'; hole?: number }
  | { kind: 'open' };

export interface LoftSpec {
  spine: CatmullRomCurve3;
  /** Referans vektör (n = ref × t). RIC/BTE: +Z; CIC (omurga −Z boyunca): +Y. */
  ref: Vector3;
  uFrom: number;
  uTo: number;
  /** Yarı eksenler (n ve b yönü), uç yuvarlatması HARİÇ. */
  radii: (u: number) => { ry: number; rz: number };
  /** b-yönü ölçek modülasyonu (damla/düzleşme). Varsayılan 1. */
  shape?: (cosTheta: number, sinTheta: number, u: number) => number;
  /**
   * Özel kesit eğrisi: θ ∈ [0, 2π) için (n, b) düzleminde nokta; `radii` (uç yuvarlatması dahil)
   * ile çarpılır. Verilirse `shape` yok sayılır. (n, b) düzleminde saat yönünün tersine
   * dolaşmalı (dış normaller). Kabuk/kalıp gibi organik kesitler için.
   */
  section?: (theta: number, u: number) => [number, number];
  capStart: CapSpec;
  capEnd: CapSpec;
  stations: number;
  radial: number;
}

const MIN_R = 0.002;

export function loftFrame(spine: CatmullRomCurve3, ref: Vector3, u: number): LoftFrame {
  const p = spine.getPointAt(u);
  const t = spine.getTangentAt(u).normalize();
  const n = new Vector3().crossVectors(ref, t).normalize();
  const b = new Vector3().crossVectors(t, n).normalize();
  return { p, t, n, b };
}

function capFactor(spec: LoftSpec, u: number): number {
  let f = 1;
  const span = spec.uTo - spec.uFrom;
  if (spec.capStart.kind === 'round') {
    const L = spec.capStart.length;
    const d = (u - spec.uFrom) / span;
    if (d < L) {
      const v = 1 - d / L;
      const p = spec.capStart.power ?? 2;
      f *= Math.pow(Math.max(0, 1 - Math.pow(v, p)), 1 / p);
    }
  }
  if (spec.capEnd.kind === 'round') {
    const L = spec.capEnd.length;
    const d = (spec.uTo - u) / span;
    if (d < L) {
      const v = 1 - d / L;
      const p = spec.capEnd.power ?? 2;
      f *= Math.pow(Math.max(0, 1 - Math.pow(v, p)), 1 / p);
    }
  }
  return f;
}

/** Kesit yarı eksenleri (uç yuvarlatması dahil). */
export function loftRadii(spec: LoftSpec, u: number): { ry: number; rz: number } {
  const { ry, rz } = spec.radii(u);
  const c = capFactor(spec, u);
  return { ry: Math.max(MIN_R, ry * c), rz: Math.max(MIN_R, rz * c) };
}

/** Kesit noktası (model uzayı). */
export function loftPoint(spec: LoftSpec, frame: LoftFrame, u: number, theta: number, out = new Vector3()): Vector3 {
  const { ry, rz } = loftRadii(spec, u);
  if (spec.section) {
    const [a, b] = spec.section(theta, u);
    return out
      .copy(frame.p)
      .addScaledVector(frame.n, ry * a)
      .addScaledVector(frame.b, rz * b);
  }
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const zs = spec.shape ? spec.shape(c, s, u) : 1;
  return out
    .copy(frame.p)
    .addScaledVector(frame.n, ry * c)
    .addScaledVector(frame.b, rz * zs * s);
}

/** Yüzey noktası: `u` istasyonunda +n ('top' = sırt) veya −n ('bottom' = ön) yüzü. */
export function loftSurface(spec: LoftSpec, u: number, side: 'top' | 'bottom' | 'outer' | 'inner'): { point: Vector3; normal: Vector3; frame: LoftFrame } {
  const frame = loftFrame(spec.spine, spec.ref, u);
  const theta = side === 'top' ? 0 : side === 'bottom' ? Math.PI : side === 'outer' ? Math.PI / 2 : -Math.PI / 2;
  const point = loftPoint(spec, frame, u, theta);
  const normal = point.clone().sub(frame.p).normalize();
  return { point, normal, frame };
}

export function buildLoft(spec: LoftSpec): BufferGeometry {
  const { stations, radial } = spec;
  const positions: number[] = [];
  const indices: number[] = [];
  const span = spec.uTo - spec.uFrom;
  const tmp = new Vector3();

  for (let i = 0; i <= stations; i++) {
    // Uçlarda yoğun örnekleme (kosinüs dağılımı)
    const k = 0.5 - 0.5 * Math.cos((Math.PI * i) / stations);
    const u = spec.uFrom + span * k;
    const frame = loftFrame(spec.spine, spec.ref, u);
    for (let j = 0; j < radial; j++) {
      loftPoint(spec, frame, u, (2 * Math.PI * j) / radial, tmp);
      positions.push(tmp.x, tmp.y, tmp.z);
    }
  }
  for (let i = 0; i < stations; i++) {
    for (let j = 0; j < radial; j++) {
      const j1 = (j + 1) % radial;
      const a = i * radial + j;
      const bb = i * radial + j1;
      const c = (i + 1) * radial + j;
      const d = (i + 1) * radial + j1;
      indices.push(a, bb, d, a, d, c);
    }
  }

  const addFlatCap = (u: number, cap: { kind: 'flat'; hole?: number }, atEnd: boolean): void => {
    const frame = loftFrame(spec.spine, spec.ref, u);
    const base = positions.length / 3;
    for (let j = 0; j < radial; j++) {
      loftPoint(spec, frame, u, (2 * Math.PI * j) / radial, tmp);
      positions.push(tmp.x, tmp.y, tmp.z);
    }
    if (cap.hole && cap.hole > 0) {
      const inner = positions.length / 3;
      for (let j = 0; j < radial; j++) {
        const th = (2 * Math.PI * j) / radial;
        tmp.copy(frame.p).addScaledVector(frame.n, cap.hole * Math.cos(th)).addScaledVector(frame.b, cap.hole * Math.sin(th));
        positions.push(tmp.x, tmp.y, tmp.z);
      }
      for (let j = 0; j < radial; j++) {
        const j1 = (j + 1) % radial;
        if (atEnd) indices.push(base + j, base + j1, inner + j1, base + j, inner + j1, inner + j);
        else indices.push(base + j, inner + j1, base + j1, base + j, inner + j, inner + j1);
      }
    } else {
      const center = positions.length / 3;
      positions.push(frame.p.x, frame.p.y, frame.p.z);
      for (let j = 0; j < radial; j++) {
        const j1 = (j + 1) % radial;
        if (atEnd) indices.push(center, base + j, base + j1);
        else indices.push(center, base + j1, base + j);
      }
    }
  };
  if (spec.capStart.kind === 'flat') addFlatCap(spec.uFrom, spec.capStart, false);
  if (spec.capEnd.kind === 'flat') addFlatCap(spec.uTo, spec.capEnd, true);

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
