/**
 * Kulak arkası gövdeler (RIC / BTE) için "yanaklı yuva + dışa dönen çekmece" pil kapağı geometrisi.
 *
 * Mekanizma (gerçek cihazlardaki gibi, bkz. README): gövdenin iki yan duvarı ("yanak", |z| > w) alt uca
 * kadar TAM kalır; aralarındaki dilim (|z| < w) alt uçta, dikiş istasyonunun (uSplit) altında boştur.
 * Bu boşluğa U biçimli kapak oturur: ön şerit + alt uç + arka şerit (dış yüzey gövdeyle aynı yüzey),
 * iç yüz, yan kenarlar ve üst kenarlar → kapalı katı. Pim, dikiş hattının ÖN ucunda (yüzeyden
 * `pinInset` içeride), ekseni yan yüzlere dik (Z). Kapak pim çevresinde profil düzleminde döner:
 * alt ucu öne doğru çıkar (≈ 90°), pil kapağın beşiğinde birlikte döner ve yanakların arasından
 * dışarı çıkar; kapanışta aynı yayla geri girer.
 *
 * Neden çakışmaz: kapak bölgesinin her noktası pime göre r yarıçaplı çember üzerinde döner. Kapak
 * bölgesi dilimin dikiş düzleminin altındaki TAMAMI olduğundan, her r için kapak yayının saat yönü
 * tersindeki devamı gövde dış hattının dışındadır (kapak paneli hattın tamamını kaplar). Dikişin
 * üstündeki gövde yalnızca y > +gapBody bölgesindedir; kapak noktaları (y ≤ −gapDoor) 90°'ye kadar
 * dönüşte buraya ancak pimin önünde x > gapBody olan noktalar girebilir → kapağın ön-üst köşesi
 * 45° pahlanır (`chamfer`). Yanaklar |z| > w'dedir, kapak |z| < w − zGap'te kalır.
 *
 * Tüm yüzeyler aynı ızgara noktalarını paylaşır (su geçirmez): gövde derisi (şerit hücreleri dikişin
 * altında çıkarılmış) + iki yanak iç yüzü (z = ±w düzlemleri) + dikiş yüzü; kapakta dış deri + iç
 * deri + yan/üst kenar yüzleri. Testler (`tests/viewer-door.test.ts`) bunlarla ışın paritesi yapar.
 *
 * Kesit bu bölgede Z'ye göre simetrik olmalıdır (en büyük |z| θ = ±π/2'de) — alt gövde kesiti bunu sağlar.
 */
import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2, Vector3 } from 'three';
import { loftFrame, loftRadii, type LoftFrame, type LoftSpec } from './loft.ts';

const TAU = Math.PI * 2;

export interface SlotColumns {
  /** Arka şerit (θ ≈ 0), dış yanak (θ ≈ π/2), ön şerit (θ ≈ π), iç yanak (θ ≈ 3π/2) hücre sayıları. */
  rear: number;
  outerCheek: number;
  front: number;
  innerCheek: number;
}

export interface SlotDoorParams {
  /** Tüm gövde loftu (u ∈ [0, 1]); `section` zorunlu. */
  body: LoftSpec;
  /** Kapak iç yüzü loftu (aynı omurga; radii küçültülmüş, alt kapak yukarı kaydırılmış). */
  inner: LoftSpec;
  /** Dikiş istasyonu (u). Pim bu istasyonun ön noktasında. */
  uSplit: number;
  /** Kapak üst yüzü dikişin bu kadar altında, gövde dikiş yüzü bu kadar üstünde (birim). */
  gapDoor: number;
  gapBody: number;
  /** Yanak iç yüzleri z = ±slab. */
  slab: number;
  /** Kapak ile yanak arasındaki boşluk (kapak |z| < slab − zGap). */
  zGap: number;
  /** Pim ekseninin ön yüzeyden (z = 0) içeri uzaklığı. */
  pinInset: number;
  bodyStations: number;
  doorStations: number;
  innerStations: number;
  bodyCols: SlotColumns;
  doorCols: { rear: number; front: number };
}

