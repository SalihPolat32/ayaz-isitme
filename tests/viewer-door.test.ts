/**
 * Pil kapağı regresyon testi: kapak açılıp kapanırken (t = 0..1) pil ve kapak HİÇBİR ara pozda
 * gövde malzemesinin içinden geçmemeli; kapalıyken kapak hiçbir yerde gövde malzemesinin ALTINDA kalmamalı.
 *
 * Yöntem: modeldeki `mesh.userData.collision` işaretli meshler dünya uzayında üçgen kümesine
 * çevrilir. `'solid'` = kapalı katı (aynı `collisionGroup` adını taşıyan meshler tek bir kapalı yüzey
 * sayılır; açık sınır halkaları testte kapatılır), `'cavity'` = katının içinden oyulmuş boşluk
 * (pil yuvası); her boşluk YALNIZCA `userData.carves` ile adı verilen katı grubu oyar (ör. CIC kuyusu ve
 * bölmesi yalnızca kabuk iç hacmini — faceplate malzemesini asla). Nokta katının içinde mi? → üç farklı
 * yönde ışın paritesi, çoğunluk oyu (kenar/köşe isabetlerine dayanıklı). Gövde içi = ∃ katı grup g:
 * (g'nin içinde) ∧ ¬(g'yi oyan bir boşluğun içinde).
 *
 * Denetimler:
 *  - süpürme: her adımda pil / kapak köşeleri gövde içinde değil VE gövde köşeleri kapak / pil katısının
 *    içinde değil (köşeler arasından geçen yüzler için iki yönlü denetim);
 *  - kapalıyken kapak dış yüzü açılma yönünde (CIC: faceplate normali +Z; RIC/BTE: dış deri normali)
 *    dışarıya açık — araya görünür gövde yüzeyi girmez (ışın izleme); tüm kabuk türevlerinde (ITE/ITC/IIC dahil);
 *  - kabuk türevlerinde faceplate deliği çevresindeki bant pah ofsetlerinden geniş (`plateClearance`).
 *
 * Ayrıca RIC/BTE için tam açıkta (t = 1) pilin yan görünüşte (XY izdüşümü) gövde silüetinin dışında
 * kaldığı, CIC için pilin büyük kısmının faceplate'in üstüne çıktığı denetlenir.
 */
import { describe, expect, test } from 'vitest';
import type { BufferGeometry, Mesh, Object3D } from 'three';
import { Matrix3, Vector3 } from 'three';
import { buildDeviceModel, buildShellVariant } from '../src/scripts/viewer/model.ts';
import { plateClearance, SHELL_VARIANTS, type ShellKind } from '../src/scripts/viewer/model-shell.ts';
import type { DeviceModel, DeviceType } from '../src/scripts/viewer/types.ts';

const STEPS = 24; // t = 0, 1/24, …, 1  (≥ 21 adım)
/**
 * Kapak köşeleri için yüzeye bu kadar (birim; 0.01 mm) yakın "içeride" sonuçları gürültü sayılır. CIC kapağının
 * plakaya göre içeri çekintisinden (0.04 mm) KÜÇÜK olmalı — aksi halde ince bir plaka bandının altına gömülen
 * kapak "yüzeye yakın" diye affedilir.
 */
const DOOR_TOL = 0.001;
/** Gövde köşesi kapak / pil yüzeyine bu kadar yakınsa (0.01 mm) "içeride" sonucu gürültü sayılır. */
const BODY_TOL = 0.001;

/* ---------------------------------------------------------------------------------------------
 * Üçgen kümeleri
 * ------------------------------------------------------------------------------------------- */

/** Düz dizi: [ax, ay, az, bx, by, bz, cx, cy, cz] × n (dünya uzayı). */
type TriSoup = Float64Array;

function worldTriangles(mesh: Mesh): number[] {
  const g = mesh.geometry as BufferGeometry;
  const pos = g.getAttribute('position');
  const idx = g.getIndex();
  const m = mesh.matrixWorld;
  const v = new Vector3();
  const pts: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(m);
    pts.push(v.x, v.y, v.z);
  }
  const out: number[] = [];
  const n = idx ? idx.count : pos.count;
  for (let i = 0; i < n; i++) {
    const k = idx ? idx.getX(i) : i;
    out.push(pts[3 * k]!, pts[3 * k + 1]!, pts[3 * k + 2]!);
  }
  return out;
}

