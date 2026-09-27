/**
 * Kulak arkası gövdeli modeller: RIC (312 pil) ve BTE (13 pil). Tamamen parametrik, markasız.
 *
 * Ölçek: 1 sahne birimi = 10 mm. Eksenler (model uzayı): +X yüze/kulak kanalına doğru (ön),
 * +Y yukarı (kablo/kanca çıkışı), +Z dışa bakan yüz (kafanın tersi). Omurga XY düzlemindedir;
 * kesit çerçevesi n = Z × t → +n = arka sırt (düğmeler, mikrofon portları), −n = ön (kafaya bakan).
 *
 * Pil kapağı (gerçek cihazlardaki gibi ALTTAN açılan çekmece, bkz. `slot-door.ts`): gövdenin iki yan
 * duvarı (yanaklar) alt uca kadar tam kalır; aralarındaki dilimde, dikiş hattının altında U biçimli
 * kapak oturur (ön şerit + alt uç + arka şerit). Menteşe pimi dikiş hattının ÖN ucunda, ekseni yan
 * yüzlere dik (Z): kapak profil düzleminde ≈ 90° döner, alt ucu öne çıkar; pil kapağın beşiğinde
 * birlikte döner ve yanakların arasından tamamen dışarı çıkar (yan görünüşte etiketli yüzü görünür).
 * Kapanışta aynı yayla yuvasına geri girer. Hiçbir ara pozda pil/kapak gövdeye girmez
 * (`tests/viewer-door.test.ts`).
 */
import {
  BufferGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  Matrix4,
  Quaternion,
  Shape,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildLoft, loftFrame, loftPoint, loftRadii, loftSurface, type LoftSpec } from './loft.ts';
import { makeMaterial, type MaterialKind } from './materials.ts';
import { addBattery, addMesh, BATTERY_SPEC, type BatterySize, clamp01, createModelDraft, finalizeModel, localizeTo, type ModelDraft, type PartDraft, smoothstep } from './parts.ts';
import { buildSlotDoor } from './slot-door.ts';
import { type DeviceModel, PART_IDS } from './types.ts';

const UP = new Vector3(0, 1, 0);
const Z_AXIS = new Vector3(0, 0, 1);

const quatFromTo = (from: Vector3, to: Vector3): Quaternion => new Quaternion().setFromUnitVectors(from, to.clone().normalize());
/** (x, y, z) tabanından dönüş quaternion'u (sağ el sistemi olmalı). */
const basisQuat = (x: Vector3, y: Vector3, z: Vector3): Quaternion => new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));

/** İşaretli üslü kuvvet (süperelips profili için). */
const spow = (x: number, e: number): number => Math.sign(x) * Math.pow(Math.abs(x), e);

/**
 * Gövde kesiti. Alt bölge (pil yuvası, u < ≈0.3): Z'ye göre SİMETRİK yuvarlatılmış dikdörtgen
 * (süperelips p = `pLow`) → yanaklar ön/arka kenara kadar uzanır, pim yanaklara oturur. Yukarı doğru
 * elipse (p = 2) geçer; orada sırtta damla (dar) ve iç (−Z) yüzde hafif düzleşme eklenir.
 */
function makeBodySection(pLow: number, rearBulge?: (u: number) => number): (theta: number, u: number) => [number, number] {
  return (theta, u) => {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const k = smoothstep(0.3, 0.6, u);
    const p = pLow + (2 - pLow) * k;
    const e = 2 / p;
    const a = spow(c, e);
    return [c > 0 && rearBulge ? a * (1 + rearBulge(u)) : a, spow(s, e) * bodyShape(c, s, k)];
  };
}

/** Kesit modülasyonu (k = üst gövde ağırlığı): sırtta damla, iç yüzde düzleşme. */
function bodyShape(c: number, s: number, k: number): number {
  const teardrop = 0.12 * Math.max(0, c);
  const f = clamp01((0.2 - s) / 0.6);
  const flat = 0.09 * (f * f * (3 - 2 * f));
  return 1 - k * (teardrop + flat);
}

/** Loft yüzey normali (sayısal; θ ve u türevlerinin çapraz çarpımı, dışa doğru). */
function loftNormal(spec: LoftSpec, u: number, theta: number): Vector3 {
  const e = 1e-3;
  const p = (uu: number, th: number): Vector3 => loftPoint(spec, loftFrame(spec.spine, spec.ref, uu), uu, th);
  const du = p(Math.min(1, u + e), theta).sub(p(Math.max(0, u - e), theta));
  const dth = p(u, theta + e).sub(p(u, theta - e));
  return new Vector3().crossVectors(dth, du).normalize();
}

interface CurvedParams {
  spine: Vector3[];
  radii: (u: number) => { ry: number; rz: number };
  /** Alt gövde kesitinin süperelips üssü (≈ 3.5 → yuvarlatılmış dikdörtgen). */
  pLow: number;
  /** Arka (sırt) yarının ek dolgunluğu (u'ya göre, 0 = simetrik): klasik BTE'nin dolgun sırtı. */
  rearBulge?: (u: number) => number;
  battery: BatterySize;
  /** Pil merkezinin alt uçtan omurga boyunca uzaklığı (birim). Dikiş bundan türetilir. */
  batteryLift: number;
  /** Pil üstü ile kapak üst yüzü arasındaki pay (birim). */
  batteryTop: number;
  /** Menteşe pimi ekseninin ön yüzeyden içeri uzaklığı (birim). */
  pinInset: number;
  /** Kapak paneli kalınlığı (birim). */
  panel: number;
  /** Alt ve üst uç yuvarlatması: uzunluk (birim) ve süperelips üssü. */
  bottomCap: { length: number; power: number };
  topCap: { length: number; power: number };
  micU: [number, number];
  /** Açılış açısı (radyan). */
  doorAngle: number;
  doorExplode: number;
  batteryExplode: number;
  /** Gövde yüzeyi ve kapak iç yüzü malzemeleri. */
  finish: MaterialKind;
  finishInner: MaterialKind;
}

interface CurvedBase {
  spine: CatmullRomCurve3;
  L: number;
  uSplit: number;
  /** Yüzey sorguları için tüm gövde (0..1) loft tanımı. */
  query: LoftSpec;
  tip: Vector3;
  tipT: Vector3;
  body: PartDraft;
}

const GAP = 0.012; // dikiş aralığı yarısı: 0.12 mm (toplam 0.24 mm)

