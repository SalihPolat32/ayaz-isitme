/**
 * Model kurma yardımcıları: parça taslakları, çinko-hava pil, menteşe/kayma mekaniği ve
 * `finalizeModel()` (poz, sınırlar, çapalar, dispose). Üç model de bunu kullanır.
 *
 * Hiyerarşi: root → parça grupları; `battery` grubu `battery-door` grubunun ÇOCUĞUDUR
 * (kapakla döner). Kapak grubunun orijini menteşe noktasıdır; kapak geometrisi menteşeye
 * göre yerelleştirilir (`localizeTo`).
 */
import {
  Box3,
  type BufferGeometry,
  Group,
  LatheGeometry,
  Mesh,
  type MeshPhysicalMaterial,
  type MeshStandardMaterial,
  Sphere,
  Vector2,
  Vector3,
} from 'three';
import { makeMaterial } from './materials.ts';
import type { DeviceModel, DevicePart, DeviceType, PartId } from './types.ts';

export const UNIT_MM = 10;

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export interface PartDraft {
  id: PartId;
  group: Group;
  materials: MeshStandardMaterial[];
  /** Üst nesne uzayında (root ya da kapak). */
  explodeDirection: Vector3;
  explodeDistance: number;
  /** Parça-yerel uzayda. */
  anchorLocal: Vector3;
  anchorNormal: Vector3;
  layer: 'body' | 'front';
}

/** Kapak menteşesi ve pilin kayma hareketi — hepsi kapak-yerel (dinlenmede model yönelimi). */
export interface DoorSpec {
  /** Menteşe ekseni (kapak üst nesnesinin uzayında, birim); pozitif açı = açılış. */
  axis: Vector3;
  /** Tam açık açı (radyan). */
  angle: number;
  /** Pilin kapak-yerel kayma yönü (tepsiden dışarı). */
  slideDir: Vector3;
  slideDistance: number;
}

/**
 * Bağlantı noktası (yalnızca render/kompozit için): dinlenme halinde model uzayında nokta ve
 * isteğe bağlı yön. `finalizeModel` bunları `root.userData.connectors` olarak saklar;
 * `render.ts` piksel koordinatına yansıtır (kulak illüstrasyonunda SVG hortum/kablo için).
 */
export interface Connector {
  p: Vector3;
  dir?: Vector3;
}

export interface ModelDraft {
  type: DeviceType;
  root: Group;
  order: readonly string[];
  drafts: Record<string, PartDraft>;
  door: DoorSpec;
  homeDir: Vector3;
  connectors: Record<string, Connector>;
  /** Yeni parça taslağı; `parent` verilirse grup onun altına eklenir. */
  part(id: PartId, layer?: 'body' | 'front', parent?: PartDraft): PartDraft;
}

export function createModelDraft(type: DeviceType, order: readonly string[], homeDir: Vector3, door: DoorSpec): ModelDraft {
  const root = new Group();
  root.name = `${type}-device`;
  const drafts: Record<string, PartDraft> = {};
  const md: ModelDraft = {
    type,
    root,
    order,
    drafts,
    door,
    homeDir: homeDir.clone().normalize(),
    connectors: {},
    part: (id, layer = 'body', parent) => {
      const group = new Group();
      group.name = id;
      const d: PartDraft = {
        id,
        group,
        materials: [],
        explodeDirection: new Vector3(),
        explodeDistance: 0,
        anchorLocal: new Vector3(),
        anchorNormal: new Vector3(0, 0, 1),
        layer,
      };
      drafts[id] = d;
      (parent ? parent.group : root).add(group);
      return d;
    },
  };
  return md;
}

export function addMesh(draft: PartDraft, geometry: BufferGeometry, material: MeshPhysicalMaterial): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  draft.group.add(mesh);
  if (!draft.materials.includes(material)) draft.materials.push(material);
  return mesh;
}

/**
 * Grubun doğrudan çocuklarını `origin`'e göre yerelleştirir (grup orijini = menteşe).
 * Mesh'ler model uzayında konumlandırılmış olmalı (geometri ya da position ile).
 */
export function localizeTo(draft: PartDraft, origin: Vector3): void {
  for (const child of draft.group.children) child.position.sub(origin);
  draft.group.position.copy(origin);
}

/* ----------------------------------------------------------------------------
 * Çinko-hava pil (düğme pil). Ekseni +Z; + yüz (etiketli, geniş kenar) +Z tarafında.
 * ------------------------------------------------------------------------- */

export type BatterySize = '10' | '312' | '13';

export const BATTERY_SPEC: Record<BatterySize, { radius: number; thickness: number; tab: 'tabYellow' | 'tabBrown' | 'tabOrange'; mm: string }> = {
  '10': { radius: 0.29, thickness: 0.36, tab: 'tabYellow', mm: 'Ø5.8 × 3.6 mm' },
  '312': { radius: 0.395, thickness: 0.36, tab: 'tabBrown', mm: 'Ø7.9 × 3.6 mm' },
  '13': { radius: 0.395, thickness: 0.54, tab: 'tabOrange', mm: 'Ø7.9 × 5.4 mm' },
};

/**
 * Pil meshlerini `draft` grubuna ekler (grup orijini pil merkezi, pil ekseni grup-yerel +Z).
 * `tabSide` etiket yüzünün yönü. Farklı eksen için grubun quaternion'unu ayarlayın.
 */