/** Açık sınır halkalarını (tek üçgene ait kenarlar) ağırlık merkezinden yelpazeyle kapatır. */
function capOpenLoops(tris: number[]): number[] {
  const key = (x: number, y: number, z: number): string => `${Math.round(x * 1e5)},${Math.round(y * 1e5)},${Math.round(z * 1e5)}`;
  const ids = new Map<string, number>();
  const coords: [number, number, number][] = [];
  const vid = (i: number): number => {
    const k = key(tris[i]!, tris[i + 1]!, tris[i + 2]!);
    let id = ids.get(k);
    if (id === undefined) {
      id = coords.length;
      ids.set(k, id);
      coords.push([tris[i]!, tris[i + 1]!, tris[i + 2]!]);
    }
    return id;
  };
  const edges = new Map<string, { a: number; b: number; n: number }>();
  for (let t = 0; t < tris.length; t += 9) {
    const a = vid(t);
    const b = vid(t + 3);
    const c = vid(t + 6);
    if (a === b || b === c || a === c) continue;
    for (const [p, q] of [
      [a, b],
      [b, c],
      [c, a],
    ] as const) {
      const k = p < q ? `${p}_${q}` : `${q}_${p}`;
      const e = edges.get(k);
      if (e) e.n++;
      else edges.set(k, { a: p, b: q, n: 1 });
    }
  }
  const next = new Map<number, number[]>();
  for (const e of edges.values()) {
    if (e.n !== 1) continue;
    (next.get(e.a) ?? next.set(e.a, []).get(e.a)!).push(e.b);
    (next.get(e.b) ?? next.set(e.b, []).get(e.b)!).push(e.a);
  }
  const used = new Set<string>();
  const out = tris.slice();
  for (const start of next.keys()) {
    const loop: number[] = [start];
    let prev = -1;
    let cur = start;
    for (;;) {
      const cand = (next.get(cur) ?? []).filter((x) => x !== prev && !used.has(cur < x ? `${cur}_${x}` : `${x}_${cur}`));
      if (cand.length === 0) break;
      const nx = cand[0]!;
      used.add(cur < nx ? `${cur}_${nx}` : `${nx}_${cur}`);
      if (nx === start) break;
      loop.push(nx);
      prev = cur;
      cur = nx;
    }
    if (loop.length < 3) continue;
    const c = [0, 0, 0];
    for (const id of loop) for (let k = 0; k < 3; k++) c[k]! += coords[id]![k]! / loop.length;
    for (let i = 0; i < loop.length; i++) {
      const p = coords[loop[i]!]!;
      const q = coords[loop[(i + 1) % loop.length]!]!;
      out.push(c[0]!, c[1]!, c[2]!, p[0], p[1], p[2], q[0], q[1], q[2]);
    }
  }
  return out;
}

/* ---------------------------------------------------------------------------------------------
 * Işın paritesi (sabit yönler için 2B ızgara hızlandırmalı)
 * ------------------------------------------------------------------------------------------- */

const RAY_DIRS = [new Vector3(1, 0.31, 0.17), new Vector3(-0.23, 1, 0.41), new Vector3(0.37, -0.19, 1)].map((d) => d.normalize());

interface RayGrid {
  d: Vector3;
  e1: Vector3;
  e2: Vector3;
  minU: number;
  minV: number;
  cell: number;
  nu: number;
  nv: number;
  cells: number[][];
}

