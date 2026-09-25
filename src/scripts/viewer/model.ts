/**
 * Temsili RIC (receiver-in-canal) işitme cihazı — tamamen parametrik, markasız.
 *
 * Ölçek: 1 sahne birimi = 10 mm. Gövde ≈ 28 mm uzun, ≈ 8 mm geniş, ≈ 6 mm kalın.
 * Eksenler (model uzayı): +X kulak kanalına doğru, +Y yukarı (kablo çıkışı),
 * +Z dışa bakan yüz (kulağın tersi). Kamera varsayılan olarak +Z tarafından bakar.
 *
 * Hiçbir dış varlık (texture/GLB) kullanılmaz; her şey Three.js geometrisidir.
 * Parçalar ayrı `Group` nesneleridir ve kimlikleri `PartId` ile birebir aynıdır.
 */
import {
  type MeshStandardMaterial,
  Box3,
  BufferGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  Quaternion,
  Sphere,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { DeviceModel, DevicePart, PartId } from './types.ts';

export const UNIT_MM = 10;

export const PART_IDS: readonly PartId[] = ['body', 'mics', 'button', 'power', 'wire', 'receiver', 'dome'];

/* ----------------------------------------------------------------------------
 * Yardımcılar
 * ------------------------------------------------------------------------- */

const UP = new Vector3(0, 1, 0);
const Z_AXIS = new Vector3(0, 0, 1);

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** `from` birim vektörünü `to` birim vektörüne çeviren quaternion. */
const quatFromTo = (from: Vector3, to: Vector3): Quaternion => new Quaternion().setFromUnitVectors(from, to.clone().normalize());

/* ----------------------------------------------------------------------------
 * Malzemeler — her parça kendi örneğini alır (vurgu emissive'i parçaya özel olsun).
 * Aynı tanımlı malzemeler shader programını paylaşır; ek derleme maliyeti yoktur.
 * ------------------------------------------------------------------------- */

type MaterialKind = 'graphite' | 'titanium' | 'matte' | 'dome' | 'wire' | 'gold' | 'portDark';

function makeMaterial(kind: MaterialKind): MeshPhysicalMaterial {
  switch (kind) {
    case 'graphite':
      return new MeshPhysicalMaterial({
        color: 0x555e64,
        roughness: 0.54,
        metalness: 0.12,
        clearcoat: 0.18,
        clearcoatRoughness: 0.5,
      });
    case 'titanium':
      return new MeshPhysicalMaterial({ color: 0xb8bcc2, metalness: 0.85, roughness: 0.3 });
    case 'matte':
      return new MeshPhysicalMaterial({ color: 0x1d2025, roughness: 0.7, metalness: 0.05 });
    case 'dome':
      return new MeshPhysicalMaterial({
        color: 0xcfd6da,
        roughness: 0.25,
        metalness: 0,
        transmission: 0.55,
        thickness: 0.3,
        ior: 1.42,
        transparent: true,
        opacity: 1,
      });
    case 'wire':
      return new MeshPhysicalMaterial({ color: 0xd8dde0, roughness: 0.35, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.3 });
    case 'gold':
      return new MeshPhysicalMaterial({ color: 0xc9a227, metalness: 0.9, roughness: 0.3 });
    case 'portDark':
      return new MeshPhysicalMaterial({ color: 0x0b0d10, roughness: 0.9, metalness: 0 });
  }
}

/* ----------------------------------------------------------------------------
 * Gövde: XY düzleminde bir omurga eğrisi boyunca "loft" edilmiş, uçları
 * yuvarlatılmış ince RIC gövdesi: kulak arkasına uyan kavis, dar üst bağlantı.
 * ------------------------------------------------------------------------- */

const SPINE = new CatmullRomCurve3(
  [
    new Vector3(-0.36, -1.38, 0),
    new Vector3(-0.60, -0.75, 0),
    new Vector3(-0.64, 0.02, 0),
    new Vector3(-0.48, 0.78, 0),
    new Vector3(-0.18, 1.38, 0),
  ],
  false,
  'centripetal',
);

interface Frame {
  p: Vector3; // omurga noktası
  t: Vector3; // teğet (ileri)
  n: Vector3; // düzlem içi normal (≈ yukarı)
  b: Vector3; // binormal (+Z, kalınlık ekseni)
}

function spineFrame(u: number): Frame {
  const p = SPINE.getPointAt(u);
  const t = SPINE.getTangentAt(u).normalize();
  const b = Z_AXIS.clone();
  const n = new Vector3().crossVectors(b, t).normalize();
  return { p, t, n, b };
}

const CAP_BACK = 0.15; // u cinsinden arka yuvarlatma uzunluğu
const CAP_FRONT = 0.16; // ön uç: daha uzun, daha sivri

function capFactor(u: number): number {
  let f = 1;
  if (u < CAP_BACK) {
    const v = 1 - u / CAP_BACK;
    f *= Math.sqrt(Math.max(0, 1 - v * v));
  }
  if (u > 1 - CAP_FRONT) {
    const v = (u - (1 - CAP_FRONT)) / CAP_FRONT;
    const p = 1.7;
    f *= Math.pow(Math.max(0, 1 - Math.pow(v, p)), 1 / p);
  }
  return f;
}

/** Kesit yarı-eksenleri (uç yuvarlatması dahil). */
function bodyRadii(u: number): { ry: number; rz: number } {
  const taper = smoothstep(0.5, 1, u);
  const ry = 0.31 + 0.055 * Math.sin(Math.PI * u) - 0.11 * taper;
  const rz = 0.28 + 0.015 * Math.sin(Math.PI * u) - 0.09 * taper;
  const c = capFactor(u);
  return { ry: Math.max(0.0015, ry * c), rz: Math.max(0.0015, rz * c) };
}

/** Kesit modülasyonu: üstte damla (dar sırt), iç yüzde hafif düzleşme. */
function zScaleAt(cosTheta: number, sinTheta: number): number {
  const teardrop = 0.14 * Math.max(0, cosTheta);
  const s = clamp01((0.2 - sinTheta) / 0.6);
  const flat = 0.1 * (s * s * (3 - 2 * s));
  return 1 - teardrop - flat;
}

function buildBodyGeometry(stations: number, radial: number): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= stations; i++) {
    const u = 0.5 - 0.5 * Math.cos((Math.PI * i) / stations); // uçlarda yoğun örnekleme
    const { p, n, b } = spineFrame(u);
    const { ry, rz } = bodyRadii(u);
    for (let j = 0; j < radial; j++) {
      const th = (2 * Math.PI * j) / radial;
      const c = Math.cos(th);
      const s = Math.sin(th);
      const zs = zScaleAt(c, s);
      positions.push(
        p.x + n.x * ry * c + b.x * rz * zs * s,
        p.y + n.y * ry * c + b.y * rz * zs * s,
        p.z + n.z * ry * c + b.z * rz * zs * s,
      );
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

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Omurga istasyonu `u` için üst/alt yüzey noktası ve normali. */
function surfacePoint(u: number, side: 'top' | 'bottom'): { point: Vector3; normal: Vector3; frame: Frame } {
  const frame = spineFrame(u);
  const { ry } = bodyRadii(u);
  const sign = side === 'top' ? 1 : -1;
  const normal = frame.n.clone().multiplyScalar(sign);
  const point = frame.p.clone().addScaledVector(frame.n, sign * ry);
  return { point, normal, frame };
}

/** (t, n, b) tabanından dönüş quaternion'u — yerel X=t, Y=n, Z=b. */
function basisQuat(t: Vector3, n: Vector3, b: Vector3): Quaternion {
  const m = new Matrix4().makeBasis(t, n, b);
  return new Quaternion().setFromRotationMatrix(m);
}

/* ----------------------------------------------------------------------------
 * Model kurucu
 * ------------------------------------------------------------------------- */

interface PartDraft {
  id: PartId;
  group: Group;
  materials: MeshStandardMaterial[];
  explodeDirection: Vector3;
  explodeDistance: number;
  anchor: Vector3;
  anchorNormal: Vector3;
}

function addMesh(draft: PartDraft, geometry: BufferGeometry, material: MeshPhysicalMaterial): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  draft.group.add(mesh);
  if (!draft.materials.includes(material)) draft.materials.push(material);
  return mesh;
}

export function countTriangles(root: Group): number {
  let n = 0;
  root.traverse((o) => {
    if ((o as Mesh).isMesh) {
      const g = (o as Mesh).geometry;
      n += g.index ? g.index.count / 3 : g.getAttribute('position').count / 3;
    }
  });
  return Math.round(n);
}

export function buildDeviceModel(): DeviceModel {
  const root = new Group();
  root.name = 'ric-device';

  const drafts: Record<PartId, PartDraft> = {} as Record<PartId, PartDraft>;
  const draft = (id: PartId): PartDraft => {
    const group = new Group();
    group.name = id;
    const d: PartDraft = {
      id,
      group,
      materials: [],
      explodeDirection: new Vector3(0, 1, 0),
      explodeDistance: 0,
      anchor: new Vector3(),
      anchorNormal: new Vector3(0, 0, 1),
    };
    drafts[id] = d;
    root.add(group);
    return d;
  };

  /* ---- body ---- */
  {
    const d = draft('body');
    addMesh(d, buildBodyGeometry(64, 40), makeMaterial('graphite'));
    // İnce kabuk birleşim çizgisi: iki yüzün kenarında, gövde eğrisini izler.
    for (const sign of [-1, 1]) {
      const points = Array.from({ length: 65 }, (_, i) => {
        const u = 0.035 + i / 64 * 0.93;
        const { p, n, b } = spineFrame(u);
        const { ry, rz } = bodyRadii(u);
        return p.addScaledVector(n, ry * 0.72).addScaledVector(b, sign * rz * 0.66);
      });
      addMesh(d, new TubeGeometry(new CatmullRomCurve3(points), 64, 0.007, 5, false), makeMaterial('matte'));
    }
    // Dış yüz (+Z) orta noktası
    const f = spineFrame(0.5);
    const { rz } = bodyRadii(0.5);
    d.anchor.copy(f.p).addScaledVector(f.b, rz * zScaleAt(0, 1));
    d.anchorNormal.set(0, 0, 1);
    d.explodeDirection.set(0, 0, 0);
    d.explodeDistance = 0;
  }

  /* ---- mics: sırt üzerinde iki mikrofon portu ---- */
  {
    const d = draft('mics');
    for (const u of [0.76, 0.90]) {
      const { point, normal, frame } = surfacePoint(u, 'top');
      const slot = addMesh(d, new RoundedBoxGeometry(0.13, 0.022, 0.095, 3, 0.012), makeMaterial('portDark'));
      slot.quaternion.copy(basisQuat(frame.t, frame.n, frame.b));
      slot.position.copy(point).addScaledVector(normal, 0.003);
    }
    const mid = surfacePoint(0.83, 'top');
    d.anchor.copy(mid.point).add(new Vector3(0, 0, 0.09));
    d.anchorNormal.set(-0.35, 0.3, 1).normalize();
    d.explodeDirection.set(-0.35, 0.8, 0.15).normalize();
    d.explodeDistance = 0.45;
  }

  /* ---- button: arka sırtta ince, uzun basma düğmesi ---- */
  {
    const d = draft('button');
    const { point, normal, frame } = surfacePoint(0.50, 'top');
    const geo = new RoundedBoxGeometry(0.62, 0.065, 0.18, 4, 0.03);
    const mesh = addMesh(d, geo, makeMaterial('matte'));
    mesh.quaternion.copy(basisQuat(frame.t, frame.n, frame.b));
    mesh.position.copy(point).addScaledVector(normal, -0.02 + 0.0375); // yarı gömülü
    d.anchor.copy(point).addScaledVector(normal, -0.02 + 0.075);
    // Düğme sırttan çıkıntı yapar: etiketi üstten her açıdan anlamlı → normal yukarıya harmanlanır
    d.anchorNormal.copy(normal).add(new Vector3(0, 0, 1)).normalize();
    d.explodeDirection.copy(normal);
    d.explodeDistance = 0.35;
  }

  /* ---- power: gövde altında iki altın şarj kontağı + koyu yuva ---- */
  {
    const d = draft('power');
    const goldMat = makeMaterial('gold');
    const matte = makeMaterial('matte');
    const f = spineFrame(0.18);
    const seatPoint = f.p.clone().add(new Vector3(0, 0, bodyRadii(0.18).rz + 0.005));
    const seatMesh = addMesh(d, new RoundedBoxGeometry(0.30, 0.18, 0.026, 3, 0.025), matte);
    seatMesh.position.copy(seatPoint);
    const pinGeo = new CylinderGeometry(0.043, 0.043, 0.025, 20);
    for (const dx of [-0.078, 0.078]) {
      const pin = addMesh(d, pinGeo, goldMat);
      pin.quaternion.copy(quatFromTo(UP, Z_AXIS));
      pin.position.copy(seatPoint).add(new Vector3(dx, 0, 0.023));
    }
    d.anchor.copy(seatPoint).add(new Vector3(0, 0, 0.04));
    d.anchorNormal.copy(Z_AXIS);
    d.explodeDirection.set(0, -0.55, 0.6).normalize();
    d.explodeDistance = 0.42;
  }

  /* ---- wire + receiver + dome: ön uçtan aşağı-ileri kıvrılan alıcı kablosu ---- */
  const tip = SPINE.getPointAt(1);
  const tipT = SPINE.getTangentAt(1).normalize();
  const wireCurve = new CatmullRomCurve3(
    [
      tip.clone(),
      tip.clone().addScaledVector(tipT, 0.28),
      new Vector3(0.54, 1.83, 0.04),
      new Vector3(1.08, 1.48, 0.07),
      new Vector3(1.25, 0.60, 0.10),
      new Vector3(1.27, -0.27, 0.12),
      new Vector3(1.11, -0.72, 0.14),
    ],
    false,
    'centripetal',
  );
  const wireEnd = wireCurve.getPointAt(1);
  const recDir = wireCurve.getTangentAt(1).normalize(); // alıcı ekseni
  const wireDir = new Vector3(1, 0.12, 0.08).normalize(); // "gövdeden uzağa" açılma yönü

  {
    const d = draft('wire');
    const tube = new TubeGeometry(wireCurve, 80, 0.023, 10, false);
    addMesh(d, tube, makeMaterial('wire'));
    // Gövde ucundaki bağlantı soketi
    const boot = new CylinderGeometry(0.058, 0.045, 0.16, 18);
    const bootMesh = addMesh(d, boot, makeMaterial('matte'));
    bootMesh.quaternion.copy(quatFromTo(UP, tipT));
    bootMesh.position.copy(tip).addScaledVector(tipT, 0.03);
    // Çapa: kablonun en ileri kıvrımı, +Z yüzü
    const mid = wireCurve.getPointAt(0.5);
    d.anchor.copy(mid).add(new Vector3(0.012, 0, 0.03));
    d.anchorNormal.set(0.35, 0, 1).normalize();
    d.explodeDirection.copy(wireDir);
    d.explodeDistance = 0.32;
  }

  const recCenter = wireEnd.clone().addScaledVector(recDir, 0.22);
  {
    const d = draft('receiver');
    const cap = new CapsuleGeometry(0.095, 0.28, 6, 20);
    const mesh = addMesh(d, cap, makeMaterial('titanium'));
    mesh.quaternion.copy(quatFromTo(UP, recDir));
    mesh.position.copy(recCenter);
    const band = new TorusGeometry(0.097, 0.009, 8, 24);
    const bandMesh = addMesh(d, band, makeMaterial('matte'));
    bandMesh.quaternion.copy(quatFromTo(Z_AXIS, recDir));
    bandMesh.position.copy(wireEnd).addScaledVector(recDir, 0.1);
    d.anchor.copy(recCenter).add(new Vector3(0, 0, 0.125));
    d.anchorNormal.set(0, 0, 1);
    d.explodeDirection.copy(wireDir);
    d.explodeDistance = 0.68;
  }

  {
    const d = draft('dome');
    // Kapalı ince kabuk profili (r, h): manşon + geriye kıvrılan şemsiye + üstte açık ses deliği
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
    ];
    const geo = new LatheGeometry(profile.map((p) => p.multiplyScalar(0.77)), 40);
    const mesh = addMesh(d, geo, makeMaterial('dome'));
    const domeBase = wireEnd.clone().addScaledVector(recDir, 0.32);
    mesh.quaternion.copy(quatFromTo(UP, recDir));
    mesh.position.copy(domeBase);
    d.anchor.copy(domeBase).addScaledVector(recDir, 0.2).add(new Vector3(0, 0, 0.3));
    d.anchorNormal.set(0, 0, 1);
    const v = wireDir.clone().multiplyScalar(0.68).addScaledVector(recDir, 0.4);
    d.explodeDistance = v.length();
    d.explodeDirection.copy(v).normalize();
  }

  /* ---- DevicePart kayıtları ---- */
  const parts = {} as Record<PartId, DevicePart>;
  const anchors = {} as Record<PartId, Vector3>;
  const partList: DevicePart[] = [];
  for (const id of PART_IDS) {
    const d = drafts[id];
    const restPosition = d.group.position.clone();
    const part: DevicePart = {
      id,
      object: d.group,
      restPosition,
      explodeDirection: d.explodeDirection.clone(),
      explodeDistance: d.explodeDistance,
      anchor: d.anchor.clone(),
      anchorLocal: d.anchor.clone().sub(restPosition),
      anchorNormal: d.anchorNormal.clone().normalize(),
      materials: d.materials,
    };
    parts[id] = part;
    anchors[id] = part.anchor;
    partList.push(part);
  }

  const setExplode = (t: number): void => {
    const k = clamp01(t);
    for (const part of partList) {
      part.object.position.copy(part.restPosition).addScaledVector(part.explodeDirection, part.explodeDistance * k);
    }
  };

  root.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(root);
  setExplode(1);
  root.updateMatrixWorld(true);
  const boundsExploded = new Box3().setFromObject(root);
  setExplode(0);
  root.updateMatrixWorld(true);

  const sphere = bounds.getBoundingSphere(new Sphere());
  const center = bounds.getCenter(new Vector3());

  const dispose = (): void => {
    const seen = new Set<BufferGeometry | MeshPhysicalMaterial>();
    root.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      if (!seen.has(m.geometry)) {
        seen.add(m.geometry);
        m.geometry.dispose();
      }
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (!seen.has(mat as MeshPhysicalMaterial)) {
          seen.add(mat as MeshPhysicalMaterial);
          mat.dispose();
        }
      }
    });
    root.removeFromParent();
  };

  return {
    root,
    parts,
    partList,
    anchors,
    bounds,
    boundsExploded,
    sphere,
    center,
    triangleCount: countTriangles(root),
    unitMm: UNIT_MM,
    setExplode,
    dispose,
  };
}

/** Vurgu rengi (token: --accent). Sahne tarafı emissive için kullanır. */
export const HIGHLIGHT_COLOR = new Color(0x087f8c);