function buildCurvedBase(md: ModelDraft, P: CurvedParams): CurvedBase {
  const spine = new CatmullRomCurve3(P.spine, false, 'centripetal');
  const L = spine.getLength();
  const radial = 44;
  const { radius: R, thickness: h } = BATTERY_SPEC[P.battery];
  const section = makeBodySection(P.pLow, P.rearBulge);

  const query: LoftSpec = {
    spine,
    ref: Z_AXIS,
    uFrom: 0,
    uTo: 1,
    radii: P.radii,
    section,
    capStart: { kind: 'round', length: P.bottomCap.length / L, power: P.bottomCap.power },
    capEnd: { kind: 'round', length: P.topCap.length, power: P.topCap.power },
    stations: 0,
    radial,
  };

  // Pil merkezi omurga üzerinde; dikiş, pilin üstünden `batteryTop + GAP` yukarıda (dikişe dik ölçü)
  const uB = P.batteryLift / L;
  const batteryCenter = spine.getPointAt(uB);
  const splitGap = (u: number): number => spine.getPointAt(u).sub(batteryCenter).dot(spine.getTangentAt(u).normalize()) - (R + P.batteryTop + GAP);
  let lo = uB;
  let hi = Math.min(0.6, uB + (3 * R) / L);
  for (let i = 0; i < 48; i++) {
    const m = (lo + hi) / 2;
    if (splitGap(m) < 0) lo = m;
    else hi = m;
  }
  const uSplit = (lo + hi) / 2;
  const uDoor = uSplit - GAP / L;
  // Kapak iç yüzü: radii panel kalınlığı kadar küçük, alt ucu ~1.2 panel yukarıda
  const u0Inner = (1.2 * P.panel) / L;
  const inner: LoftSpec = {
    spine,
    ref: Z_AXIS,
    uFrom: u0Inner,
    uTo: uDoor,
    radii: (u) => {
      const r = P.radii(u);
      return { ry: Math.max(0.01, r.ry - P.panel), rz: Math.max(0.01, r.rz - P.panel) };
    },
    section,
    capStart: { kind: 'round', length: P.bottomCap.length / L / (uDoor - u0Inner), power: P.bottomCap.power },
    capEnd: { kind: 'open' },
    stations: 0,
    radial,
  };
  const slab = h / 2 + 0.025; // yanak iç yüzleri: pilin iki yanında 0.25 mm
  const G = buildSlotDoor({
    body: query,
    inner,
    uSplit,
    gapDoor: GAP,
    gapBody: GAP,
    slab,
    zGap: 0.01,
    pinInset: P.pinInset,
    bodyStations: 60,
    doorStations: 26,
    innerStations: 22,
    bodyCols: { rear: 8, outerCheek: 14, front: 8, innerCheek: 14 },
    doorCols: { rear: 10, front: 10 },
  });
  const sf = G.split;
  const ef = sf.n.clone().negate(); // ön
  const eu = sf.t.clone(); // yukarı
  md.connectors.seam = { p: sf.p.clone(), dir: sf.t.clone() };

  /* ---- body: deri + yanak iç yüzleri / dikiş yüzü (koyu yuva) + pim ---- */
  const body = md.part('body');
  const skin = addMesh(body, G.bodySkin, makeMaterial(P.finish));
  skin.name = 'body-skin';
  const cavity = addMesh(body, G.bodyCavity, makeMaterial('cavity'));
  cavity.name = 'body-cavity';
  cavity.castShadow = false;
  for (const m of [skin, cavity]) {
    m.userData.collision = 'solid';
    m.userData.collisionGroup = 'body';
  }
  {
    // Menteşe pimi: yanaklardan geçen ince çelik çubuk + yan yüzlerde pim başları
    const [a, b] = G.pinEnds as [{ p: Vector3; n: Vector3 }, { p: Vector3; n: Vector3 }];
    const len = a.p.z - b.p.z;
    const rod = addMesh(body, new CylinderGeometry(0.011, 0.011, len - 0.01, 10), makeMaterial('screw'));
    rod.quaternion.copy(quatFromTo(UP, Z_AXIS));
    rod.position.set(G.pin.x, G.pin.y, (a.p.z + b.p.z) / 2);
    rod.castShadow = false;
    for (const e of G.pinEnds) {
      const cap = addMesh(body, new CylinderGeometry(0.026, 0.026, 0.02, 16), makeMaterial('screw'));
      cap.quaternion.copy(quatFromTo(UP, e.n));
      cap.position.copy(e.p).addScaledVector(e.n, -0.007);
      cap.castShadow = false;
    }
  }
  {
    const f = loftFrame(spine, Z_AXIS, 0.55);
    const { rz } = loftRadii(query, 0.55);
    body.anchorLocal.copy(f.p).addScaledVector(f.b, rz * bodyShape(0, 1, 1));
    body.anchorNormal.set(0, 0, 1);
  }

  /* ---- battery-door: U biçimli çekmece (dış deri + iç deri + kenarlar) + beşik + tırnak çentiği ---- */
  const door = md.part('battery-door');
  const outer = addMesh(door, G.doorOuter, makeMaterial(P.finish));
  outer.name = 'door-outer';
  const innerMesh = addMesh(door, G.doorInner, makeMaterial(P.finishInner));
  const edges = addMesh(door, G.doorEdges, makeMaterial(P.finishInner));
  for (const m of [outer, innerMesh, edges]) {
    m.userData.collision = 'door';
    m.userData.collisionGroup = 'door-panel';
  }
  // Beşik: pilin alt yarısını kenarından saran koyu halka dilimi (açıkken pilin öndeki ucunu tutar)
  {
    const a0 = Math.PI * 1.04;
    const a1 = Math.PI * 1.96;
    const r0 = R + 0.006;
    const r1 = R + 0.032;
    const shape = new Shape();
    shape.absarc(0, 0, r1, a0, a1, false);
    shape.absarc(0, 0, r0, a1, a0, true);
    shape.closePath();
    const depth = h + 0.02;
    const cradle = addMesh(door, new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 28 }), makeMaterial('matte'));
    cradle.quaternion.copy(basisQuat(ef, eu, Z_AXIS));
    cradle.position.copy(batteryCenter).addScaledVector(Z_AXIS, -depth / 2);
    cradle.castShadow = false;
  }
  // Tırnak çentiği: arka şeritte, dikişin hemen altında enine koyu oluk
  {
    const { point, normal } = G.doorSurface(uDoor - 0.05 / L, 0);
    const notch = addMesh(door, new RoundedBoxGeometry(0.05, 0.036, 2 * (slab - 0.01) * 0.62, 2, 0.012), makeMaterial('portDark'));
    const t = new Vector3().crossVectors(Z_AXIS, normal).normalize();
    notch.quaternion.copy(basisQuat(t.negate(), normal, Z_AXIS));
    notch.position.copy(point).addScaledVector(normal, -0.012);
    notch.castShadow = false;
  }
  {
    // Çapa: arka şeridin ortası (yüzey normali ile dış yan yüz arası → ana bakışta görünür)
    const { point, normal } = G.doorSurface(0.55 * uDoor, 0);
    door.anchorLocal.copy(point).sub(G.pin);
    door.anchorNormal.copy(normal).add(Z_AXIS).normalize();
    door.explodeDirection.copy(ef).multiplyScalar(0.55).addScaledVector(eu, -0.85).normalize();
    door.explodeDistance = P.doorExplode;
  }
  localizeTo(door, G.pin);

  /* ---- battery: kapak çocuğu, ekseni Z (yuvarlak yüz yan yüzlere paralel), etiket dış (+Z) yüzde ---- */
  const battery = md.part('battery', 'body', door);
  addBattery(battery, P.battery, 1);
  battery.group.position.copy(batteryCenter).sub(G.pin);
  battery.anchorLocal.set(0, 0, h / 2 + 0.012);
  battery.anchorNormal.set(0, 0, 1);
  // Parçalanma: kapak öne-aşağı; pil kapağın açık yanından dışarı (+Z) → gövde — kapak — pil
  battery.explodeDirection.copy(Z_AXIS).multiplyScalar(0.9).addScaledVector(ef, 0.25).addScaledVector(eu, -0.2).normalize();
  battery.explodeDistance = P.batteryExplode;

  // Pim ekseni +Z: pozitif açı kapağın alt ucunu ÖNE (+X) çıkarır. Kayma yok (pil beşikte sabit).
  md.door.axis.set(0, 0, 1);
  md.door.angle = P.doorAngle;
  md.door.slideDir.copy(eu);
  md.door.slideDistance = 0;

  /* ---- mics: sırt üst ucunda iki port ---- */
  const mics = md.part('mics');
  for (const u of P.micU) {
    const { point, normal, frame } = loftSurface(query, u, 'top');
    const slot = addMesh(mics, new RoundedBoxGeometry(0.13, 0.022, 0.095, 3, 0.012), makeMaterial('portDark'));
    slot.quaternion.copy(basisQuat(frame.t, frame.n, frame.b));
    slot.position.copy(point).addScaledVector(normal, 0.003);
  }
  {
    const mid = loftSurface(query, (P.micU[0] + P.micU[1]) / 2, 'top');
    mics.anchorLocal.copy(mid.point).addScaledVector(mid.frame.b, 0.09);
    mics.anchorNormal.copy(mid.frame.n).multiplyScalar(0.4).addScaledVector(mid.frame.t, 0.2).add(Z_AXIS).normalize();
    mics.explodeDirection.copy(mid.frame.n).multiplyScalar(0.5).addScaledVector(mid.frame.t, 0.8).addScaledVector(Z_AXIS, 0.15).normalize();
    mics.explodeDistance = 0.45;
  }

  return { spine, L, uSplit, query, tip: spine.getPointAt(1), tipT: spine.getTangentAt(1).normalize(), body };
}