export interface SlotDoorGeometry {
  bodySkin: BufferGeometry;
  /** Yanak iç yüzleri + dikiş yüzü (koyu boşluk malzemesi). */
  bodyCavity: BufferGeometry;
  doorOuter: BufferGeometry;
  doorInner: BufferGeometry;
  /** Kapağın yan (z = ±(slab − zGap)) ve üst (dikiş) kenar yüzleri. */
  doorEdges: BufferGeometry;
  /** Pim ekseni noktası (z = 0) — kapak grubunun orijini. */
  pin: Vector3;
  /** Dikiş istasyonu çerçevesi. */
  split: LoftFrame;
  /** Gövde dikiş yüzü ve kapak üst yüzü istasyonları. */
  uBody: number;
  uDoor: number;
  /** Pim ekseninin gövde (yanak) derisinden çıktığı iki nokta ve oradaki yüzey normali. */
  pinEnds: { p: Vector3; n: Vector3 }[];
  /** Kapak dış derisi üzerinde nokta (u, θ) — çapa / tırnak çentiği için (pahlama uygulanmış). */
  doorSurface(u: number, theta: number): { point: Vector3; normal: Vector3 };
}

/* ------------------------------------------------------------------------------------------------ */

interface Ring {
  u: number;
  frame: LoftFrame;
  thetas: number[];
  pts: Vector3[];
  /** Kenar sütunlarının indisleri: arka-iç, arka-dış, ön-dış, ön-iç. */
  rI: number;
  rO: number;
  fO: number;
  fI: number;
  /** Sütun j'nin ait olduğu bölüm: 0 arka şerit, 1 dış yanak, 2 ön şerit, 3 iç yanak. */
  seg: number[];
}

function sectionAB(spec: LoftSpec, u: number, theta: number): [number, number] {
  if (spec.section) return spec.section(theta, u);
  return [Math.cos(theta), Math.sin(theta)];
}

function sectionPoint(spec: LoftSpec, frame: LoftFrame, u: number, theta: number, out = new Vector3()): Vector3 {
  const { ry, rz } = loftRadii(spec, u);
  const [a, b] = sectionAB(spec, u, theta);
  return out.copy(frame.p).addScaledVector(frame.n, ry * a).addScaledVector(frame.b, rz * b);
}

const sectionZ = (spec: LoftSpec, u: number, theta: number): number => loftRadii(spec, u).rz * sectionAB(spec, u, theta)[1];

