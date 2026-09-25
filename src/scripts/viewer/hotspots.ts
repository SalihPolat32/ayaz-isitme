/**
 * Parça çapalarını (anchor) her çizimde CSS piksel koordinatına yansıtır.
 * `visible` = çapa kameraya dönük (yüzey normali · kameraya yön > eşik) VE canvas içinde.
 * Koordinatlar canvas'ın sol-üst köşesine görelidir (sayfa kaydırmasından bağımsız).
 */
import { Vector3, type Camera } from 'three';
import type { DeviceModel, PartId } from './types.ts';

export type HotspotCallback = (id: PartId, x: number, y: number, visible: boolean) => void;

export interface HotspotTracker {
  update(camera: Camera, cssWidth: number, cssHeight: number): void;
  dispose(): void;
}

/** Hafif tolerans: sıyırma açılarında titremeyi azaltır. */
const FACING_THRESHOLD = -0.2;
/** Kenarda kısmen dışarı taşan noktalar hâlâ "içeride" sayılır. */
const NDC_MARGIN = 1.04;

export function createHotspotTracker(model: DeviceModel, cb: HotspotCallback): HotspotTracker {
  const world = new Vector3();
  const normal = new Vector3();
  const toCam = new Vector3();
  const camPos = new Vector3();
  const centerWorld = new Vector3();
  let disposed = false;

  const update = (camera: Camera, cssWidth: number, cssHeight: number): void => {
    if (disposed) return;
    camera.getWorldPosition(camPos);
    centerWorld.copy(model.center);
    model.root.localToWorld(centerWorld);
    const projected: { id: PartId; x: number; y: number; visible: boolean }[] = [];
    for (const part of model.partList) {
      part.object.updateWorldMatrix(false, false);
      world.copy(part.anchorLocal);
      part.object.localToWorld(world);

      // Yüzey normali (varsa) — yoksa "çapa − model merkezi" yaklaşımı
      if (part.anchorNormal.lengthSq() > 0.5) {
        normal.copy(part.anchorNormal).transformDirection(part.object.matrixWorld);
      } else {
        normal.copy(world).sub(centerWorld).normalize();
      }
      toCam.copy(camPos).sub(world).normalize();
      const facing = normal.dot(toCam) > FACING_THRESHOLD;

      world.project(camera);
      const inside = world.z < 1 && Math.abs(world.x) <= NDC_MARGIN && Math.abs(world.y) <= NDC_MARGIN;
      const x = (world.x * 0.5 + 0.5) * cssWidth;
      const y = (-world.y * 0.5 + 0.5) * cssHeight;
      projected.push({ id: part.id, x, y, visible: facing && inside });
    }
    // Preserve separate 44px touch targets when nearby receiver/dome anchors project together.
    const visible = projected.filter(p => p.visible);
    for (let pass = 0; pass < 8; pass++) {
      for (let i = 0; i < visible.length; i++) {
        for (let j = i + 1; j < visible.length; j++) {
          const a = visible[i]!, b = visible[j]!;
          const dx = b.x - a.x, dy = b.y - a.y;
          const distance = Math.hypot(dx, dy);
          if (distance >= 48) continue;
          const ux = distance > 0.01 ? dx / distance : 0;
          const uy = distance > 0.01 ? dy / distance : 1;
          const shift = (48 - distance) / 2;
          a.x -= ux * shift; a.y -= uy * shift;
          b.x += ux * shift; b.y += uy * shift;
        }
      }
      for (const p of visible) {
        p.x = Math.max(24, Math.min(cssWidth - 24, p.x));
        p.y = Math.max(24, Math.min(cssHeight - 24, p.y));
      }
    }
    for (const p of projected) cb(p.id, p.x, p.y, p.visible);
  };

  return {
    update,
    dispose: () => {
      disposed = true;
    },
  };
}