/** Sırt üzerinde yarı gömülü basma düğmesi / rocker. */
function addSpineButton(draft: PartDraft, query: LoftSpec, u: number, length: number, width: number, groove: boolean): void {
  const { point, normal, frame } = loftSurface(query, u, 'top');
  const geo = new RoundedBoxGeometry(length, 0.07, width, 4, 0.032);
  const mesh = addMesh(draft, geo, makeMaterial('matte'));
  mesh.quaternion.copy(basisQuat(frame.t, frame.n, frame.b));
  mesh.position.copy(point).addScaledVector(normal, 0.018);
  if (groove) {
    const g = addMesh(draft, new RoundedBoxGeometry(0.03, 0.02, width * 0.7, 2, 0.008), makeMaterial('portDark'));
    g.quaternion.copy(mesh.quaternion);
    g.position.copy(point).addScaledVector(normal, 0.048);
  }
}

/* ============================================================================
 * RIC — 312 pil
 * ========================================================================= */

export function buildRicModel(): DeviceModel {
  const md = createModelDraft('ric', PART_IDS.ric, new Vector3(-0.32, 0.16, 1), {
    axis: new Vector3(0, 0, 1),
    angle: (90 * Math.PI) / 180,
    slideDir: new Vector3(0, 1, 0),
    slideDistance: 0,
  });

  const base = buildCurvedBase(md, {
    spine: [
      new Vector3(-0.3, -1.4, 0),
      new Vector3(-0.5, -0.72, 0),
      new Vector3(-0.56, 0.0, 0),
      new Vector3(-0.46, 0.7, 0),
      new Vector3(-0.22, 1.4, 0),
    ],
    radii: (u) => ({
      ry: 0.47 + 0.02 * Math.sin(Math.PI * u) - 0.17 * smoothstep(0.35, 1, u),
      rz: 0.34 - 0.11 * smoothstep(0.3, 1, u),
    }),
    pLow: 3.4,
    battery: '312',
    batteryLift: 0.5,
    batteryTop: 0.012,
    pinInset: 0.035,
    panel: 0.055,
    bottomCap: { length: 0.26, power: 3.4 },
    topCap: { length: 0.17, power: 1.8 },
    micU: [0.78, 0.9],
    doorAngle: (90 * Math.PI) / 180,
    doorExplode: 1.0,
    batteryExplode: 0.85,
    finish: 'graphite',
    finishInner: 'graphiteInner',
  });
  const { query, tip, tipT } = base;

  /* ---- button: sırt ortasında ince uzun düğme ---- */
  {
    const d = md.part('button');
    addSpineButton(d, query, 0.5, 0.62, 0.18, false);
    const { point, normal, frame } = loftSurface(query, 0.5, 'top');
    d.anchorLocal.copy(point).addScaledVector(normal, 0.06);
    d.anchorNormal.copy(normal).add(Z_AXIS).normalize();
    d.explodeDirection.copy(frame.n);
    d.explodeDistance = 0.35;
  }

  /* ---- wire + receiver + dome: kablo kulağın üstünden öne, sonra kanala (içe-öne-aşağı) döner ---- */
  const recDir = new Vector3(0.5, -0.5, -0.7).normalize();
  /** Alıcının arka ucu (kablo girişi). */
  const inlet = new Vector3(1.66, -0.46, 0.06);
  const wireCurve = new CatmullRomCurve3(
    [
      tip.clone(),
      tip.clone().addScaledVector(tipT, 0.2),
      new Vector3(0.42, 1.8, 0.04),
      new Vector3(1.05, 1.62, 0.07),
      new Vector3(1.48, 1.05, 0.1),
      new Vector3(1.63, 0.3, 0.12),
      new Vector3(1.6, -0.2, 0.12),
      inlet.clone().addScaledVector(recDir, -0.1),
      inlet.clone().addScaledVector(recDir, 0.02),
    ],
    false,
    'centripetal',
  );
  const wireDir = new Vector3(1, 0.12, 0.08).normalize();

  {
    const d = md.part('wire', 'front');
    const cable = addMesh(d, new TubeGeometry(wireCurve, 96, 0.04, 10, false), makeMaterial('wire'));
    cable.name = 'wire-cable';
    // Konektör (gövde üstündeki kısa soket ucu); kök kısmı yuvarlak tepeye gömülü
    const boot = addMesh(d, new CylinderGeometry(0.072, 0.064, 0.22, 18), makeMaterial('matte'));
    boot.name = 'wire-connector';
    boot.quaternion.copy(quatFromTo(UP, tipT));
    boot.position.copy(tip).addScaledVector(tipT, 0.03);
    const mid = wireCurve.getPointAt(0.5);
    d.anchorLocal.copy(mid).add(new Vector3(0.012, 0, 0.045));
    d.anchorNormal.set(0.35, 0, 1).normalize();
    d.explodeDirection.copy(wireDir);
    d.explodeDistance = 0.32;
    md.connectors.wireExit = { p: tip.clone().addScaledVector(tipT, 0.14), dir: tipT.clone() };
  }

  const recCenter = inlet.clone().addScaledVector(recDir, 0.305);
  {
    const d = md.part('receiver', 'front');
    const mesh = addMesh(d, new CapsuleGeometry(0.125, 0.36, 6, 22), makeMaterial('titanium'));
    mesh.quaternion.copy(quatFromTo(UP, recDir));
    mesh.position.copy(recCenter);
    // Kablo girişindeki gerilim kılıfı
    const sleeve = addMesh(d, new CylinderGeometry(0.058, 0.08, 0.12, 16), makeMaterial('matte'));
    sleeve.quaternion.copy(quatFromTo(UP, recDir));
    sleeve.position.copy(inlet).addScaledVector(recDir, -0.02);
    const band = addMesh(d, new TorusGeometry(0.127, 0.011, 8, 26), makeMaterial('matte'));
    band.quaternion.copy(quatFromTo(Z_AXIS, recDir));
    band.position.copy(inlet).addScaledVector(recDir, 0.16);
    d.anchorLocal.copy(recCenter).add(new Vector3(0, 0.05, 0.13));
    d.anchorNormal.set(0.2, 0.2, 1).normalize();
    d.explodeDirection.copy(wireDir);
    d.explodeDistance = 0.68;
    md.connectors.wireInlet = { p: inlet.clone().addScaledVector(recDir, -0.08), dir: recDir.clone().negate() };
    md.connectors.receiverCenter = { p: recCenter.clone(), dir: recDir.clone() };
  }

  {
    const d = md.part('dome', 'front');
    const profile: Vector2[] = [
      new Vector2(0.13, 0.0),
      new Vector2(0.13, 0.3),
      new Vector2(0.1, 0.335),
      new Vector2(0.06, 0.345),
      new Vector2(0.06, 0.37),
      new Vector2(0.12, 0.372),
      new Vector2(0.19, 0.345),
      new Vector2(0.255, 0.29),
      new Vector2(0.305, 0.22),
      new Vector2(0.335, 0.15),
      new Vector2(0.335, 0.125),
      new Vector2(0.31, 0.13),
      new Vector2(0.285, 0.19),
      new Vector2(0.235, 0.255),
      new Vector2(0.175, 0.3),
      new Vector2(0.155, 0.3),
      new Vector2(0.155, 0.0),
      new Vector2(0.13, 0.0),
    ].map((p) => p.multiplyScalar(0.95));
    const mesh = addMesh(d, new LatheGeometry(profile, 40), makeMaterial('dome'));
    const domeBase = inlet.clone().addScaledVector(recDir, 0.45);
    mesh.quaternion.copy(quatFromTo(UP, recDir));
    mesh.position.copy(domeBase);
    d.anchorLocal.copy(domeBase).addScaledVector(recDir, 0.2).add(new Vector3(0.1, 0.12, 0.25));
    d.anchorNormal.set(0.3, 0.3, 1).normalize();
    const v = wireDir.clone().multiplyScalar(0.68).addScaledVector(recDir, 0.4);
    d.explodeDistance = v.length();
    d.explodeDirection.copy(v).normalize();
  }

  return finalizeModel(md);
}

