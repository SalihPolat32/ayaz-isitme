/**
 * Ayaz İşitme — temsili işitme cihazı 3B görüntüleyici (giriş noktası).
 *
 * Kullanım (Astro bileşeninden, tembel yükleme ile):
 *   const { mountDeviceViewer, isWebGLAvailable } = await import('../scripts/viewer/index.ts');
 *   if (isWebGLAvailable()) controller = await mountDeviceViewer(root, { canvas, onHotspot, deviceType: 'ric' });
 *
 * Çerçeve bağımsızdır; yalnızca `three` kullanır. Modeller harici varlık içermez.
 * Üç cihaz (RIC 312 / BTE 13 / CIC 10) `setDeviceType()` ile çalışma zamanında değiştirilir;
 * hepsinde animasyonlu pil kapağı vardır (`setBatteryDoor`, klavye `b`).
 */
import { Vector2, Vector3 } from 'three';
import { applyView, CameraMover, orbitStep } from './camera.ts';
import { ExplodeController } from './explode.ts';
import { createHotspotTracker } from './hotspots.ts';
import { buildDeviceModel, HIGHLIGHT_COLOR } from './model.ts';
import { createScene } from './scene.ts';
import { type DeviceModel, type DeviceType, isDeviceType, PART_IDS, type PartId, type ViewerController, type ViewerOptions } from './types.ts';

export type { DeviceModel, DevicePart, DeviceType, PartId, ViewerController, ViewerOptions } from './types.ts';
export { PART_IDS, DEVICE_TYPES } from './types.ts';
export { UNIT_MM, BATTERY_SIZE } from './model.ts';

declare global {
  interface Window {
    /** Yalnızca geliştirme modunda (poster yakalama için). */
    __ayazViewer?: ViewerController;
  }
}

const FOCUS_DURATION = 700;
const RESET_DURATION = 700;
const PULSE_DURATION = 1200;
const DOOR_DURATION = 450;
const AUTOROTATE_HOLD_AFTER_FOCUS = 2500;
const KEY_ROTATE_STEP = 0.12;
const KEY_TILT_STEP = 0.08;
const KEY_ZOOM_FACTOR = 0.88;
const STEADY_EMISSIVE = 0.35;
const PULSE_EMISSIVE = 0.6;
const DOOR_PARTS: ReadonlySet<string> = new Set(['battery', 'battery-door']);

/** WebGL2 var mı? (Yoksa bileşen statik poster gösterir.) */
export function isWebGLAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.WebGL2RenderingContext) return false;
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

interface Highlight {
  mode: 'pulse' | 'steady';
  start: number;
  applied: boolean;
}

