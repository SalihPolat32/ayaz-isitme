/**
 * Model üreticileri — tamamen parametrik, markasız, pil ile çalışan üç temsili cihaz.
 *
 * - `buildDeviceModel('ric' | 'bte' | 'cic')` → etkileşimli modeller (bkz. model-curved.ts, model-shell.ts)
 * - `buildShellVariant('ite' | 'itc' | 'iic' | 'cic')` → yalnızca render için kabuk türevleri
 *
 * Ölçek: 1 sahne birimi = 10 mm (`UNIT_MM`). Hiçbir dış varlık (texture/GLB) kullanılmaz.
 */
import { buildBteModel, buildRicModel } from './model-curved.ts';
import { buildCicModel, buildShellVariant, SHELL_VARIANTS, type ShellKind } from './model-shell.ts';
import type { DeviceModel, DeviceType } from './types.ts';

export { countTriangles, UNIT_MM, BATTERY_SPEC } from './parts.ts';
export { HIGHLIGHT_COLOR } from './materials.ts';
export { buildShellVariant, SHELL_VARIANTS };
export type { ShellKind };
export { PART_IDS } from './types.ts';

/** Render ön ayarları: üç etkileşimli tip + üç kabuk türevi. */
export type RenderKind = DeviceType | ShellKind;
export const RENDER_KINDS: readonly RenderKind[] = ['ric', 'bte', 'cic', 'ite', 'itc', 'iic'];

/** Pil boyutu (tip başına). */
export const BATTERY_SIZE: Record<DeviceType, '312' | '13' | '10'> = { ric: '312', bte: '13', cic: '10' };

export function buildDeviceModel(type: DeviceType = 'ric'): DeviceModel {
  switch (type) {
    case 'ric':
      return buildRicModel();
    case 'bte':
      return buildBteModel();
    case 'cic':
      return buildCicModel();
  }
}

/** Render ön ayarı için model (kabuk türevleri dahil). */
export function buildRenderModel(kind: RenderKind): DeviceModel {
  if (kind === 'ric' || kind === 'bte' || kind === 'cic') return buildDeviceModel(kind);
  return buildShellVariant(kind);
}