/* ============================================================================
 * BTE — 13 pil, kanca + hortum + özel akrilik kulak kalıbı
 * ========================================================================= */

/** Açısal Gauss (θ çevresinde sarılı). */
const lobe = (theta: number, c: number, w: number): number => {
  let d = (theta - c) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return Math.exp(-(d / w) * (d / w));
};

interface EarmoldBuild {
  bowl: BufferGeometry;
  point: (theta: number, phi: number) => Vector3;
  normal: (theta: number, phi: number) => Vector3;
  /** Yanal yüz kalınlığı (merkezde) — bağlantı noktası için. */
  lateral: number;
}

/** Polinom yumuşak minimum (iki uzaklık alanının yuvarlatılmış birleşimi). */
const smin = (a: number, b: number, k: number): number => {
  const h = clamp01(0.5 + (0.5 * (b - a)) / k);
  return b + (a - b) * h - k * h * (1 - h);
};

/**
 * Konka çanağı (tam kabuk kalıp): yanal (dış) yüzü yassı, medial yüzü yuvarlak; dış hat
 * böbrek biçimli çanak (≈ 13 × 16 mm) + arka-üstte parmak biçimli heliks kilidi kolu (yumuşak
 * dolgu ile birleşik). Kalınlık ≈ 5.2 mm; kanal kökünde medial yüz şişkinleşir (kanal düzgün çıkar),
 * heliks kilidinde incelir. Parametrik: θ (Z etrafında, 0 = +X ön), φ (−π/2 medial … +π/2 yanal).
 */
