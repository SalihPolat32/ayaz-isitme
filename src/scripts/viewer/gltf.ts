/**
 * ALTERNATİF YÜKLEYİCİ (taslak) — parametrik modeli lisanslı bir GLB ile değiştirmek için.
 *
 * Şu an hiçbir yerden import edilmez; `index.ts` `buildDeviceModel(type)` kullanır.
 * Etkinleştirmek için `index.ts` içinde `buildDeviceModel(type)` yerine
 * `await loadGltfModel('/models/ric.glb', { type })` çağırın (mountDeviceViewer zaten async;
 * `setDeviceType` de async olduğundan tip başına farklı GLB yüklenebilir).
 *
 * GLB gereksinimleri (bkz. README.md):
 *  - Kök sahnenin DOĞRUDAN çocukları olarak, adları `PART_IDS[type]` ile birebir aynı düğümler
 *    (Mesh veya Group). `battery` düğümü `battery-door` düğümünün çocuğu OLMALI (kapakla döner).
 *  - Ölçek: 1 birim = 10 mm (UNIT_MM). Gerekirse `scale` seçeneğiyle düzeltin.
 *  - Eksenler: RIC/BTE +X ön (kablo/kanca), +Y yukarı, +Z dışa bakan yüz; CIC +Z faceplate.
 *  - Kapak menteşesi `options.door` ile verilir (model uzayı; verilmezse kapak dönmez).
 *  - Malzemeler PBR (MeshStandard/MeshPhysical); parça başına klonlanır (vurgu için).
 *
 * UYARI: Bu dosya derlenir ama gerçek bir GLB ile test edilmemiştir.
 */
import { Box3, Group, Mesh, MeshStandardMaterial, Sphere, Vector3, type Material, type Object3D } from 'three';
import { countTriangles, UNIT_MM } from './model.ts';
import { type DeviceModel, type DevicePart, type DeviceType, PART_IDS, type PartId } from './types.ts';

export interface GltfPartHint {
  /** Açılma yönü (üst nesne uzayı; normalize edilir). */
  explodeDirection?: Vector3;
  explodeDistance?: number;
  /** Çapa yüzey normali. Çapa, parça kutusunun bu yöndeki yüzeyine konur. */
  anchorNormal?: Vector3;
  layer?: 'body' | 'front';
}

export interface GltfDoorHint {
  /** Menteşe noktası (model uzayı). */
  hinge: Vector3;
  /** Menteşe ekseni (model uzayı, birim). Pozitif açı = açılış. */
  axis: Vector3;
  /** Tam açık açı (radyan). Varsayılan 70°. */
  angle?: number;
  /** Pilin kapak-yerel kayma yönü ve mesafesi. */
  slideDir?: Vector3;
  slideDistance?: number;
}

export interface LoadGltfOptions {
  type?: DeviceType;
  /** Ek ölçek çarpanı (GLB metre ise 100 → 1 birim = 10 mm). */
  scale?: number;
  hints?: Partial<Record<PartId, GltfPartHint>>;
  door?: GltfDoorHint;
  homeDir?: Vector3;
}

const FRONT_PARTS = new Set(['wire', 'receiver', 'dome', 'hook', 'tube', 'earmold']);

