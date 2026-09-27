/**
 * Çevrimdışı ön ayar render'ı — `scripts/render-device-views.mjs` için (dev sayfası
 * `window.__ayazRender(kind, opts)` olarak açar). Etkileşimli sahneden bağımsız, kendi
 * gizli canvas'ı ve renderer'ı ile çalışır; aynı stüdyo kurulumunu (`createStudio`) kullanır.
 *
 * Ölçek sabittir: kamera uzaklığı ve fov (18°) tüm türlerde aynı → model merkez düzleminde
 * mm/piksel tüm çıktılarda eşittir (`mmPerPx`). Katman maskeleri (`layer`) aynı kamerayla
 * çizildiğinden çıktılar piksel-piksel üst üste biner.
 */
import { type Mesh, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { buildRenderModel, type RenderKind, UNIT_MM } from './model.ts';
import type { Connector } from './parts.ts';
import { collectPoints, configureRenderer, createStudio, fitView, type Studio } from './scene.ts';
import type { DeviceModel } from './types.ts';

export type RenderLayer = 'all' | 'body' | 'front';

export interface RenderViewOptions {
  /** Çıktı yüksekliği (px). Varsayılan 1200. */
  height?: number;
  /** Çıktı genişliği (px). Varsayılan = yükseklik. */
  width?: number;
  /** Dikey görüş açısı (derece). Varsayılan 18 (uzun lens, ortografiğe yakın). */
  fovDeg?: number;
  /** Model merkez düzleminde canvas yüksekliğinin karşılığı (mm). Varsayılan 54. */
  viewHeightMm?: number;
  /** Modelden kameraya yön (model uzayı). Varsayılan: türe göre `RENDER_DIRS`; `'home'` = modelin ana bakışı (poster). */
  dir?: Vector3 | [number, number, number] | 'home';
  layer?: RenderLayer;
  /** Yalnızca bu parçalar çizilir (`layer`'ı geçersiz kılar). Kamera yine TÜM modelin merkezine bakar (ölçek/konum sabit). */
  parts?: string[];
  /** Bu adlı meshler gizlenir (ör. `'wire-cable'` → yalnızca konektör kalır). */
  hideMeshes?: string[];
  /**
   * Otomatik çerçeveleme (0..1): görünen silüet kadrajın bu oranını doldurur (ürün küçük resmi için).
   * Verilirse `viewHeightMm` yok sayılır ve ölçek türden türe değişir (`mmPerPx` sonuçta döner).
   */
  fit?: number;
  /** Kapak tam açık (`door: 1` ile aynı). */
  doorOpen?: boolean;
  /** Kapak açıklığı 0..1 (ara karelerin denetimi için); verilirse `doorOpen`'ı geçersiz kılar. */
  door?: number;
  explode?: number;
  /** Kameranın baktığı nokta (model uzayı, birim). Varsayılan: modelin dinlenme merkezi (yakın çekimler için). */
  target?: [number, number, number];
  /** Temas gölgesi düzlemi. Kompozit için varsayılan kapalı. */
  groundShadow?: boolean;
}

export interface RenderViewResult {
  kind: RenderKind;
  layer: RenderLayer;
  dataUrl: string;
  width: number;
  height: number;
  /** Model merkez düzleminde 1 pikselin mm karşılığı. */
  mmPerPx: number;
  /** Model üçgen sayısı. */
  triangleCount: number;
  /**
   * Bağlantı noktalarının (hortum/kablo uçları) çıktı pikseli: sol-üst köşe orijinli; `dx/dy`
   * yönün görüntü düzlemindeki birim vektörü (y aşağı). Yalnızca modelin tanımladıkları.
   */
  connectors: Record<string, { x: number; y: number; dx?: number; dy?: number }>;
  /** Modelin ölçü bilgileri (ör. BTE: `tubeOuterMm`, `tubeInnerMm`, `hookOuterMm`); yoksa boş. */
  dims: Record<string, number>;
}

/**
 * Tür başına bakış yönü (modelden kameraya). Kulak arkası tipler: yan görünüş (+Z), hafif
 * arkadan-üstten; kulak içi kabuklar: faceplate dıştan görünür, hafif eğik (derinlik ipucu).
 */
export const RENDER_DIRS: Record<RenderKind, [number, number, number]> = {
  ric: [-0.1, 0.06, 1],
  bte: [-0.1, 0.06, 1],
  cic: [-0.4, 0.26, 1],
  ite: [-0.4, 0.26, 1],
  itc: [-0.4, 0.26, 1],
  iic: [-0.4, 0.26, 1],
};

interface RenderContext {
  canvas: HTMLCanvasElement;
  renderer: WebGLRenderer;
  scene: Scene;
  studio: Studio;
  camera: PerspectiveCamera;
}

let ctx: RenderContext | null = null;

function getContext(): RenderContext {
  if (ctx) return ctx;
  const canvas = document.createElement('canvas');
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: false });
  configureRenderer(renderer);
  renderer.setPixelRatio(1);
  const scene = new Scene();
  const studio = createStudio(scene, renderer);
  const camera = new PerspectiveCamera(18, 1, 0.5, 100);
  ctx = { canvas, renderer, scene, studio, camera };
  return ctx;
}