function buildEarmoldBowl(C: Vector3, canalRoot: Vector2): EarmoldBuild {
  const tilt = 0.24; // uzun eksen üstte arkaya yatık
  const a = 0.64;
  const b = 0.8;
  const rEll = (th: number): number => {
    const t = th - tilt;
    const e = 1 / Math.sqrt((Math.cos(t) / a) ** 2 + (Math.sin(t) / b) ** 2);
    return e * (1 - 0.12 * lobe(th, -0.4, 0.42) + 0.04 * lobe(th, 0.75, 0.5));
  };
  // Heliks kilidi kolu: A0 → A1 kapsülü (C'ye göre), yarıçap ra
  const A0 = new Vector2(-0.15, 0.42);
  const A1 = new Vector2(-0.44, 0.94);
  const ra = 0.165;
  const sdCapsule = (q: Vector2): number => {
    const pa = q.clone().sub(A0);
    const ba = A1.clone().sub(A0);
    const hh = clamp01(pa.dot(ba) / ba.dot(ba));
    return pa.sub(ba.multiplyScalar(hh)).length() - ra;
  };
  const sdEll = (q: Vector2): number => q.length() - rEll(Math.atan2(q.y, q.x));
  const field = (q: Vector2): number => smin(sdEll(q), sdCapsule(q), 0.14);
  // Kutupsal dış hat: ışın boyunca alanın sıfırı (şekil C'ye göre yıldız biçimli)
  const rCache = new Map<number, number>();
  const r = (th: number): number => {
    const key = Math.round(th * 1e6);
    const hit = rCache.get(key);
    if (hit !== undefined) return hit;
    const d = new Vector2(Math.cos(th), Math.sin(th));
    let hi = 1.6;
    let lo = 0.05;
    for (let t = 1.6; t > 0.05; t -= 0.01) {
      if (field(d.clone().multiplyScalar(t)) < 0) {
        lo = t;
        hi = t + 0.01;
        break;
      }
    }
    for (let i = 0; i < 24; i++) {
      const m = (lo + hi) / 2;
      if (field(d.clone().multiplyScalar(m)) < 0) lo = m;
      else hi = m;
    }
    const res = (lo + hi) / 2;
    rCache.set(key, res);
    return res;
  };
  const armness = (q: Vector2): number => smoothstep(-0.04, 0.16, sdEll(q));
  const canalBump = (q: Vector2): number => Math.exp(-q.clone().sub(canalRoot).lengthSq() / (0.34 * 0.34));
  const tLat = (q: Vector2): number => 0.21 - 0.07 * armness(q);
  const tMed = (q: Vector2): number => 0.31 - 0.13 * armness(q) + 0.2 * canalBump(q);
  const PL = 3.1;
  const PM = 2.3;
  const point = (th: number, phi: number): Vector3 => {
    const lat = phi >= 0;
    const e = 2 / (lat ? PL : PM);
    const rr = r(th) * spow(Math.cos(phi), e);
    const q = new Vector2(rr * Math.cos(th), rr * Math.sin(th));
    const z = lat ? tLat(q) * spow(Math.sin(phi), e) : tMed(q) * spow(Math.sin(phi), e);
    return new Vector3(C.x + q.x, C.y + q.y, C.z + z);
  };
  const normal = (th: number, phi: number): Vector3 => {
    const e = 1e-3;
    const dth = point(th + e, phi).sub(point(th - e, phi));
    const dph = point(th, Math.min(Math.PI / 2, phi + e)).sub(point(th, Math.max(-Math.PI / 2, phi - e)));
    return new Vector3().crossVectors(dth, dph).normalize();
  };

  const NT = 96;
  const NP = 30;
  const pos: number[] = [];
  const idx: number[] = [];
  const south = point(0, -Math.PI / 2);
  pos.push(south.x, south.y, south.z);
  for (let i = 1; i < NP; i++) {
    const phi = -Math.PI / 2 + (Math.PI * i) / NP;
    for (let j = 0; j < NT; j++) {
      const p = point((2 * Math.PI * j) / NT, phi);
      pos.push(p.x, p.y, p.z);
    }
  }
  const north = point(0, Math.PI / 2);
  pos.push(north.x, north.y, north.z);
  const ring = (i: number, j: number): number => 1 + (i - 1) * NT + (((j % NT) + NT) % NT);
  const northIdx = 1 + (NP - 1) * NT;
  for (let j = 0; j < NT; j++) idx.push(0, ring(1, j + 1), ring(1, j));
  for (let i = 1; i < NP - 1; i++) {
    for (let j = 0; j < NT; j++) {
      const a0 = ring(i, j);
      const b0 = ring(i, j + 1);
      const c0 = ring(i + 1, j + 1);
      const d0 = ring(i + 1, j);
      idx.push(a0, b0, c0, a0, c0, d0);
    }
  }
  for (let j = 0; j < NT; j++) idx.push(ring(NP - 1, j), ring(NP - 1, j + 1), northIdx);
  const bowl = new BufferGeometry();
  bowl.setAttribute('position', new Float32BufferAttribute(pos, 3));
  bowl.setIndex(idx);
  bowl.computeVertexNormals();
  return { bowl, point, normal, lateral: tLat(new Vector2(0, 0)) };
}

/** Standart #13 BTE hortumu (dış / iç çap, mm) ve akrilik kanca dış çapı. Kulak illüstrasyonu bu değerleri anchors.json üzerinden (render-device-views.mjs → tubeOuterMm/tubeInnerMm) okur. */
export const BTE_TUBE_MM = { outer: 3.3, inner: 1.9 } as const;
export const BTE_HOOK_MM = { outer: 3.8, inner: 1.5 } as const;