export function addBattery(draft: PartDraft, size: BatterySize, tabSide: 1 | -1 = 1): void {
  // Takılı pilde renkli koruma bandı YOKTUR (bant, pil takılmadan önce çıkarılır; metinler de bunu söyler).
  // Boyut rengi (BATTERY_SPEC.tab) yalnız ambalaj/bant rengini belirtir; modelde çizilmez.
  const { radius: R, thickness: h } = BATTERY_SPEC[size];
  const step = 0.028; // − kapak ile + kutu arasındaki kıvrım basamağı
  const profile: Vector2[] = [
    new Vector2(0, -h / 2),
    new Vector2(R - step - 0.02, -h / 2),
    new Vector2(R - step, -h / 2 + 0.02),
    new Vector2(R - step, -h / 2 + h * 0.34),
    new Vector2(R, -h / 2 + h * 0.34 + 0.012),
    new Vector2(R, h / 2 - 0.014),
    new Vector2(R - 0.014, h / 2),
    new Vector2(0, h / 2),
  ];
  const coin = addMesh(draft, new LatheGeometry(profile, 56), makeMaterial('steel'));
  coin.name = 'battery-cell'; // kapalı torna yüzeyi (testlerde pil katısı)
  coin.rotation.x = tabSide === 1 ? Math.PI / 2 : -Math.PI / 2; // torna ekseni Y → ±Z
}

/* ----------------------------------------------------------------------------
 * Bitirme: DevicePart kayıtları, poz (explode + kapak), sınırlar, dispose.
 * ------------------------------------------------------------------------- */

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

export function finalizeModel(md: ModelDraft): DeviceModel {
  const { root, door } = md;
  const parts: Record<PartId, DevicePart> = {};
  const anchors: Record<PartId, Vector3> = {};
  const partList: DevicePart[] = [];

  for (const id of md.order) {
    const d = md.drafts[id];
    if (!d) throw new Error(`Model "${md.type}": "${id}" parçası tanımlanmadı.`);
    const part: DevicePart = {
      id,
      object: d.group,
      restPosition: d.group.position.clone(),
      explodeDirection: d.explodeDirection.clone().normalize(),
      explodeDistance: d.explodeDistance,
      anchor: new Vector3(),
      anchorLocal: d.anchorLocal.clone(),
      anchorNormal: d.anchorNormal.clone().normalize(),
      anchorEnabled: true,
      materials: d.materials,
      layer: d.layer,
    };
    parts[id] = part;
    anchors[id] = part.anchor;
    partList.push(part);
  }

  const doorPart = parts['battery-door'];
  const batteryPart = parts['battery'];
  if (!doorPart || !batteryPart) throw new Error(`Model "${md.type}": battery-door ve battery zorunlu.`);
  if (batteryPart.object.parent !== doorPart.object) throw new Error(`Model "${md.type}": battery, battery-door grubunun çocuğu olmalı.`);

  const doorAxis = door.axis.clone().normalize();
  const slideDir = door.slideDir.clone().normalize();
  let explodeT = 0;
  let doorT = 0;

  const pose = (): void => {
    for (const part of partList) {
      part.object.position.copy(part.restPosition).addScaledVector(part.explodeDirection, part.explodeDistance * explodeT);
    }
    batteryPart.object.position.addScaledVector(slideDir, door.slideDistance * doorT);
    doorPart.object.quaternion.setFromAxisAngle(doorAxis, door.angle * doorT);
    batteryPart.anchorEnabled = doorT > 0.5;
  };

  const setExplode = (t: number): void => {
    explodeT = clamp01(t);
    pose();
  };
  const setDoor = (t: number): void => {
    doorT = clamp01(t);
    pose();
  };

  // Dinlenme çapaları (model uzayı) ve sınırlar
  pose();
  root.updateMatrixWorld(true);
  for (const part of partList) part.anchor.copy(part.anchorLocal);
  for (const part of partList) part.object.localToWorld(part.anchor);
  const bounds = new Box3().setFromObject(root);
  // Ayrışmış sınır: kapak kapalı VE açık hallerin birleşimi (açık kapakla dışarı kayan pil de kadraja girsin).
  setExplode(1);
  root.updateMatrixWorld(true);
  const boundsExploded = new Box3().setFromObject(root);
  setDoor(1);
  root.updateMatrixWorld(true);
  boundsExploded.union(new Box3().setFromObject(root));
  setDoor(0);
  setExplode(0);
  root.updateMatrixWorld(true);

  const sphere = bounds.getBoundingSphere(new Sphere());
  const center = bounds.getCenter(new Vector3());
  root.userData.connectors = md.connectors;

  const dispose = (): void => {
    const seen = new Set<object>();
    root.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      if (!seen.has(m.geometry)) {
        seen.add(m.geometry);
        m.geometry.dispose();
      }
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (!seen.has(mat)) {
          seen.add(mat);
          mat.dispose();
        }
      }
    });
    root.removeFromParent();
  };

  return {
    type: md.type,
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
    homeDir: md.homeDir.clone(),
    setExplode,
    getExplode: () => explodeT,
    setDoor,
    getDoor: () => doorT,
    dispose,
  };
}