function buildGrid(tris: TriSoup, d: Vector3): RayGrid {
  const e1 = new Vector3().crossVectors(d, Math.abs(d.z) < 0.9 ? new Vector3(0, 0, 1) : new Vector3(1, 0, 0)).normalize();
  const e2 = new Vector3().crossVectors(d, e1).normalize();
  const n = tris.length / 9;
  const uv = new Float64Array(n * 6);
  let minU = Infinity;
  let minV = Infinity;
  let maxU = -Infinity;
  let maxV = -Infinity;
  for (let t = 0; t < n; t++) {
    for (let k = 0; k < 3; k++) {
      const o = t * 9 + k * 3;
      const u = tris[o]! * e1.x + tris[o + 1]! * e1.y + tris[o + 2]! * e1.z;
      const v = tris[o]! * e2.x + tris[o + 1]! * e2.y + tris[o + 2]! * e2.z;
      uv[t * 6 + k * 2] = u;
      uv[t * 6 + k * 2 + 1] = v;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
  }
  const N = 96;
  const cell = Math.max((maxU - minU) / N, (maxV - minV) / N, 1e-6);
  const nu = Math.ceil((maxU - minU) / cell) + 1;
  const nv = Math.ceil((maxV - minV) / cell) + 1;
  const cells: number[][] = Array.from({ length: nu * nv }, () => []);
  for (let t = 0; t < n; t++) {
    const us = [uv[t * 6]!, uv[t * 6 + 2]!, uv[t * 6 + 4]!];
    const vs = [uv[t * 6 + 1]!, uv[t * 6 + 3]!, uv[t * 6 + 5]!];
    const i0 = Math.floor((Math.min(...us) - minU) / cell);
    const i1 = Math.floor((Math.max(...us) - minU) / cell);
    const j0 = Math.floor((Math.min(...vs) - minV) / cell);
    const j1 = Math.floor((Math.max(...vs) - minV) / cell);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) cells[i * nv + j]!.push(t);
  }
  return { d, e1, e2, minU, minV, cell, nu, nv, cells };
}

function rayHits(tris: TriSoup, g: RayGrid, px: number, py: number, pz: number): number {
  const u = px * g.e1.x + py * g.e1.y + pz * g.e1.z;
  const v = px * g.e2.x + py * g.e2.y + pz * g.e2.z;
  const i = Math.floor((u - g.minU) / g.cell);
  const j = Math.floor((v - g.minV) / g.cell);
  if (i < 0 || j < 0 || i >= g.nu || j >= g.nv) return 0;
  const { x: dx, y: dy, z: dz } = g.d;
  let hits = 0;
  for (const t of g.cells[i * g.nv + j]!) {
    const o = t * 9;
    const ax = tris[o]!, ay = tris[o + 1]!, az = tris[o + 2]!;
    const e1x = tris[o + 3]! - ax, e1y = tris[o + 4]! - ay, e1z = tris[o + 5]! - az;
    const e2x = tris[o + 6]! - ax, e2y = tris[o + 7]! - ay, e2z = tris[o + 8]! - az;
    const hx = dy * e2z - dz * e2y, hy = dz * e2x - dx * e2z, hz = dx * e2y - dy * e2x;
    const det = e1x * hx + e1y * hy + e1z * hz;
    if (Math.abs(det) < 1e-14) continue;
    const inv = 1 / det;
    const sx = px - ax, sy = py - ay, sz = pz - az;
    const bu = (sx * hx + sy * hy + sz * hz) * inv;
    if (bu < 0 || bu > 1) continue;
    const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
    const bv = (dx * qx + dy * qy + dz * qz) * inv;
    if (bv < 0 || bu + bv > 1) continue;
    const tt = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (tt > 1e-9) hits++;
  }
  return hits;
}

class ClosedSurface {
  readonly tris: TriSoup;
  private readonly grids: RayGrid[];
  constructor(tris: number[]) {
    this.tris = Float64Array.from(capOpenLoops(tris));
    this.grids = RAY_DIRS.map((d) => buildGrid(this.tris, d));
  }
  contains(p: Vector3): boolean {
    let votes = 0;
    for (const g of this.grids) if (rayHits(this.tris, g, p.x, p.y, p.z) % 2 === 1) votes++;
    return votes >= 2;
  }
  /** Noktanın yüzeye en kısa uzaklığı (yalnızca şüpheli noktalar için; kaba kuvvet). */
  distance(p: Vector3): number {
    let best = Infinity;
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    const q = new Vector3();
    for (let o = 0; o < this.tris.length; o += 9) {
      a.set(this.tris[o]!, this.tris[o + 1]!, this.tris[o + 2]!);
      b.set(this.tris[o + 3]!, this.tris[o + 4]!, this.tris[o + 5]!);
      c.set(this.tris[o + 6]!, this.tris[o + 7]!, this.tris[o + 8]!);
      closestOnTriangle(p, a, b, c, q);
      const d = q.distanceTo(p);
      if (d < best) best = d;
    }
    return best;
  }
}

