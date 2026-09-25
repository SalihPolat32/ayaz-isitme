/**
 * ALTERNATİF YÜKLEYİCİ (taslak) — parametrik modeli lisanslı bir GLB ile değiştirmek için.
 *
 * Şu an hiçbir yerden import edilmez; `index.ts` `buildDeviceModel()` kullanır.
 * Etkinleştirmek için `index.ts` içinde `buildDeviceModel()` yerine
 * `await loadGltfModel('/models/cihaz.glb')` çağırın (mountDeviceViewer zaten async).
 *
 * GLB gereksinimleri (bkz. README.md):
 *  - Kök sahnenin DOĞRUDAN çocukları olarak, adları `PartId` ile birebir aynı
 *    7 düğüm: mics, body, button, wire, receiver, dome, power (Mesh veya Group).
 *  - Ölçek: 1 birim = 10 mm (UNIT_MM). Gerekirse `scale` seçeneğiyle düzeltin.
 *  - Eksenler: +X ön uç (kablo), +Y yukarı, +Z dışa bakan yüz.
 *  - Malzemeler PBR (MeshStandard/MeshPhysical); parça başına klonlanır (vurgu için).
 *
 * UYARI: Bu dosya derlenir ama gerçek bir GLB ile test edilmemiştir.
 */
import { Box3, Group, Mesh, MeshStandardMaterial, Sphere, Vector3, type Material, type Object3D } from 'three';
import { countTriangles, PART_IDS, UNIT_MM } from './model.ts';
import type { DeviceModel, DevicePart, PartId } from './types.ts';

export interface GltfPartHint {
  /** Açılma yönü (model uzayı; normalize edilir). */
  explodeDirection?: Vector3;
  explodeDistance?: number;
  /** Çapa yüzey normali (model uzayı). Çapa, parça kutusunun bu yöndeki yüzeyine konur. */
  anchorNormal?: Vector3;
}

export interface LoadGltfOptions {
  /** Ek ölçek çarpanı (GLB metre ise 100 → 1 birim = 10 mm). */
  scale?: number;
  hints?: Partial<Record<PartId, GltfPartHint>>;
}

/** Parametrik modelle aynı varsayılan açılma düzeni. */
const DEFAULT_HINTS: Record<PartId, Required<GltfPartHint>> = {
  body: { explodeDirection: new Vector3(0, 0, 0), explodeDistance: 0, anchorNormal: new Vector3(0, 0, 1) },
  mics: { explodeDirection: new Vector3(0, 1, 0), explodeDistance: 0.45, anchorNormal: new Vector3(0, 1, 0) },
  button: { explodeDirection: new Vector3(-0.45, 0.89, 0), explodeDistance: 0.35, anchorNormal: new Vector3(-0.45, 0.89, 0) },
  power: { explodeDirection: new Vector3(0, -1, 0), explodeDistance: 0.42, anchorNormal: new Vector3(0, -1, 0) },
  wire: { explodeDirection: new Vector3(0.08, -1, 0), explodeDistance: 0.32, anchorNormal: new Vector3(0.35, 0, 1) },
  receiver: { explodeDirection: new Vector3(0.08, -1, 0), explodeDistance: 0.68, anchorNormal: new Vector3(0, 0, 1) },
  dome: { explodeDirection: new Vector3(-0.25, -0.97, 0), explodeDistance: 0.97, anchorNormal: new Vector3(0, 0, 1) },
};

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
  const root = new Group();
  root.name = 'ric-device-glb';
  const scale = options.scale ?? 1;
  root.scale.setScalar(scale);

  const parts = {} as Record<PartId, DevicePart>;
  const anchors = {} as Record<PartId, Vector3>;
  const partList: DevicePart[] = [];

  for (const id of PART_IDS) {
    const node = gltf.scene.getObjectByName(id);
    if (!node) throw new Error(`GLB içinde "${id}" adlı düğüm bulunamadı (bkz. README.md).`);
    if (node.parent !== gltf.scene) throw new Error(`"${id}" düğümü kök sahnenin doğrudan çocuğu olmalı.`);

    // Parçayı kendi grubuna sar: grup konumu = açılma ofseti, düğüm dönüşümü korunur.
    const group = new Group();
    group.name = id;
    node.removeFromParent();
    group.add(node);
    root.add(group);

    const hint = { ...DEFAULT_HINTS[id], ...(options.hints?.[id] ?? {}) };
    const box = new Box3().setFromObject(node);
    const center = box.getCenter(new Vector3());
    const half = box.getSize(new Vector3()).multiplyScalar(0.5);
    const n = hint.anchorNormal.clone().normalize();
    const anchor = center
      .clone()
      .add(new Vector3(n.x * half.x, n.y * half.y, n.z * half.z))
      .multiplyScalar(scale);

    const part: DevicePart = {
      id,
      object: group,
      restPosition: new Vector3(),
      explodeDirection: hint.explodeDirection.lengthSq() > 0 ? hint.explodeDirection.clone().normalize() : new Vector3(),
      explodeDistance: hint.explodeDistance,
      anchor,
      anchorLocal: anchor.clone().divideScalar(scale),
      anchorNormal: n,
      materials: collectMaterials(node),
    };
    parts[id] = part;
    anchors[id] = anchor;
    partList.push(part);
  }

  const setExplode = (t: number): void => {
    const k = Math.min(1, Math.max(0, t));
    for (const p of partList) p.object.position.copy(p.restPosition).addScaledVector(p.explodeDirection, p.explodeDistance * k);
  };

  root.updateMatrixWorld(true);
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
    setExplode,
    dispose,
  };
}