export function buildBteModel(): DeviceModel {
  const md = createModelDraft('bte', PART_IDS.bte, new Vector3(-0.32, 0.16, 1), {
    axis: new Vector3(0, 0, 1),
    angle: (90 * Math.PI) / 180,
    slideDir: new Vector3(0, 1, 0),
    slideDistance: 0,
  });

  // Klasik BTE: RIC'ten ≈ 1,39 kat uzun (omurga ≈ 40,1 mm, RIC ≈ 28,8 mm) ve kalın (altta 12 × 9.2 mm), dolgun yuvarlak sırt,
  // üstte kancanın vidalandığı düz tabla. Açık şampanya / gümüş-bej metalik yüzey (RIC grafit kalır).
  const base = buildCurvedBase(md, {
    spine: [
      new Vector3(-0.22, -1.98, 0),
      new Vector3(-0.64, -0.98, 0),
      new Vector3(-0.8, 0.08, 0),
      new Vector3(-0.66, 1.06, 0),
      new Vector3(-0.3, 1.84, 0),
    ],
    radii: (u) => ({
      ry: 0.6 + 0.035 * Math.sin(Math.PI * Math.min(1, u / 0.7)) - 0.17 * smoothstep(0.55, 1, u),
      rz: 0.46 - 0.1 * smoothstep(0.35, 1, u),
    }),
    rearBulge: (u) => 0.1 * Math.sin(Math.PI * clamp01((u - 0.3) / 0.62)),
    pLow: 3.2,
    battery: '13',
    batteryLift: 0.51,
    batteryTop: 0.012,
    pinInset: 0.04,
    panel: 0.06,
    bottomCap: { length: 0.32, power: 3.2 },
    topCap: { length: 0.075, power: 2.8 },
    micU: [0.84, 0.93],
    doorAngle: (90 * Math.PI) / 180,
    doorExplode: 1.15,
    batteryExplode: 1.0,
    finish: 'champagne',
    finishInner: 'champagneInner',
  });
  const { query, tip, tipT, body } = base;
  md.root.userData.dims = { tubeOuterMm: BTE_TUBE_MM.outer, tubeInnerMm: BTE_TUBE_MM.inner, hookOuterMm: BTE_HOOK_MM.outer };

  // Üst tabla (kanca bağlantısı): gövdenin tepesinden çıkan kısa düz silindir + koyu ayrım çizgisi + dişli saplama
  const BOSS_R = 0.2;
  const BOSS_H = 0.07;
  const bossTop = tip.clone().addScaledVector(tipT, BOSS_H - 0.015);
  {
    const boss = addMesh(body, new CylinderGeometry(BOSS_R, BOSS_R + 0.012, BOSS_H + 0.03, 32), makeMaterial('champagne'));
    boss.quaternion.copy(quatFromTo(UP, tipT));
    boss.position.copy(tip).addScaledVector(tipT, (BOSS_H - 0.015) / 2 - 0.015);
    const line = addMesh(body, new TorusGeometry(BOSS_R + 0.004, 0.006, 6, 36), makeMaterial('portDark'));
    line.quaternion.copy(quatFromTo(Z_AXIS, tipT));
    line.position.copy(bossTop).addScaledVector(tipT, -0.012);
    line.castShadow = false;
    const stud = addMesh(body, new CylinderGeometry(0.085, 0.09, 0.2, 18), makeMaterial('steel'));
    stud.quaternion.copy(quatFromTo(UP, tipT));
    stud.position.copy(bossTop).addScaledVector(tipT, 0.08);
    for (const k of [0.06, 0.1, 0.14]) {
      const ridge = addMesh(body, new TorusGeometry(0.087, 0.007, 6, 20), makeMaterial('portDark'));
      ridge.quaternion.copy(quatFromTo(Z_AXIS, tipT));
      ridge.position.copy(bossTop).addScaledVector(tipT, k);
      ridge.castShadow = false;
    }
  }

  /* ---- button: program düğmesi (üstte, oval basma) + ses rocker'ı (altta, ortası oluklu) — tek parça ---- */
  {
    const d = md.part('button');
    addSpineButton(d, query, 0.72, 0.36, 0.26, false);
    addSpineButton(d, query, 0.55, 0.56, 0.2, true);
    const { point, normal, frame } = loftSurface(query, 0.64, 'top');
    d.anchorLocal.copy(point).addScaledVector(normal, 0.07);
    d.anchorNormal.copy(normal).add(Z_AXIS).normalize();
    d.explodeDirection.copy(frame.n);
    d.explodeDistance = 0.4;
  }

  /* ---- hook: tablaya vidalanan kalın şeffaf akrilik kanca (Ø3.8 mm, iç kanal Ø1.5 mm) + tırtıllı meme ---- */
  const HOOK_R = BTE_HOOK_MM.outer / 20;
  const HOOK_IN = BTE_HOOK_MM.inner / 20;
  const hookStart = bossTop.clone().addScaledVector(tipT, 0.2);
  const hookCurve = new CatmullRomCurve3(
    [
      hookStart,
      hookStart.clone().addScaledVector(tipT, 0.3),
      new Vector3(0.05, 2.62, 0.02),
      new Vector3(0.62, 2.74, 0.04),
      new Vector3(1.1, 2.44, 0.06),
      new Vector3(1.26, 1.92, 0.07),
    ],
    false,
    'centripetal',
  );
  const hookEnd = hookCurve.getPointAt(1);
  const hookEndT = hookCurve.getTangentAt(1).normalize();
  const NOZZLE = 0.44;
  const nozzleTip = hookEnd.clone().addScaledVector(hookEndT, NOZZLE);
  {
    const d = md.part('hook', 'front');
    addMesh(d, new TubeGeometry(hookCurve, 56, HOOK_R, 18, false), makeMaterial('clear')).name = 'hook-acrylic';
    const lumen = addMesh(d, new TubeGeometry(hookCurve, 56, HOOK_IN, 10, false), makeMaterial('lumen'));
    lumen.castShadow = false;
    // Kanca ucu: memeye geçişte akrilik halka yüzü (içte kanal ağzı)
    const endRing = addMesh(d, new TorusGeometry((HOOK_R + HOOK_IN) / 2, (HOOK_R - HOOK_IN) / 2, 8, 24), makeMaterial('clear'));
    endRing.quaternion.copy(quatFromTo(Z_AXIS, hookEndT));
    endRing.position.copy(hookEnd);
    // Kök: saplamaya vidalanan kısa koyu somun + ince metal dudak (tablaya oturur)
    const collarLen = 0.24;
    const collar = addMesh(d, new CylinderGeometry(0.19, 0.2, collarLen, 28), makeMaterial('matte'));
    collar.quaternion.copy(quatFromTo(UP, tipT));
    collar.position.copy(bossTop).addScaledVector(tipT, collarLen / 2 - 0.004);
    const lip = addMesh(d, new TorusGeometry(0.188, 0.012, 8, 30), makeMaterial('titanium'));
    lip.quaternion.copy(quatFromTo(Z_AXIS, tipT));
    lip.position.copy(bossTop).addScaledVector(tipT, collarLen - 0.004);
    // Meme: hortumun geçtiği tırtıllı (dikenli) uç — şeffaf hortumun içinden görünür
    const nozzleProfile = [
      new Vector2(0, 0),
      new Vector2(0.11, 0),
      new Vector2(0.105, 0.04),
      new Vector2(0.086, 0.07),
      new Vector2(0.086, 0.13),
      new Vector2(0.1, 0.17),
      new Vector2(0.086, 0.19),
      new Vector2(0.086, 0.26),
      new Vector2(0.1, 0.3),
      new Vector2(0.082, 0.32),
      new Vector2(0.078, NOZZLE - 0.015),
      new Vector2(0.06, NOZZLE),
      new Vector2(0, NOZZLE),
    ];
    const nozzle = addMesh(d, new LatheGeometry(nozzleProfile, 24), makeMaterial('wire', 0xe2e7ea));
    nozzle.quaternion.copy(quatFromTo(UP, hookEndT));
    nozzle.position.copy(hookEnd);
    const apex = hookCurve.getPointAt(0.5);
    d.anchorLocal.copy(apex).add(new Vector3(0, 0.02, HOOK_R));
    d.anchorNormal.set(0.1, 0.3, 1).normalize();
    d.explodeDirection.set(0.3, 1, 0).normalize();
    d.explodeDistance = 0.5;
    md.connectors.hookTip = { p: nozzleTip.clone(), dir: hookEndT.clone() };
  }

  /* ---- earmold: konka çanağı + kanal gövdesi + ses/vent delikleri + hortum yuvası ve kilidi ---- */
  const C = new Vector3(1.74, -0.74, 0.0);
  const canalRoot = new Vector2(0.26, 0.06);
  const mold = buildEarmoldBowl(C, canalRoot);
  const TH_IN = 1.36; // hortum girişi: çanağın üst kenarı, kanal kökünün üstü
  const PH_IN = 0.32;
  const inletSurf = mold.point(TH_IN, PH_IN);
  const inletN = mold.normal(TH_IN, PH_IN);
  // Hortum girişi yönü: kanca memesine doğru (hortum düzgün bir yayla iner), yüzey normaliyle harmanlı
  const toNozzle = nozzleTip.clone().sub(inletSurf).normalize();
  // Yüzey normali ağırlığı 0,6: yuva kalıba dik yakın oturur (0,28'de alt kenarın bir yanı ≈ 8 mm havadaydı).
  const INLET_W = 0.6;
  const inletDir = toNozzle.multiplyScalar(1 - INLET_W).addScaledVector(inletN, INLET_W).normalize();
  const TUBE_R = BTE_TUBE_MM.outer / 20;
  const TUBE_IN = BTE_TUBE_MM.inner / 20;
  const BOSS_LEN = 0.22;
  const collarTop = inletSurf.clone().addScaledVector(inletDir, BOSS_LEN - 0.03);
  {
    const d = md.part('earmold', 'front');
    const moldMat = makeMaterial('mold');
    addMesh(d, mold.bowl, moldMat);
    // Kanal gövdesi: kökte hafif genişleme, Ø6.5 → 5.3 mm, ≈ 9 mm, ~28° öne-yukarı kıvrık; kökü çanağın içinde
    const S0 = C.clone().add(new Vector3(canalRoot.x, canalRoot.y, -0.1));
    const canalSpine = new CatmullRomCurve3(
      [S0, S0.clone().add(new Vector3(0.02, 0.0, -0.34)), S0.clone().add(new Vector3(0.1, 0.05, -0.66)), S0.clone().add(new Vector3(0.25, 0.13, -0.97))],
      false,
      'centripetal',
    );
    const canalSpec: LoftSpec = {
      spine: canalSpine,
      ref: UP,
      uFrom: 0,
      uTo: 1,
      radii: (u) => {
        const flare = 0.07 * (1 - smoothstep(0.05, 0.42, u));
        const taper = 0.065 * smoothstep(0.2, 1, u);
        return { ry: 0.325 + flare - taper, rz: 0.3 + flare - taper };
      },
      shape: (c, s) => 1 - 0.06 * Math.max(0, -s) * Math.abs(c),
      capStart: { kind: 'round', length: 0.14, power: 2 },
      capEnd: { kind: 'round', length: 0.15, power: 2.4 },
      stations: 32,
      radial: 36,
    };
    addMesh(d, buildLoft(canalSpec), moldMat);
    // Uçta ses borusu (Ø1.9 mm, merkezde) ve üst yanında vent (Ø0.9 mm) — yüzey normaline oturur
    const tf = loftFrame(canalSpine, UP, 1);
    const bore = addMesh(d, new CylinderGeometry(0.095, 0.095, 0.03, 20), makeMaterial('portDark'));
    bore.quaternion.copy(quatFromTo(UP, tf.t));
    bore.position.copy(tf.p).addScaledVector(tf.t, -0.01);
    {
      // Vent: kesit yarıçapı ≈ 0.14 olan uç istasyonunda, üst (+b) yüzeyde
      let uv = 0.99;
      for (let u = 0.9; u < 1; u += 0.0005) {
        if (loftRadii(canalSpec, u).rz < 0.2) {
          uv = u;
          break;
        }
      }
      const vf = loftFrame(canalSpine, UP, uv);
      const vp = loftPoint(canalSpec, vf, uv, Math.PI / 2);
      const vn = loftNormal(canalSpec, uv, Math.PI / 2);
      const vent = addMesh(d, new CylinderGeometry(0.038, 0.038, 0.03, 14), makeMaterial('portDark'));
      vent.quaternion.copy(quatFromTo(UP, vn));
      vent.position.copy(vp).addScaledVector(vn, -0.01);
    }
    // Yanal yüzde vent ağzı
    {
      const th = 0.25;
      const ph = 1.1;
      const p = mold.point(th, ph);
      const n = mold.normal(th, ph);
      const hole = addMesh(d, new CylinderGeometry(0.045, 0.045, 0.03, 14), makeMaterial('portDark'));
      hole.quaternion.copy(quatFromTo(UP, n));
      hole.position.copy(p).addScaledVector(n, -0.01);
      hole.castShadow = false;
    }
    // Hortum yuvası: çanaktan yükselen akrilik bilezik; ağzında koyu delik (hortum buradan kalıba GİRER)
    // + beyaz hortum kilidi halkası (hortumu yuvada tutan tüp kilidi)
    // Yuva ekseni hortum yönüne eğik; kalıp yüzeyi altında eğimli iner → alt kenarın bir yanı havada kalıyordu.
    // Alt kenar çemberinden kalıp çanağına ışın atılır; en derin nokta kadar (+ pay) yuva kalıbın İÇİNE uzatılır.
    const bossQ = quatFromTo(UP, inletDir);
    const BOSS_R_BOT = TUBE_R + 0.085;
    const bossSink = (() => {
      // Kalıbın o ana kadar kurulan tüm yüzeyleri (çanak + kanal gövdesi + delikler) — çift yüzlü sınama malzemesiyle
      const probeMat = new MeshBasicMaterial({ side: DoubleSide });
      const probes = d.group.children.filter((o): o is Mesh => (o as Mesh).isMesh).map((o) => {
        const pm = new Mesh((o as Mesh).geometry, probeMat);
        pm.position.copy(o.position);
        pm.quaternion.copy(o.quaternion);
        pm.scale.copy(o.scale);
        pm.updateMatrixWorld(true);
        return pm;
      });
      const rc = new Raycaster();
      const e1 = new Vector3(1, 0, 0).applyQuaternion(bossQ);
      const e2 = new Vector3(0, 0, 1).applyQuaternion(bossQ);
      const base = inletSurf.clone().addScaledVector(inletDir, -0.03);
      const down = inletDir.clone().negate();
      let need = 0;
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * Math.PI * 2;
        for (const rr of [BOSS_R_BOT, BOSS_R_BOT * 0.7]) {
          const pt = base.clone().addScaledVector(e1, rr * Math.cos(a)).addScaledVector(e2, rr * Math.sin(a));
          rc.set(pt.clone().addScaledVector(inletDir, 0.3), down);
          const hit = rc.intersectObjects(probes, false)[0];
          if (hit) need = Math.max(need, hit.distance - 0.3);
        }
      }
      probeMat.dispose();
      return need + 0.025; // 0,25 mm gömülme payı
    })();
    const bossLen = BOSS_LEN + bossSink;
    const boss = addMesh(d, new CylinderGeometry(TUBE_R + 0.055, BOSS_R_BOT, bossLen, 28), moldMat);
    boss.quaternion.copy(bossQ);
    boss.position.copy(inletSurf).addScaledVector(inletDir, BOSS_LEN - 0.03 - bossLen / 2);
    const mouth = addMesh(d, new CylinderGeometry(TUBE_R + 0.012, TUBE_R + 0.012, 0.012, 28), makeMaterial('portDark'));
    mouth.quaternion.copy(quatFromTo(UP, inletDir));
    mouth.position.copy(collarTop).addScaledVector(inletDir, 0.001);
    mouth.castShadow = false;
    const lock = addMesh(d, new TorusGeometry(TUBE_R + 0.03, 0.028, 10, 30), makeMaterial('waxGuard'));
    lock.quaternion.copy(quatFromTo(Z_AXIS, inletDir));
    lock.position.copy(collarTop).addScaledVector(inletDir, 0.02);
    const ap = mold.point(3.3, 1.15);
    d.anchorLocal.copy(ap).addScaledVector(mold.normal(3.3, 1.15), 0.01);
    d.anchorNormal.copy(mold.normal(3.3, 1.15));
    d.explodeDirection.set(1, -0.35, 0.2).normalize();
    d.explodeDistance = 0.8;
    md.connectors.tubeInlet = { p: collarTop.clone(), dir: inletDir.clone() };
    md.connectors.moldCenter = { p: new Vector3(C.x, C.y, C.z + mold.lateral), dir: Z_AXIS.clone() };
  }

  /* ---- tube: şeffaf #13 PVC hortum (Ø3.3 / Ø1.9 mm) — memenin üzerine ≈ 4 mm geçer, kalıbın yuvasına ≈ 2.5 mm girer ---- */
  {
    const d = md.part('tube', 'front');
    const tubeStart = hookEnd.clone().addScaledVector(hookEndT, 0.015);
    const tubeCurve = new CatmullRomCurve3(
      [
        tubeStart,
        nozzleTip.clone(),
        nozzleTip.clone().addScaledVector(hookEndT, 0.24),
        collarTop.clone().addScaledVector(inletDir, 0.38).add(new Vector3(0, 0, 0.04)),
        collarTop.clone(),
        collarTop.clone().addScaledVector(inletDir, -0.25),
      ],
      false,
      'centripetal',
    );
    addMesh(d, new TubeGeometry(tubeCurve, 80, TUBE_R, 16, false), makeMaterial('clear')).name = 'tube-pvc';
    const lumen = addMesh(d, new TubeGeometry(tubeCurve, 80, TUBE_IN, 10, false), makeMaterial('lumen'));
    lumen.castShadow = false;
    // Hortum uçları: kesik uç halkaları (cidar kalınlığı görünür)
    for (const [p, t] of [
      [tubeStart, hookEndT.clone().negate()],
      [tubeCurve.getPointAt(1), tubeCurve.getTangentAt(1)],
    ] as const) {
      const ring = addMesh(d, new TorusGeometry((TUBE_R + TUBE_IN) / 2, (TUBE_R - TUBE_IN) / 2, 8, 26), makeMaterial('clear'));
      ring.quaternion.copy(quatFromTo(Z_AXIS, t));
      ring.position.copy(p);
      ring.castShadow = false;
    }
    const mid = tubeCurve.getPointAt(0.5);
    d.anchorLocal.copy(mid).add(new Vector3(0.02, 0, TUBE_R));
    d.anchorNormal.set(0.3, 0, 1).normalize();
    d.explodeDirection.set(1, -0.2, 0.15).normalize();
    d.explodeDistance = 0.45;
  }

  return finalizeModel(md);
}