/** Üçgen üzerindeki en yakın nokta (Ericson, Real-Time Collision Detection 5.1.5). */
function closestOnTriangle(p: Vector3, a: Vector3, b: Vector3, c: Vector3, out: Vector3): Vector3 {
  const ab = b.clone().sub(a);
  const ac = c.clone().sub(a);
  const ap = p.clone().sub(a);
  const d1 = ab.dot(ap);
  const d2 = ac.dot(ap);
  if (d1 <= 0 && d2 <= 0) return out.copy(a);
  const bp = p.clone().sub(b);
  const d3 = ab.dot(bp);
  const d4 = ac.dot(bp);
  if (d3 >= 0 && d4 <= d3) return out.copy(b);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return out.copy(a).addScaledVector(ab, d1 / (d1 - d3));
  const cp = p.clone().sub(c);
  const d5 = ab.dot(cp);
  const d6 = ac.dot(cp);
  if (d6 >= 0 && d5 <= d6) return out.copy(c);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return out.copy(a).addScaledVector(ac, d2 / (d2 - d6));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return out.copy(b).addScaledVector(c.clone().sub(b), (d4 - d3) / (d4 - d3 + (d5 - d6)));
  const denom = 1 / (va + vb + vc);
  return out.copy(a).addScaledVector(ab, vb * denom).addScaledVector(ac, vc * denom);
}

/* ---------------------------------------------------------------------------------------------
 * Model yardımcıları
 * ------------------------------------------------------------------------------------------- */

interface SolidGroup {
  /** `collisionGroup` adı (yoksa mesh uuid'i). */
  name: string;
  s: ClosedSurface;
}

interface BodyCollider {
  solids: SolidGroup[];
  cavities: { carves: string; s: ClosedSurface }[];
  inside(p: Vector3): boolean;
}

function collectBody(model: DeviceModel, kinds: readonly string[] = ['solid', 'cavity']): BodyCollider {
  model.root.updateMatrixWorld(true);
  const groups = new Map<string, { kind: string; group: string; carves: string; tris: number[] }>();
  model.root.traverse((o: Object3D) => {
    const m = o as Mesh;
    const kind = m.userData?.collision as string | undefined;
    if (!m.isMesh || !kind || !kinds.includes(kind)) return;
    const group = (m.userData.collisionGroup as string | undefined) ?? m.uuid;
    const carves = (m.userData.carves as string | undefined) ?? '';
    const name = `${kind}:${group}:${carves}`;
    const g = groups.get(name) ?? groups.set(name, { kind, group, carves, tris: [] }).get(name)!;
    g.tris.push(...worldTriangles(m));
  });
  const solids: SolidGroup[] = [];
  const cavities: { carves: string; s: ClosedSurface }[] = [];
  for (const g of groups.values()) {
    if (g.kind === 'cavity') cavities.push({ carves: g.carves, s: new ClosedSurface(g.tris) });
    else solids.push({ name: g.group, s: new ClosedSurface(g.tris) });
  }
  return {
    solids,
    cavities,
    // Boşluk yalnızca kendi hedef katısının içindeki noktaları affeder (faceplate gibi görünen malzemeyi değil)
    inside: (p) => solids.some((sd) => sd.s.contains(p) && !cavities.some((c) => c.carves === sd.name && c.s.contains(p))),
  };
}

/** İşaretli (tek) meshin dünya uzayı üçgenlerinden kapalı yüzey. */
function meshSolid(model: DeviceModel, pred: (m: Mesh) => boolean): ClosedSurface | null {
  model.root.updateMatrixWorld(true);
  const tris: number[] = [];
  model.root.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh && pred(m)) tris.push(...worldTriangles(m));
  });
  return tris.length ? new ClosedSurface(tris) : null;
}

/** Katı işaretli gövde meshlerinin (dünya uzayı, tekrarsız) köşeleri — yalnızca bir üçgene ait olanlar
 * (indeksli ızgaralarda çıkarılmış hücrelerin köşeleri konumda kalır ama yüzey değildir). */