export async function mountDeviceViewer(root: HTMLElement, opts: ViewerOptions): Promise<ViewerController> {
  const { canvas } = opts;
  const reducedMotion =
    opts.reducedMotion ?? (typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)').matches : false);
  let autoRotatePref = opts.autoRotate ?? !reducedMotion;
  let autoRotateEnabled = autoRotatePref;

  let model: DeviceModel = buildDeviceModel(isDeviceType(opts.deviceType) ? opts.deviceType : 'ric');
  const sc = createScene({ canvas, root, model });
  const { camera, controls } = sc;

  const explode = new ExplodeController((t) => {
    model.setExplode(t);
    sc.setExplodeFraming(t);
    opts.onExplodeChange?.(t);
  }, reducedMotion);
  const door = new ExplodeController(
    (t) => {
      model.setDoor(t);
      sc.requestRender();
    },
    reducedMotion,
    DOOR_DURATION,
  );
  const mover = new CameraMover(camera, controls);
  const tracker = opts.onHotspot ? createHotspotTracker(model, opts.onHotspot) : null;
  const highlights = new Map<PartId, Highlight>();
  const sizeTmp = new Vector2();

  let interacted = false;
  let holdAutoRotateUntil = 0;
  let destroyed = false;
  let switching = 0;

  /* ---- etkileşim ---- */
  const markInteracted = (): void => {
    if (destroyed) return;
    autoRotateEnabled = false;
    opts.onAutoRotateChange?.(false);
    mover.cancel();
    if (!interacted) {
      interacted = true;
      opts.onInteract?.();
    }
  };
  const onControlsStart = (): void => markInteracted();
  controls.addEventListener('start', onControlsStart);

  /* ---- vurgu ---- */
  const setEmissive = (id: PartId, intensity: number): void => {
    const part = model.parts[id];
    if (!part) return;
    for (const m of part.materials) {
      m.emissive.copy(HIGHLIGHT_COLOR);
      m.emissiveIntensity = intensity;
    }
  };
  const clearHighlights = (): void => {
    for (const id of highlights.keys()) setEmissive(id, 0);
    highlights.clear();
  };
  const updateHighlights = (time: number): boolean => {
    if (highlights.size === 0) return false;
    let changed = false;
    for (const [id, h] of highlights) {
      if (h.mode === 'steady') {
        if (!h.applied) {
          setEmissive(id, STEADY_EMISSIVE);
          h.applied = true;
          changed = true;
        }
        continue;
      }
      const p = (time - h.start) / PULSE_DURATION;
      if (p >= 1) {
        setEmissive(id, 0);
        highlights.delete(id);
      } else {
        setEmissive(id, PULSE_EMISSIVE * (0.5 - 0.5 * Math.cos(4 * Math.PI * p)));
      }
      changed = true;
    }
    return changed;
  };

  /* ---- kare döngüsü ---- */
  sc.setFrameCallback((time) => {
    controls.autoRotate = autoRotateEnabled && !mover.active && time >= holdAutoRotateUntil;
    let need = false;
    if (explode.update(time)) need = true;
    if (door.update(time)) need = true;
    if (mover.update(time)) need = true;
    if (updateHighlights(time)) need = true;
    return need;
  });
  if (tracker) {
    sc.setAfterRender(() => {
      sc.renderer.getSize(sizeTmp);
      tracker.update(camera, sizeTmp.x, sizeTmp.y);
    });
  }

  /* ---- parçalanma / kapak ---- */
  const setExplodeInternal = (t: number, animate: boolean, fromUser: boolean): void => {
    if (destroyed) return;
    const k = Math.min(1, Math.max(0, t));
    if (fromUser && Math.abs(k - explode.getTarget()) > 1e-4) markInteracted();
    explode.set(k, animate);
    sc.requestRender();
  };

  const isDoorOpen = (): boolean => door.getTarget() > 0.5;
  const setDoorInternal = (open: boolean, animate: boolean, fromUser: boolean): void => {
    if (destroyed) return;
    const changed = open !== isDoorOpen();
    if (fromUser && changed) markInteracted();
    door.set(open ? 1 : 0, animate);
    if (changed) opts.onDoorChange?.(open);
    sc.requestRender();
  };

  /* ---- klavye (canvas odaklıyken) ---- */
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft':
        markInteracted();
        orbitStep(camera, controls, KEY_ROTATE_STEP, 0);
        break;
      case 'ArrowRight':
        markInteracted();
        orbitStep(camera, controls, -KEY_ROTATE_STEP, 0);
        break;
      case 'ArrowUp':
        markInteracted();
        orbitStep(camera, controls, 0, KEY_TILT_STEP);
        break;
      case 'ArrowDown':
        markInteracted();
        orbitStep(camera, controls, 0, -KEY_TILT_STEP);
        break;
      case '+':
      case '=':
        markInteracted();
        orbitStep(camera, controls, 0, 0, KEY_ZOOM_FACTOR);
        break;
      case '-':
      case '_':
        markInteracted();
        orbitStep(camera, controls, 0, 0, 1 / KEY_ZOOM_FACTOR);
        break;
      case 'r':
      case 'R':
        reset();
        break;
      case 'e':
      case 'E':
        setExplodeInternal(explode.getTarget() > 0.5 ? 0 : 1, true, true);
        break;
      case 'b':
      case 'B':
        setDoorInternal(!isDoorOpen(), true, true);
        break;
      default:
        handled = false;
    }
    if (handled) {
      e.preventDefault();
      sc.requestRender();
    }
  };
  canvas.addEventListener('keydown', onKeyDown);

  /* ---- kamera hareketleri ---- */
  const homeView = () => ({ radius: sc.home.radius, phi: sc.home.phi, theta: sc.home.theta, target: sc.home.target.clone() });

  const reset = (): void => {
    if (destroyed) return;
    mover.cancel();
    clearHighlights();
    explode.set(0, !reducedMotion);
    setDoorInternal(false, !reducedMotion, false);
    autoRotateEnabled = autoRotatePref;
    opts.onAutoRotateChange?.(autoRotateEnabled);
    holdAutoRotateUntil = 0;
    mover.goTo(homeView(), reducedMotion ? 0 : RESET_DURATION);
    sc.requestRender();
  };

  const focusPart = (id: PartId): void => {
    if (destroyed) return;
    const part = model.parts[id];
    if (!part) return;
    const opensDoor = DOOR_PARTS.has(id);
    if (opensDoor) setDoorInternal(true, true, false);

    // Çapayı kapağın HEDEF pozunda hesapla (kapak açılırken pil dışarıda olacak)
    const prevDoor = model.getDoor();
    if (opensDoor) model.setDoor(1);
    part.object.updateWorldMatrix(true, false);
    const anchorW = part.object.localToWorld(part.anchorLocal.clone());
    const normalW = part.anchorNormal.clone().transformDirection(part.object.matrixWorld);
    if (opensDoor) model.setDoor(prevDoor);

    const curDir = camera.position.clone().sub(controls.target).normalize();
    const curRadius = camera.position.distanceTo(controls.target);

    // Parçanın normali ile mevcut bakışın karışımı: kamera "yumuşakça" döner, ters tarafa savrulmaz.
    let dir = normalW.clone().addScaledVector(curDir, 0.7);
    if (dir.lengthSq() < 0.05) dir = normalW.clone().add(new Vector3(0, 0.4, 0));
    dir.y += 0.15;
    dir.normalize();

    const sph = { radius: curRadius, phi: Math.acos(Math.min(1, Math.max(-1, dir.y))), theta: Math.atan2(dir.x, dir.z) };
    const target = sc.home.target.clone().lerp(anchorW, 0.3);
    const now = performance.now();
    holdAutoRotateUntil = now + FOCUS_DURATION + AUTOROTATE_HOLD_AFTER_FOCUS;
    mover.goTo({ ...sph, target }, reducedMotion ? 0 : FOCUS_DURATION);

    const existing = highlights.get(id);
    if (!existing || existing.mode !== 'steady') highlights.set(id, { mode: 'pulse', start: now, applied: false });
    sc.requestRender();
  };

  const highlightPart = (id: PartId | null): void => {
    if (destroyed) return;
    for (const [pid, h] of highlights) {
      if (h.mode === 'steady' && pid !== id) {
        setEmissive(pid, 0);
        highlights.delete(pid);
      }
    }
    if (id && model.parts[id]) {
      highlights.set(id, { mode: 'steady', start: performance.now(), applied: false });
    }
    sc.requestRender();
  };

  /* ---- model değiştirme ---- */
  const setDeviceType = async (type: DeviceType): Promise<void> => {
    if (destroyed || !isDeviceType(type) || type === model.type) return;
    const token = ++switching;
    mover.cancel();
    explode.cancel();
    door.cancel();
    clearHighlights();
    const old = model;
    model = buildDeviceModel(type);
    sc.setModel(model);
    tracker?.setModel(model);
    old.dispose();
    // Parçalanma 0 ve kapak kapalı (bildirimlerle), kamera yeni ana bakışa (anında)
    explode.set(0, false);
    door.set(0, false);
    opts.onDoorChange?.(false);
    holdAutoRotateUntil = 0;
    applyView(homeView(), camera, controls);
    sc.requestRender();
    try {
      await sc.renderer.compileAsync(sc.scene, camera);
    } catch {
      /* ilk çizimde derlenir */
    }
    if (destroyed || token !== switching) return;
    sc.requestRender();
    opts.onDeviceChange?.(type);
  };

  /* ---- shader ön derleme, ilk kare ---- */
  try {
    await sc.renderer.compileAsync(sc.scene, camera);
  } catch {
    /* compileAsync desteklenmiyorsa ilk çizimde derlenir */
  }
  if (destroyed) {
    // mount bitmeden destroy çağrıldıysa
    return controllerStub();
  }
  sc.requestRender();

  const controller: ViewerController = {
    setExplode: (t, animate = true) => setExplodeInternal(t, animate, true),
    getExplode: () => explode.get(),
    explode: () => setExplodeInternal(1, true, true),
    assemble: () => setExplodeInternal(0, true, true),
    reset,
    setAutoRotate: (on) => {
      autoRotatePref = on;
      autoRotateEnabled = on;
      opts.onAutoRotateChange?.(on);
      sc.requestRender();
    },
    focusPart,
    highlightPart,
    setDeviceType,
    getDeviceType: () => model.type,
    getPartIds: () => PART_IDS[model.type],
    setBatteryDoor: (open, animate = true) => setDoorInternal(open, animate, true),
    toggleBatteryDoor: () => setDoorInternal(!isDoorOpen(), true, true),
    isBatteryDoorOpen: isDoorOpen,
    captureImage: (w, h) => sc.captureImage(w, h),
    pause: () => sc.setUserPaused(true),
    resume: () => sc.setUserPaused(false),
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      switching++;
      mover.cancel();
      explode.cancel();
      door.cancel();
      highlights.clear();
      controls.removeEventListener('start', onControlsStart);
      canvas.removeEventListener('keydown', onKeyDown);
      tracker?.dispose();
      sc.setFrameCallback(null);
      sc.setAfterRender(null);
      sc.dispose();
      model.dispose();
      if (window.__ayazViewer === controller) delete window.__ayazViewer;
    },
  };

  if (import.meta.env.DEV) {
    window.__ayazViewer = controller;
  }

  opts.onReady?.();
  return controller;

  function controllerStub(): ViewerController {
    const noop = (): void => {};
    return {
      setExplode: noop,
      getExplode: () => 0,
      explode: noop,
      assemble: noop,
      reset: noop,
      setAutoRotate: noop,
      focusPart: noop,
      highlightPart: noop,
      setDeviceType: async () => {},
      getDeviceType: () => model.type,
      getPartIds: () => PART_IDS[model.type],
      setBatteryDoor: noop,
      toggleBatteryDoor: noop,
      isBatteryDoorOpen: () => false,
      captureImage: () => '',
      pause: noop,
      resume: noop,
      destroy: noop,
    };
  }
}