/** Parametrik modellerle uyumlu varsayılan açılma düzeni. */
function defaultHint(id: PartId, type: DeviceType): Required<GltfPartHint> {
  const layer: 'body' | 'front' = FRONT_PARTS.has(id) ? 'front' : 'body';
  if (type === 'cic') {
    const out = id === 'receiver-outlet';
    return {
      explodeDirection: id === 'shell' ? new Vector3() : out ? new Vector3(0, 0, -1) : new Vector3(0, 0, 1),
      explodeDistance: id === 'shell' ? 0 : id === 'battery-door' ? 1.5 : id === 'battery' ? 0.55 : 0.7,
      anchorNormal: out ? new Vector3(-0.9, 0.15, -0.35) : new Vector3(0, 0, 1),
      layer,
    };
  }
  switch (id) {
    case 'body':
      return { explodeDirection: new Vector3(), explodeDistance: 0, anchorNormal: new Vector3(0, 0, 1), layer };
    case 'mics':
      return { explodeDirection: new Vector3(-0.35, 0.8, 0.15), explodeDistance: 0.45, anchorNormal: new Vector3(-0.35, 0.3, 1), layer };
    case 'button':
      return { explodeDirection: new Vector3(-0.95, 0.1, 0), explodeDistance: 0.35, anchorNormal: new Vector3(-0.7, 0.1, 0.7), layer };
    case 'battery-door':
      return { explodeDirection: new Vector3(0.3, -1, 0), explodeDistance: 1.5, anchorNormal: new Vector3(0, 0, 1), layer };
    case 'battery':
      return { explodeDirection: new Vector3(-0.3, 1, 0), explodeDistance: 0.85, anchorNormal: new Vector3(0, 0, 1), layer };
    case 'hook':
      return { explodeDirection: new Vector3(0.3, 1, 0), explodeDistance: 0.5, anchorNormal: new Vector3(0.1, 0.3, 1), layer };
    case 'tube':
    case 'wire':
      return { explodeDirection: new Vector3(1, -0.2, 0.15), explodeDistance: 0.4, anchorNormal: new Vector3(0.35, 0, 1), layer };
    case 'earmold':
      return { explodeDirection: new Vector3(1, -0.35, 0.2), explodeDistance: 0.8, anchorNormal: new Vector3(0.1, 0.1, 1), layer };
    case 'receiver':
      return { explodeDirection: new Vector3(1, 0.12, 0.08), explodeDistance: 0.68, anchorNormal: new Vector3(0, 0, 1), layer };
    case 'dome':
      return { explodeDirection: new Vector3(1, -0.2, 0.1), explodeDistance: 0.95, anchorNormal: new Vector3(0, 0, 1), layer };
    default:
      return { explodeDirection: new Vector3(0, 0, 1), explodeDistance: 0.5, anchorNormal: new Vector3(0, 0, 1), layer };
  }
}

function collectMaterials(node: Object3D): MeshStandardMaterial[] {
  const out: MeshStandardMaterial[] = [];
  node.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    const mats: Material[] = Array.isArray(m.material) ? m.material : [m.material];
    const cloned = mats.map((mat) => mat.clone());
    m.material = Array.isArray(m.material) ? cloned : cloned[0]!;
    for (const mat of cloned) {
      if ((mat as MeshStandardMaterial).isMeshStandardMaterial) out.push(mat as MeshStandardMaterial);
    }
  });
  return out;
}