function bodyVertices(model: DeviceModel): Vector3[] {
  model.root.updateMatrixWorld(true);
  const out: Vector3[] = [];
  const seen = new Set<string>();
  model.root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh || m.userData.collision !== 'solid') return;
    const pos = m.geometry.getAttribute('position');
    const index = m.geometry.getIndex();
    const used = index ? new Set(Array.from(index.array as ArrayLike<number>)) : null;
    for (let i = 0; i < pos.count; i++) {
      if (used && !used.has(i)) continue;
      const v = new Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      const k = `${v.x.toFixed(5)},${v.y.toFixed(5)},${v.z.toFixed(5)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(v);
    }
  });
  return out;
}

/** Işın (o + t·d, t > 0) üçgen kümesinden herhangi birine çarpıyor mu? (kaba kuvvet, Möller–Trumbore) */
function rayHitsSoup(tris: TriSoup, o: Vector3, d: Vector3): boolean {
  for (let k = 0; k < tris.length; k += 9) {
    const ax = tris[k]!, ay = tris[k + 1]!, az = tris[k + 2]!;
    const e1x = tris[k + 3]! - ax, e1y = tris[k + 4]! - ay, e1z = tris[k + 5]! - az;
    const e2x = tris[k + 6]! - ax, e2y = tris[k + 7]! - ay, e2z = tris[k + 8]! - az;
    const hx = d.y * e2z - d.z * e2y, hy = d.z * e2x - d.x * e2z, hz = d.x * e2y - d.y * e2x;
    const det = e1x * hx + e1y * hy + e1z * hz;
    if (Math.abs(det) < 1e-14) continue;
    const inv = 1 / det;
    const sx = o.x - ax, sy = o.y - ay, sz = o.z - az;
    const bu = (sx * hx + sy * hy + sz * hz) * inv;
    if (bu < 0 || bu > 1) continue;
    const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
    const bv = (d.x * qx + d.y * qy + d.z * qz) * inv;
    if (bv < 0 || bu + bv > 1) continue;
    if ((e2x * qx + e2y * qy + e2z * qz) * inv > 1e-7) return true;
  }
  return false;
}

/**
 * Kapalıyken kapağın ÜSTÜNDE görünür gövde malzemesi var mı? Her kapak köşesinden açılma yönünde dışarı ışın:
 * CIC ve kabuk türevleri → faceplate normali (+Z, tüm kapak köşeleri); RIC/BTE → kapak dış derisinin
 * (`door-outer`) köşe normali. Işın herhangi bir katı gövde üçgenine çarparsa köşe "örtülü" sayılır.
 */
function coveredDoorVertices(model: DeviceModel, shell: boolean): Vector3[] {
  model.root.updateMatrixWorld(true);
  const body = collectBody(model, ['solid']);
  const soups = body.solids.map((sd) => sd.s.tris);
  const bad: Vector3[] = [];
  const up = new Vector3(0, 0, 1);
  const probe = (v: Vector3, d: Vector3): void => {
    const o = v.clone().addScaledVector(d, 1e-4);
    if (soups.some((t) => rayHitsSoup(t, o, d))) bad.push(v);
  };
  if (shell) {
    for (const v of partVertices(model, 'battery-door')) probe(v, up);
    return bad;
  }
  let outer: Mesh | undefined;
  model.parts['battery-door']!.object.traverse((o) => {
    if ((o as Mesh).isMesh && o.name === 'door-outer') outer = o as Mesh;
  });
  expect(outer, 'door-outer meshi yok').toBeDefined();
  const pos = outer!.geometry.getAttribute('position');
  const nrm = outer!.geometry.getAttribute('normal');
  const nm = new Matrix3().getNormalMatrix(outer!.matrixWorld);
  for (let i = 0; i < pos.count; i++) {
    const v = new Vector3().fromBufferAttribute(pos, i).applyMatrix4(outer!.matrixWorld);
    const n = new Vector3().fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize();
    probe(v, n);
  }
  return bad;
}

/** Parçanın KENDİ meshlerinin (alt parça grupları hariç) dünya uzayı köşeleri. */
function partVertices(model: DeviceModel, id: string, own = true): Vector3[] {
  const part = model.parts[id]!;
  const out: Vector3[] = [];
  const visit = (o: Object3D): void => {
    for (const child of o.children) {
      const m = child as Mesh;
      if (m.isMesh) {
        if (m.userData?.collision === 'cavity') continue; // yuva boşluğu (görsel yardımcı), parça malzemesi değil
        const pos = m.geometry.getAttribute('position');
        for (let i = 0; i < pos.count; i++) out.push(new Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld));
      } else if (!own || !model.partList.some((p) => p.object === child)) {
        visit(child);
      }
    }
  };
  model.root.updateMatrixWorld(true);
  visit(part.object);
  // Aynı konumdaki köşeleri ayıkla (dikiş/yan yüz tekrarları)
  const seen = new Set<string>();
  return out.filter((v) => {
    const k = `${v.x.toFixed(5)},${v.y.toFixed(5)},${v.z.toFixed(5)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

interface Violation {
  t: number;
  explode: number;
  part: string;
  count: number;
  sample: string;
}

function sweep(type: DeviceType, explode: number): Violation[] {
  const model = buildDeviceModel(type);
  model.setExplode(explode);
  model.setDoor(0);
  const body = collectBody(model); // gövde kapakla hareket etmez (patlatma pozu sabit)
  const bodyVerts = bodyVertices(model);
  const out: Violation[] = [];
  const report = (t: number, part: string, bad: Vector3[]): void => {
    if (bad.length === 0) return;
    const v = bad[0]!;
    out.push({ t, explode, part, count: bad.length, sample: `(${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)})` });
  };
  for (let s = 0; s <= STEPS; s++) {
    const t = s / STEPS;
    model.setDoor(t);
    for (const part of ['battery', 'battery-door'] as const) {
      const verts = partVertices(model, part);
      report(
        t,
        part,
        verts.filter((v) => body.inside(v) && (part === 'battery' || !body.solids.some((sd) => sd.s.distance(v) < DOOR_TOL))),
      );
    }
    // Ters yön: gövde köşesi kapak paneli / pil katısının içinde mi? (yüzler köşeler arasından geçerse)
    const movers: [string, ClosedSurface | null][] = [
      ['body→door-panel', meshSolid(model, (m) => m.userData.collision === 'door')],
      ['body→battery', meshSolid(model, (m) => m.name === 'battery-cell')],
    ];
    for (const [name, solid] of movers) {
      if (!solid) continue;
      let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      for (let o = 0; o < solid.tris.length; o += 3) {
        minX = Math.min(minX, solid.tris[o]!);
        maxX = Math.max(maxX, solid.tris[o]!);
        minY = Math.min(minY, solid.tris[o + 1]!);
        maxY = Math.max(maxY, solid.tris[o + 1]!);
        minZ = Math.min(minZ, solid.tris[o + 2]!);
        maxZ = Math.max(maxZ, solid.tris[o + 2]!);
      }
      const near = bodyVerts.filter((v) => v.x >= minX && v.x <= maxX && v.y >= minY && v.y <= maxY && v.z >= minZ && v.z <= maxZ);
      report(t, name, near.filter((v) => solid.contains(v) && solid.distance(v) > BODY_TOL));
    }
  }
  model.dispose();
  return out;
}

/** Gövdenin yan görünüş (XY) silüeti: katı üçgenlerinin izdüşümü ızgaraya boyanır. */
function silhouetteOutsideFraction(model: DeviceModel): number {
  const body = collectBody(model);
  const cell = 0.004; // 0.04 mm
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const { s } of body.solids) {
    for (let o = 0; o < s.tris.length; o += 3) {
      minX = Math.min(minX, s.tris[o]!);
      maxX = Math.max(maxX, s.tris[o]!);
      minY = Math.min(minY, s.tris[o + 1]!);
      maxY = Math.max(maxY, s.tris[o + 1]!);
    }
  }
  const nx = Math.ceil((maxX - minX) / cell) + 1;
  const ny = Math.ceil((maxY - minY) / cell) + 1;
  const mask = new Uint8Array(nx * ny);
  for (const { s } of body.solids) {
    const T = s.tris;
    for (let o = 0; o < T.length; o += 9) {
      const ax = T[o]!, ay = T[o + 1]!, bx = T[o + 3]!, by = T[o + 4]!, cx = T[o + 6]!, cy = T[o + 7]!;
      const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
      if (Math.abs(area) < 1e-12) continue;
      const i0 = Math.floor((Math.min(ax, bx, cx) - minX) / cell);
      const i1 = Math.ceil((Math.max(ax, bx, cx) - minX) / cell);
      const j0 = Math.floor((Math.min(ay, by, cy) - minY) / cell);
      const j1 = Math.ceil((Math.max(ay, by, cy) - minY) / cell);
      for (let i = i0; i <= i1; i++) {
        for (let j = j0; j <= j1; j++) {
          const px = minX + i * cell, py = minY + j * cell;
          const w0 = ((bx - px) * (cy - py) - (cx - px) * (by - py)) / area;
          const w1 = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) / area;
          if (w0 >= -1e-9 && w1 >= -1e-9 && 1 - w0 - w1 >= -1e-9) mask[i * ny + j] = 1;
        }
      }
    }
  }
  const verts = partVertices(model, 'battery');
  let outside = 0;
  for (const v of verts) {
    const i = Math.round((v.x - minX) / cell);
    const j = Math.round((v.y - minY) / cell);
    const inMask = i >= 0 && j >= 0 && i < nx && j < ny && mask[i * ny + j] === 1;
    if (!inMask) outside++;
  }
  return outside / verts.length;
}