/** [lo, hi] aralığında g(θ) = hedef (g monoton) — ikiye bölme. */
function solveMonotone(g: (x: number) => number, lo: number, hi: number, target: number): number {
  const glo = g(lo) - target;
  for (let i = 0; i < 48; i++) {
    const m = (lo + hi) / 2;
    const gm = g(m) - target;
    if (Math.sign(gm) === Math.sign(glo)) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

/** İstasyondaki şerit kenar açıları (|z| = zc); kesit o yükseklikte bitmiyorsa kenar ±π/2'de birleşir. */
function edgeAngles(spec: LoftSpec, u: number, zc: number): { rO: number; fO: number; fI: number; rI: number } {
  const zTop = sectionZ(spec, u, Math.PI / 2);
  const zBot = sectionZ(spec, u, (3 * Math.PI) / 2);
  const z = (th: number): number => sectionZ(spec, u, th);
  // Tepe noktasında z düz olduğundan, birleşme istasyonunda kenarlar tam ±π/2'ye oturtulur
  const tol = zc * 1e-6;
  let rO = Math.PI / 2;
  let fO = Math.PI / 2;
  if (zTop > zc + tol) {
    rO = solveMonotone(z, 0, Math.PI / 2, zc);
    fO = solveMonotone(z, Math.PI / 2, Math.PI, zc);
  }
  let fI = (3 * Math.PI) / 2;
  let rI = (3 * Math.PI) / 2;
  if (zBot < -zc - tol) {
    fI = solveMonotone(z, Math.PI, (3 * Math.PI) / 2, -zc);
    rI = solveMonotone(z, (3 * Math.PI) / 2, TAU, -zc);
  }
  return { rO, fO, fI, rI };
}

function buildRing(spec: LoftSpec, u: number, zc: number, cols: SlotColumns, adjust?: (p: Vector3) => void): Ring {
  const frame = loftFrame(spec.spine, spec.ref, u);
  const e = edgeAngles(spec, u, zc);
  const thetas: number[] = [];
  const seg: number[] = [];
  const push = (a: number, b: number, n: number, s: number): void => {
    for (let i = 0; i < n; i++) {
      thetas.push(a + ((b - a) * i) / n);
      seg.push(s);
    }
  };
  push(e.rI - TAU, e.rO, cols.rear, 0);
  push(e.rO, e.fO, cols.outerCheek, 1);
  push(e.fO, e.fI, cols.front, 2);
  push(e.fI, e.rI, cols.innerCheek, 3);
  const pts = thetas.map((th) => {
    const p = sectionPoint(spec, frame, u, th);
    adjust?.(p);
    return p;
  });
  const rO = cols.rear;
  const fO = rO + cols.outerCheek;
  const fI = fO + cols.front;
  return { u, frame, thetas, pts, rI: 0, rO, fO, fI, seg };
}

/** Kesitin |z| ≤ zc içine tamamen girdiği u (alt uçta, `side` = +1 dış / −1 iç yüz). */
function fullU(spec: LoftSpec, zc: number, side: 1 | -1, uMax: number): number {
  const g = (u: number): number => Math.abs(sectionZ(spec, u, side > 0 ? Math.PI / 2 : (3 * Math.PI) / 2));
  if (g(uMax) <= zc) return uMax;
  return solveMonotone(g, spec.uFrom, uMax, zc);
}

/** [u0, u1] kosinüs dağılımı + ek istasyonlar (çok yakın olanlar ayıklanır). */
function stationList(u0: number, u1: number, n: number, extra: number[]): number[] {
  const base: number[] = [];
  for (let i = 0; i <= n; i++) base.push(u0 + (u1 - u0) * (0.5 - 0.5 * Math.cos((Math.PI * i) / n)));
  const must = extra.filter((x) => x > u0 && x < u1);
  const minGap = ((u1 - u0) / n) * 0.3;
  const kept = base.filter((x, i) => i === 0 || i === n || must.every((m) => Math.abs(m - x) > minGap));
  return [...new Set([...kept, ...must])].sort((a, b) => a - b);
}

/* ---- geometri biriktirici ---- */

class Soup {
  readonly pos: number[] = [];
  readonly idx: number[] = [];
  /** İndeksli ızgara bloğu ekler (noktalar paylaşılır → yumuşak gölgeleme). */
  grid(rings: Ring[], include: (i: number, seg: number) => boolean, flip = false): void {
    const N = rings[0]!.pts.length;
    const b = this.pos.length / 3;
    for (const r of rings) for (const p of r.pts) this.pos.push(p.x, p.y, p.z);
    for (let i = 0; i < rings.length - 1; i++) {
      const r0 = rings[i]!;
      const r1 = rings[i + 1]!;
      for (let j = 0; j < N; j++) {
        const j1 = (j + 1) % N;
        if (!include(i, r0.seg[j]!)) continue;
        // Sıfır genişlikli (birleşmiş kenar) hücreleri atla
        if (r0.pts[j]!.distanceToSquared(r0.pts[j1]!) < 1e-14 && r1.pts[j]!.distanceToSquared(r1.pts[j1]!) < 1e-14) continue;
        const a = b + i * N + j;
        const bb = b + i * N + j1;
        const c = b + (i + 1) * N + j;
        const d = b + (i + 1) * N + j1;
        if (flip) this.idx.push(a, d, bb, a, c, d);
        else this.idx.push(a, bb, d, a, d, c);
      }
    }
  }
  /** Düzlemsel çokgen (köşeler sırayla); normal `want` yönüne çevrilir. Köşeler paylaşılmaz (düz gölgeleme). */
  planar(points: Vector3[], ax: Vector3, ay: Vector3, want: Vector3): void {
    const pts: Vector3[] = [];
    for (const p of points) if (pts.length === 0 || pts[pts.length - 1]!.distanceToSquared(p) > 1e-14) pts.push(p);
    while (pts.length > 2 && pts[0]!.distanceToSquared(pts[pts.length - 1]!) < 1e-14) pts.pop();
    if (pts.length < 3) return;
    const o = pts[0]!;
    const flat = pts.map((p) => new Vector2(p.clone().sub(o).dot(ax), p.clone().sub(o).dot(ay)));
    const tris = ShapeUtils.triangulateShape(flat, []);
    const b = this.pos.length / 3;
    for (const p of pts) this.pos.push(p.x, p.y, p.z);
    const ab = new Vector3();
    const ac = new Vector3();
    for (const t of tris) {
      const [i, j, k] = t as [number, number, number];
      ab.subVectors(pts[j]!, pts[i]!);
      ac.subVectors(pts[k]!, pts[i]!);
      if (ab.cross(ac).dot(want) >= 0) this.idx.push(b + i, b + j, b + k);
      else this.idx.push(b + i, b + k, b + j);
    }
  }
  geometry(flatShade: boolean): BufferGeometry {
    let g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setIndex(this.idx);
    if (flatShade) g = g.toNonIndexed();
    g.computeVertexNormals();
    return g;
  }
}

/* ------------------------------------------------------------------------------------------------ */

export function buildSlotDoor(P: SlotDoorParams): SlotDoorGeometry {
  const spine = P.body.spine;
  const L = spine.getLength();
  const uBody = P.uSplit + P.gapBody / L;
  const uDoor = P.uSplit - P.gapDoor / L;
  const split = loftFrame(spine, P.body.ref, P.uSplit);
  const ry0 = loftRadii(P.body, P.uSplit).ry;
  // Pim: dikiş istasyonunun ön noktası (a = −1, z = 0), yüzeyden pinInset içeride
  const pin = split.p.clone().addScaledVector(split.n, -(ry0 - P.pinInset));
  const ef = split.n.clone().negate(); // ön
  const eu = split.t.clone(); // yukarı

  /* ---- gövde derisi ---- */
  const w = P.slab;
  const bodyU = stationList(0, 1, P.bodyStations, [uBody, fullU(P.body, w, 1, uBody), fullU(P.body, w, -1, uBody)]);
  const bodyRings = bodyU.map((u) => buildRing(P.body, u, w, P.bodyCols));
  const iSplit = bodyU.indexOf(uBody);
  const skin = new Soup();
  // Şerit hücreleri (0 arka, 2 ön) dikiş yüzünün altında çıkarılır
  skin.grid(bodyRings, (i, s) => s === 1 || s === 3 || i >= iSplit);

  /* ---- yanak iç yüzleri + dikiş yüzü ---- */
  const cav = new Soup();
  const Z = new Vector3(0, 0, 1);
  for (const side of [1, -1] as const) {
    const colF = side > 0 ? 'fO' : 'fI';
    const colR = side > 0 ? 'rO' : 'rI';
    const poly: Vector3[] = [];
    for (let i = iSplit; i >= 0; i--) {
      const r = bodyRings[i]!;
      const p = r.pts[r[colF]]!;
      if (Math.abs(p.z - side * w) > 1e-6) break; // kenar yok (kesit dilimin içinde)
      poly.push(p);
    }
    const back: Vector3[] = [];
    for (let i = iSplit; i >= 0; i--) {
      const r = bodyRings[i]!;
      const p = r.pts[r[colR]]!;
      if (Math.abs(p.z - side * w) > 1e-6) break;
      back.push(p);
    }
    poly.push(...back.reverse());
    // Yanak iç yüzü dilime (−side·Z) bakar
    cav.planar(poly, new Vector3(1, 0, 0), new Vector3(0, 1, 0), Z.clone().multiplyScalar(-side));
  }
  {
    const r = bodyRings[iSplit]!;
    const poly: Vector3[] = [];
    for (let j = r.fO; j <= r.fI; j++) poly.push(r.pts[j]!);
    for (let j = r.rI; j <= r.rO; j++) poly.push(r.pts[j]!);
    cav.planar(poly, r.frame.n, r.frame.b, r.frame.t.clone().negate());
  }

  /* ---- kapak: dış deri (pahlı), iç deri, kenarlar ---- */
  const zc = w - P.zGap;
  // Gövde dikiş yüzünün pimin önündeki en alçak noktası (pime göre, dikiş çerçevesinde). Omurga eğri olduğundan
  // dikiş yüzünün ön kenarı gapBody'den biraz alçakta kalabilir; pah sınırı bununla hesaplanır (aksi halde 90°'de
  // kapağın ön-üst köşesi dikiş yüzünün ön kenarına ~0.05 mm girer — tests/viewer-door.test.ts ters yön denetimi).
  let gapFront = P.gapBody;
  for (const p of bodyRings[iSplit]!.pts) {
    const d = p.clone().sub(pin);
    if (d.dot(ef) >= 0) gapFront = Math.min(gapFront, d.dot(eu));
  }
  const chamfer = (q: Vector3): void => {
    const d = q.clone().sub(pin);
    const x = d.dot(ef);
    const y = d.dot(eu);
    const lim = gapFront - 0.004 + Math.max(0, -y - P.pinInset);
    if (x > lim) q.addScaledVector(ef, lim - x);
  };
  const dCols: SlotColumns = { rear: P.doorCols.rear, outerCheek: 1, front: P.doorCols.front, innerCheek: 1 };
  const doorU = stationList(0, uDoor, P.doorStations, [fullU(P.body, zc, 1, uDoor), fullU(P.body, zc, -1, uDoor)]);
  const outerRings = doorU.map((u) => buildRing(P.body, u, zc, dCols, chamfer));
  const u0i = P.inner.uFrom;
  const innerU = stationList(u0i, uDoor, P.innerStations, [fullU(P.inner, zc, 1, uDoor), fullU(P.inner, zc, -1, uDoor)]);
  const innerRings = innerU.map((u) => buildRing(P.inner, u, zc, dCols));
  const outer = new Soup();
  outer.grid(outerRings, (_i, s) => s === 0 || s === 2);
  const inner = new Soup();
  inner.grid(innerRings, (_i, s) => s === 0 || s === 2, true);

  const edges = new Soup();
  const edgeCol = (rings: Ring[], col: 'fO' | 'rO' | 'fI' | 'rI', zs: number): Vector3[] => {
    const out: Vector3[] = [];
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]!;
      const p = r.pts[r[col]]!;
      if (Math.abs(p.z - zs) > 1e-6) break;
      out.push(p);
    }
    return out; // üstten aşağı
  };
  for (const side of [1, -1] as const) {
    const zs = side * zc;
    const oF = edgeCol(outerRings, side > 0 ? 'fO' : 'fI', zs);
    const oR = edgeCol(outerRings, side > 0 ? 'rO' : 'rI', zs);
    const iF = edgeCol(innerRings, side > 0 ? 'fO' : 'fI', zs);
    const iR = edgeCol(innerRings, side > 0 ? 'rO' : 'rI', zs);
    const poly = [...oF, ...oR.reverse(), ...iR, ...iF.reverse()];
    edges.planar(poly, new Vector3(1, 0, 0), new Vector3(0, 1, 0), Z.clone().multiplyScalar(side));
  }
  {
    const ro = outerRings[outerRings.length - 1]!;
    const ri = innerRings[innerRings.length - 1]!;
    const up = ro.frame.t.clone();
    const front: Vector3[] = [];
    for (let j = ro.fO; j <= ro.fI; j++) front.push(ro.pts[j]!);
    for (let j = ri.fI; j >= ri.fO; j--) front.push(ri.pts[j]!);
    edges.planar(front, ro.frame.n, ro.frame.b, up);
    const rear: Vector3[] = [];
    for (let j = ro.rI; j <= ro.rO; j++) rear.push(ro.pts[j]!);
    for (let j = ri.rO; j >= ri.rI; j--) rear.push(ri.pts[j]!);
    edges.planar(rear, ro.frame.n, ro.frame.b, up);
  }

  /* ---- pim uçları: dikiş istasyonunda, pimin n-konumunda kesit derisi ---- */
  const pinEnds: { p: Vector3; n: Vector3 }[] = [];
  {
    const aPin = -(ry0 - P.pinInset) / ry0; // kesit a-koordinatı
    for (const side of [1, -1] as const) {
      const lo = side > 0 ? Math.PI / 2 : Math.PI;
      const hi = side > 0 ? Math.PI : (3 * Math.PI) / 2;
      const th = solveMonotone((t) => sectionAB(P.body, P.uSplit, t)[0], lo, hi, aPin);
      const p = sectionPoint(P.body, split, P.uSplit, th);
      const e = 1e-3;
      const dth = sectionPoint(P.body, split, P.uSplit, th + e).sub(sectionPoint(P.body, split, P.uSplit, th - e));
      const nrm = new Vector3().crossVectors(split.t, dth).normalize();
      if (nrm.z * side < 0) nrm.negate();
      pinEnds.push({ p, n: nrm });
    }
  }

  const doorSurface = (u: number, theta: number): { point: Vector3; normal: Vector3 } => {
    const f = loftFrame(spine, P.body.ref, u);
    const point = sectionPoint(P.body, f, u, theta);
    const e = 1e-3;
    const dth = sectionPoint(P.body, f, u, theta + e).sub(sectionPoint(P.body, f, u, theta - e));
    const du = sectionPoint(P.body, loftFrame(spine, P.body.ref, u + e), u + e, theta).sub(sectionPoint(P.body, loftFrame(spine, P.body.ref, u - e), u - e, theta));
    const normal = new Vector3().crossVectors(dth, du).normalize();
    chamfer(point);
    return { point, normal };
  };

  return {
    bodySkin: skin.geometry(false),
    bodyCavity: cav.geometry(true),
    doorOuter: outer.geometry(false),
    doorInner: inner.geometry(false),
    doorEdges: edges.geometry(true),
    pin,
    split,
    uBody,
    uDoor,
    pinEnds,
    doorSurface,
  };
}