export async function loadGltfModel(url: string, options: LoadGltfOptions = {}): Promise<DeviceModel> {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(url);
  const type: DeviceType = options.type ?? 'ric';
  const root = new Group();
  root.name = `${type}-device-glb`;
  const scale = options.scale ?? 1;
  root.scale.setScalar(scale);

  const parts: Record<PartId, DevicePart> = {};
  const anchors: Record<PartId, Vector3> = {};
  const partList: DevicePart[] = [];
  const groups: Record<PartId, Group> = {};

  for (const id of PART_IDS[type]) {
    const node = gltf.scene.getObjectByName(id);
    if (!node) throw new Error(`GLB içinde "${id}" adlı düğüm bulunamadı (bkz. README.md).`);
    const expectParent = id === 'battery' ? gltf.scene.getObjectByName('battery-door') : gltf.scene;
    if (node.parent !== expectParent) throw new Error(`"${id}" düğümü ${id === 'battery' ? 'battery-door' : 'kök sahne'} altında olmalı.`);

    // Parçayı kendi grubuna sar: grup konumu = açılma ofseti, düğüm dönüşümü korunur.
    const group = new Group();
    group.name = id;
    const parentGroup = id === 'battery' ? groups['battery-door']! : root;
    node.removeFromParent();
    group.add(node);
    parentGroup.add(group);
    groups[id] = group;

    const hint = { ...defaultHint(id, type), ...(options.hints?.[id] ?? {}) };
    const box = new Box3().setFromObject(node);
    const center = box.getCenter(new Vector3());
    const half = box.getSize(new Vector3()).multiplyScalar(0.5);
    const n = hint.anchorNormal.clone().normalize();
    const anchorLocal = center.clone().add(new Vector3(n.x * half.x, n.y * half.y, n.z * half.z));

    partList.push({
      id,
      object: group,
      restPosition: new Vector3(),
      explodeDirection: hint.explodeDirection.lengthSq() > 0 ? hint.explodeDirection.clone().normalize() : new Vector3(),
      explodeDistance: hint.explodeDistance,
      anchor: new Vector3(),
      anchorLocal,
      anchorNormal: n,
      anchorEnabled: true,
      materials: collectMaterials(node),
      layer: hint.layer,
    });
  }
  for (const p of partList) {
    parts[p.id] = p;
    anchors[p.id] = p.anchor;
  }

  // Kapak: menteşe verildiyse kapak grubunun orijinini menteşeye taşı
  const doorPart = parts['battery-door'];
  const batteryPart = parts['battery'];
  const doorHint = options.door;
  if (doorPart && doorHint) {
    const h = doorHint.hinge.clone();
    for (const child of doorPart.object.children) child.position.sub(h);
    doorPart.object.position.copy(h);
    doorPart.restPosition.copy(h);
    doorPart.anchorLocal.sub(h);
  }
  const doorAxis = doorHint?.axis.clone().normalize() ?? new Vector3(0, 0, 1);
  const doorAngle = doorHint?.angle ?? (70 * Math.PI) / 180;
  const slideDir = doorHint?.slideDir?.clone().normalize() ?? new Vector3();
  const slideDistance = doorHint?.slideDistance ?? 0;

  let explodeT = 0;
  let doorT = 0;
  const pose = (): void => {
    for (const p of partList) p.object.position.copy(p.restPosition).addScaledVector(p.explodeDirection, p.explodeDistance * explodeT);
    if (batteryPart) {
      batteryPart.object.position.addScaledVector(slideDir, slideDistance * doorT);
      batteryPart.anchorEnabled = doorT > 0.5;
    }
    if (doorPart && doorHint) doorPart.object.quaternion.setFromAxisAngle(doorAxis, doorAngle * doorT);
  };
  const setExplode = (t: number): void => {
    explodeT = Math.min(1, Math.max(0, t));
    pose();
  };
  const setDoor = (t: number): void => {
    doorT = Math.min(1, Math.max(0, t));
    pose();
  };

  pose();
  root.updateMatrixWorld(true);
  for (const p of partList) p.object.localToWorld(p.anchor.copy(p.anchorLocal));
  const bounds = new Box3().setFromObject(root);
  setExplode(1);
  root.updateMatrixWorld(true);
  const boundsExploded = new Box3().setFromObject(root);
  setExplode(0);
  root.updateMatrixWorld(true);

  const dispose = (): void => {
    root.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      const mats: Material[] = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const sm = mat as MeshStandardMaterial;
        sm.map?.dispose();
        sm.normalMap?.dispose();
        sm.roughnessMap?.dispose();
        sm.metalnessMap?.dispose();
        sm.emissiveMap?.dispose();
        sm.aoMap?.dispose();
        mat.dispose();
      }
    });
    root.removeFromParent();
  };

  return {
    type,
    root,
    parts,
    partList,
    anchors,
    bounds,
    boundsExploded,
    sphere: bounds.getBoundingSphere(new Sphere()),
    center: bounds.getCenter(new Vector3()),
    triangleCount: countTriangles(root),
    unitMm: UNIT_MM,
    homeDir: (options.homeDir ?? (type === 'cic' ? new Vector3(-0.5, 0.35, 0.8) : new Vector3(-0.32, 0.16, 1))).clone().normalize(),
    setExplode,
    getExplode: () => explodeT,
    setDoor,
    getDoor: () => doorT,
    dispose,
  };
}