/* ---------------------------------------------------------------------------------------------
 * Testler
 * ------------------------------------------------------------------------------------------- */

const TYPES: DeviceType[] = ['ric', 'bte', 'cic'];

describe('pil kapağı: açılış/kapanış boyunca gövdeyle çakışma yok', () => {
  for (const type of TYPES) {
    test(`${type}: çarpışma modeli işaretli ve pil kapalıyken yuvada`, () => {
      const model = buildDeviceModel(type);
      const body = collectBody(model);
      expect(body.solids.length, 'collision=solid işaretli mesh yok').toBeGreaterThan(0);
      // Dinlenmede pil gövdenin dış silüetinin içinde (gizli) ama katının içinde değil
      const verts = partVertices(model, 'battery');
      expect(verts.length).toBeGreaterThan(100);
      expect(verts.filter((v) => body.inside(v)).length).toBe(0);
      // Kapak paneli ('door' işaretli kapalı katı; RIC/BTE) pilin içinden geçmez: pil çekmecenin boşluğunda
      const panel = collectBody(model, ['door']);
      if (type !== 'cic') expect(panel.solids.length, 'door-panel katısı yok').toBeGreaterThan(0);
      expect(verts.filter((v) => panel.inside(v)).length).toBe(0);
      model.dispose();
    });
    for (const explode of [0, 1]) {
      test(`${type}: kapak t = 0…1 (${STEPS + 1} adım), parçalanma = ${explode}`, () => {
        const v = sweep(type, explode);
        expect(v, JSON.stringify(v.slice(0, 6))).toEqual([]);
      });
    }
  }

  for (const type of ['ric', 'bte'] as const) {
    test(`${type}: kapalıyken pil tamamen gizli (yan silüetin içinde, yanakların arasında)`, () => {
      const model = buildDeviceModel(type);
      expect(silhouetteOutsideFraction(model)).toBe(0);
      model.dispose();
    });
    test(`${type}: tam açıkta pilin ≥ %70'i yan görünüşte gövde silüetinin dışında`, () => {
      const model = buildDeviceModel(type);
      model.setDoor(1);
      const frac = silhouetteOutsideFraction(model);
      model.dispose();
      expect(frac).toBeGreaterThanOrEqual(0.7);
    });
  }

  test('cic: kapalıyken pil ve bölme hacmi kabuğun içinde (dışarı taşmaz)', () => {
    const model = buildDeviceModel('cic');
    model.root.updateMatrixWorld(true);
    const shellMesh = model.parts['shell']!.object.children.find((c) => (c as Mesh).isMesh && (c as Mesh).userData.collision === 'solid') as Mesh;
    const shell = new ClosedSurface(worldTriangles(shellMesh));
    const bad = partVertices(model, 'battery').filter((v) => v.z < 0 && !shell.contains(v));
    expect(bad.length, 'kabuktan taşan pil köşesi').toBe(0);
    const cav: Vector3[] = [];
    model.root.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh || m.userData.collision !== 'cavity') return;
      const pos = m.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) cav.push(new Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld));
    });
    expect(cav.length).toBeGreaterThan(0);
    const out = cav.filter((v) => v.z < -0.002 && !shell.contains(v));
    expect(out.length, 'kabuktan taşan bölme köşesi').toBe(0);
    model.dispose();
  });

  test('ite / itc / iic (yalnızca render, kapak kapalı): pil kabuğun içinde, dışarıdan görünmez', () => {
    for (const kind of ['ite', 'itc', 'iic'] as const) {
      const model = buildShellVariant(kind);
      model.root.updateMatrixWorld(true);
      const shellMesh = model.parts['shell']!.object.children.find((c) => (c as Mesh).isMesh && (c as Mesh).userData.collision === 'solid') as Mesh;
      const shell = new ClosedSurface(worldTriangles(shellMesh));
      const bad = partVertices(model, 'battery').filter((v) => v.z < 0 && !shell.contains(v));
      expect(bad.length, kind).toBe(0);
      model.dispose();
    }
  });

  test('cic: tam açıkta pilin çoğu faceplate yüzeyinin üstünde (dışarıda)', () => {
    const model = buildDeviceModel('cic');
    const closed = partVertices(model, 'battery');
    const topZ = Math.max(...partVertices(model, 'faceplate').map((v) => v.z));
    expect(closed.every((v) => v.z < topZ)).toBe(true);
    model.setDoor(1);
    const open = partVertices(model, 'battery');
    const above = open.filter((v) => v.z > topZ).length / open.length;
    model.dispose();
    expect(above).toBeGreaterThanOrEqual(0.6);
  });

  for (const type of TYPES) {
    test(`${type}: kapalıyken kapak açılma yönünde dışarıya açık (üstünde görünür gövde malzemesi yok)`, () => {
      const model = buildDeviceModel(type);
      const bad = coveredDoorVertices(model, type === 'cic');
      model.dispose();
      expect(bad.length, bad.slice(0, 3).map((v) => v.toArray().map((x) => x.toFixed(3)).join(',')).join(' | ')).toBe(0);
    });
  }

  test('ite / itc / iic (yalnızca render): kapak faceplate deliğinde tamamen açıkta', () => {
    for (const kind of ['ite', 'itc', 'iic'] as const) {
      const model = buildShellVariant(kind);
      const bad = coveredDoorVertices(model, true);
      model.dispose();
      expect(bad.length, kind).toBe(0);
    }
  });

  test('kabuk türevleri: kapak deliği çevresindeki faceplate bandı pah ofsetlerinden geniş, parçalar deliğe / kenara taşmaz', () => {
    for (const kind of Object.keys(SHELL_VARIANTS) as ShellKind[]) {
      const c = plateClearance(SHELL_VARIANTS[kind]);
      // Üst yüzde en az 0.1 mm düz bant (pah ofsetleri ters dönmüş üçgen üretmez)
      expect(c.outline, `${kind}: delik–dış hat`).toBeGreaterThanOrEqual(c.minOutline + 0.01);
      expect(c.features, `${kind}: delik–mikrofon/vent/ip/tekerlek`).toBeGreaterThanOrEqual(0.01);
      expect(c.featuresEdge, `${kind}: parça–dış hat`).toBeGreaterThanOrEqual(0.01);
    }
  });

  test('her boşluk (cavity) oyduğu katı grubu açıkça belirtir ve o grup modelde var', () => {
    for (const model of [...TYPES.map((t) => buildDeviceModel(t)), ...(['ite', 'itc', 'iic'] as const).map((k) => buildShellVariant(k))]) {
      const groups = new Set<string>();
      const carves: string[] = [];
      model.root.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        if (m.userData.collision === 'solid') groups.add((m.userData.collisionGroup as string | undefined) ?? m.uuid);
        if (m.userData.collision === 'cavity') carves.push((m.userData.carves as string | undefined) ?? '');
      });
      for (const c of carves) expect(groups.has(c), `carves = "${c}"`).toBe(true);
      model.dispose();
    }
  });

  test('model bütçesi: etkileşimli her model < 40k üçgen', () => {
    for (const type of TYPES) {
      const m = buildDeviceModel(type);
      expect(m.triangleCount, type).toBeLessThan(40_000);
      m.dispose();
    }
  });
});