/** Render bağlamını serbest bırakır (dev sayfası kapanırken isteğe bağlı). */
export function disposeRenderContext(): void {
  if (!ctx) return;
  ctx.studio.dispose();
  ctx.scene.clear();
  ctx.renderer.dispose();
  ctx = null;
}

export function renderDeviceView(kind: RenderKind, opts: RenderViewOptions = {}): RenderViewResult {
  const height = Math.max(64, Math.round(opts.height ?? 1200));
  const width = Math.max(64, Math.round(opts.width ?? height));
  const fovDeg = opts.fovDeg ?? 18;
  const viewHeightMm = opts.viewHeightMm ?? 54;
  const layer: RenderLayer = opts.layer ?? 'all';
  const { renderer, scene, studio, camera, canvas } = getContext();
  const model: DeviceModel = buildRenderModel(kind);
  const dirIn = opts.dir ?? RENDER_DIRS[kind];
  const dir = (dirIn === 'home' ? model.homeDir.clone() : Array.isArray(dirIn) ? new Vector3(dirIn[0], dirIn[1], dirIn[2]) : dirIn.clone()).normalize();
  scene.add(model.root);
  studio.setModel(model);
  studio.setGroundShadow(opts.groundShadow ?? false);

  // Görünürlük mesh düzeyinde (grup gizlenirse çocuk parçalar da gizlenirdi: pil kapağın çocuğu)
  const hide = new Set(opts.hideMeshes ?? []);
  for (const part of model.partList) {
    const on = opts.parts ? opts.parts.includes(part.id) : layer === 'all' || part.layer === layer;
    for (const child of part.object.children) {
      // `userData.proxy`: yalnızca çarpışma/denetim hacmi (ör. kabuk pil bölmesi) — hiçbir zaman çizilmez
      if ((child as Mesh).isMesh) child.visible = on && !hide.has(child.name) && child.userData.proxy !== true;
    }
  }
  model.setExplode(opts.explode ?? 0);
  // ITE / ITC / IIC yalnızca kapalı-kapak render türevleridir (pil bölmesi hacmi yok, açılış çarpışma denetimsiz):
  // kapak açma isteği yok sayılır (geçersiz geometri üretmesin).
  const doorReq = opts.door ?? (opts.doorOpen ? 1 : 0);
  const closedOnly = kind === 'ite' || kind === 'itc' || kind === 'iic';
  if (closedOnly && doorReq > 0 && import.meta.env?.DEV) console.warn(`[render] "${kind}" yalnızca kapalı kapakla çizilir; door=${doorReq} yok sayıldı.`);
  model.setDoor(closedOnly ? 0 : doorReq);
  model.root.updateMatrixWorld(true);

  const tanHalf = Math.tan((fovDeg * Math.PI) / 360);
  let distance: number;
  let target = opts.target ? new Vector3(opts.target[0], opts.target[1], opts.target[2]) : model.center.clone();
  if (opts.fit) {
    const fit = fitView(collectPoints(model.root), dir, model.center, fovDeg, width / height, opts.fit);
    distance = fit.distance;
    target = fit.target;
  } else {
    // Uzaklık: merkez düzleminde canvas yüksekliği = viewHeightMm
    distance = viewHeightMm / UNIT_MM / (2 * tanHalf);
  }
  const mmPerPx = (2 * tanHalf * distance * UNIT_MM) / height;

  camera.fov = fovDeg;
  camera.aspect = width / height;
  camera.near = Math.max(0.1, distance - 6);
  camera.far = distance + 6;
  camera.updateProjectionMatrix();
  camera.position.copy(target).addScaledVector(dir, distance);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);

  renderer.setSize(width, height, false);
  renderer.render(scene, camera);
  const dataUrl = canvas.toDataURL('image/png');

  // Bağlantı noktaları → piksel
  const connectors: RenderViewResult['connectors'] = {};
  const conn = (model.root.userData.connectors ?? {}) as Record<string, Connector>;
  const toPx = (p: Vector3): { x: number; y: number } => {
    const v = p.clone().applyMatrix4(model.root.matrixWorld).project(camera);
    return { x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height };
  };
  for (const [name, c] of Object.entries(conn)) {
    const a = toPx(c.p);
    const out: { x: number; y: number; dx?: number; dy?: number } = { x: a.x, y: a.y };
    if (c.dir) {
      const b = toPx(c.p.clone().addScaledVector(c.dir, 0.05));
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      out.dx = (b.x - a.x) / len;
      out.dy = (b.y - a.y) / len;
    }
    connectors[name] = out;
  }

  const dims = { ...((model.root.userData.dims ?? {}) as Record<string, number>) };
  scene.remove(model.root);
  const triangleCount = model.triangleCount;
  model.dispose();

  return { kind, layer, dataUrl, width, height, mmPerPx, triangleCount, connectors, dims };
}
