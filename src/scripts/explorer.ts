/**
 * 3B cihaz inceleme bölümü: üç model (RIC / BTE / CIC), pil kapağı, ayrışma, hotspot'lar.
 * Motor (three) yalnızca sahne %25 görünür olup tarayıcı boşa düşünce ya da düğmeyle yüklenir.
 * WebGL yoksa poster ve açıklamalar kalır.
 */
import { prefersReducedMotion, isDev } from './config';
import { track } from './analytics';
import type { ViewerController, PartId, DeviceType } from './viewer/types';

export function initExplorer(): void {
  const root = document.querySelector<HTMLElement>('[data-explorer]');
  if (!root) return;
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const startBtn = root.querySelector<HTMLButtonElement>('[data-start]')!;
  const fallback = root.querySelector<HTMLElement>('[data-fallback]')!;
  const range = root.querySelector<HTMLInputElement>('[data-explode-range]')!;
  const toggle = root.querySelector<HTMLButtonElement>('[data-explode-toggle]')!;
  const doorBtn = root.querySelector<HTMLButtonElement>('[data-door]')!;
  const resetBtn = root.querySelector<HTMLButtonElement>('[data-reset]')!;
  const autoBtn = root.querySelector<HTMLButtonElement>('[data-autorotate]')!;
  const modelBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-model-btn]'));

  type Model = DeviceType;
  const isModel = (v: string | undefined): v is Model => v === 'ric' || v === 'bte' || v === 'cic';
  let model: Model = isModel(root.dataset.model) ? root.dataset.model : 'ric';

  // Model başına hotspot düğmeleri ve açıklama listeleri
  const hotspots = new Map<Model, Map<string, HTMLButtonElement>>();
  const parts = new Map<Model, Map<string, HTMLDetailsElement>>();
  root.querySelectorAll<HTMLElement>('[data-hotspots-for]').forEach((g) => {
    const m = g.dataset.hotspotsFor;
    if (!isModel(m)) return;
    const map = new Map<string, HTMLButtonElement>();
    g.querySelectorAll<HTMLButtonElement>('[data-hotspot]').forEach((b) => map.set(b.dataset.hotspot!, b));
    hotspots.set(m, map);
  });
  root.querySelectorAll<HTMLElement>('[data-parts-for]').forEach((g) => {
    const m = g.dataset.partsFor;
    if (!isModel(m)) return;
    const map = new Map<string, HTMLDetailsElement>();
    g.querySelectorAll<HTMLDetailsElement>('[data-part]').forEach((d) => map.set(d.dataset.part!, d));
    parts.set(m, map);
  });
  const activeHotspots = () => hotspots.get(model) ?? new Map<string, HTMLButtonElement>();
  const activeParts = () => parts.get(model) ?? new Map<string, HTMLDetailsElement>();

  const reduced = prefersReducedMotion();
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
  const probeWebGL = () => {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2');
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      return !!gl;
    } catch {
      return false;
    }
  };
  const reloadBtn = root.querySelector<HTMLButtonElement>('[data-reload]')!;
  reloadBtn.addEventListener('click', () => window.location.reload());
  const showFallback = (reason: 'webgl' | 'load') => {
    root.dataset.state = 'error';
    root.dataset.errorReason = reason;
    if (reason === 'load') {
      const title = fallback.querySelector<HTMLElement>('[data-fallback-title]')!;
      const text = fallback.querySelector<HTMLElement>('[data-fallback-text]')!;
      title.textContent = title.dataset.loadTitle ?? '';
      text.textContent = text.dataset.loadText ?? '';
    }
    reloadBtn.hidden = reason !== 'load';
    fallback.hidden = false;
    // Görünmeyen (opacity 0) tuval klavye odağı almasın ve ekran okuyucuya işlemeyen klavye ipucunu okutmasın
    canvas.tabIndex = -1;
    canvas.setAttribute('aria-hidden', 'true');
  };

  let controller: ViewerController | null = null;
  let loading = false;
  let interacted = false;
  autoBtn.setAttribute('aria-pressed', String(!reduced));

  const setActivePart = (id: string | null) => {
    activeParts().forEach((d, k) => d.classList.toggle('is-active', k === id));
    activeHotspots().forEach((b, k) => b.classList.toggle('is-active', k === id));
  };
  const syncToggle = (t: number) => {
    const on = t > 0.5;
    toggle.setAttribute('aria-pressed', String(on));
    range.value = String(Math.round(t * 100));
    range.setAttribute('aria-valuetext', `${Math.round(t * 100)}%`);
  };
  const syncDoor = (open: boolean) => {
    doorBtn.setAttribute('aria-pressed', String(open));
  };
  const hideAllHotspots = () => hotspots.forEach((map) => map.forEach((b) => { b.classList.remove('is-visible', 'is-active'); b.hidden = true; b.tabIndex = -1; }));

  /** Görünür model gruplarını (poster, hotspot, liste, açıklama) değiştir */
  const applyModelUi = (m: Model) => {
    model = m;
    root.dataset.model = m;
    modelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modelBtn === m)));
    root.querySelectorAll<HTMLElement>('[data-poster-for]').forEach((p) => (p.hidden = p.dataset.posterFor !== m));
    root.querySelectorAll<HTMLElement>('[data-hotspots-for]').forEach((g) => (g.hidden = g.dataset.hotspotsFor !== m));
    root.querySelectorAll<HTMLElement>('[data-parts-for]').forEach((g) => (g.hidden = g.dataset.partsFor !== m));
    root.querySelectorAll<HTMLElement>('[data-caption-for]').forEach((p) => (p.hidden = p.dataset.captionFor !== m));
    const caption = root.querySelector<HTMLElement>(`[data-caption-for="${m}"]`)?.textContent ?? '';
    // Klavye ipucu adın parçası olarak kalır (model değişince de)
    canvas.setAttribute('aria-label', canvas.dataset.hint ? `${caption} — ${canvas.dataset.hint}` : caption);
    parts.forEach((map) => map.forEach((d) => (d.open = false)));
    hideAllHotspots();
    syncToggle(0);
    syncDoor(false);
  };

  const mount = async () => {
    if (controller || loading) return;
    loading = true;
    if (!probeWebGL()) {
      loading = false;
      showFallback('webgl');
      return;
    }
    root.dataset.state = 'loading';
    const initialModel = model;
    try {
      const mod = await import('./viewer/index');
      const ctrl = await mod.mountDeviceViewer(root, {
        canvas,
        deviceType: initialModel,
        reducedMotion: reduced,
        autoRotate: !reduced,
        onReady: () => {
          root.dataset.state = 'ready';
          canvas.tabIndex = 0;
          canvas.removeAttribute('aria-hidden');
          root.querySelector('[data-hotspots]')?.setAttribute('aria-hidden', 'false');
        },
        onInteract: () => {
          if (interacted) return;
          interacted = true;
          track('product_explore', { mode: '3d' });
        },
        onExplodeChange: (value: number) => syncToggle(value),
        onAutoRotateChange: (enabled: boolean) => autoBtn.setAttribute('aria-pressed', String(enabled)),
        onDoorChange: (open: boolean) => syncDoor(open),
        onDeviceChange: (type: DeviceType) => applyModelUi(type),
        onHotspot: (id: PartId, x: number, y: number, visible: boolean) => {
          const b = activeHotspots().get(id);
          if (!b) return;
          b.style.setProperty('--x', `${x}px`);
          b.style.setProperty('--y', `${y}px`);
          b.classList.toggle('is-visible', visible);
          // Odaktaki nokta görünmez olursa odak kaybolmasın: sahneye geçer
          if (!visible && document.activeElement === b) canvas.focus({ preventScroll: true });
          b.hidden = !visible;
          b.tabIndex = visible ? 0 : -1;
        },
      });
      controller = ctrl;
      // Yüklenirken başka model seçildiyse sahne o modele geçsin (sekme ↔ sahne uyuşmazlığı olmasın)
      if (model !== initialModel) void ctrl.setDeviceType(model);
      if (isDev) (window as unknown as { __ayazViewer: ViewerController }).__ayazViewer = ctrl;
    } catch (err) {
      if (isDev) console.error('[explorer]', err);
      showFallback('load');
    } finally {
      loading = false;
    }
  };

  startBtn.addEventListener('click', () => void mount());
  if (!saveData && 'IntersectionObserver' in window) {
    const stage = root.querySelector<HTMLElement>('[data-stage]') ?? root;
    const io = new IntersectionObserver(
      (en) => {
        if (en.some((e) => e.isIntersecting && e.intersectionRatio >= 0.25)) {
          io.disconnect();
          const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
          if (idle) idle(() => void mount(), { timeout: 1500 });
          else window.setTimeout(() => void mount(), 200);
        }
      },
      { threshold: [0.25] },
    );
    io.observe(stage);
  }

  // Model seçimi
  modelBtns.forEach((b) => {
    b.addEventListener('click', () => {
      const m = b.dataset.modelBtn;
      if (!isModel(m) || m === model) return;
      applyModelUi(m);
      track('product_explore', { mode: '3d' });
      if (controller) void controller.setDeviceType(m);
    });
  });

  // Kontroller
  range.addEventListener('input', () => {
    const t = Number(range.value) / 100;
    controller?.setExplode(t, false);
    syncToggle(t);
  });
  toggle.addEventListener('click', () => {
    if (!controller) return;
    const to = controller.getExplode() > 0.5 ? 0 : 1;
    controller.setExplode(to, true);
    syncToggle(to);
  });
  doorBtn.addEventListener('click', () => {
    if (!controller) return;
    controller.toggleBatteryDoor();
    syncDoor(controller.isBatteryDoorOpen());
    const d = activeParts().get('battery-door');
    if (controller.isBatteryDoorOpen() && d) d.open = true;
  });
  // Otomatik döndürme düğmesinin durumu, görüntüleyicinin onAutoRotateChange bildirimiyle güncellenir (burada ezilmez)
  resetBtn.addEventListener('click', () => {
    controller?.reset();
    syncToggle(0);
    syncDoor(false);
    activeParts().forEach((d) => (d.open = false));
    setActivePart(null);
  });
  autoBtn.addEventListener('click', () => {
    const on = autoBtn.getAttribute('aria-pressed') !== 'true';
    autoBtn.setAttribute('aria-pressed', String(on));
    controller?.setAutoRotate(on);
  });

  // Klavyeyle bir işaret noktasına gelindiğinde otomatik döndürme durur (odaktaki nokta dönüp kaybolmasın)
  root.querySelector('[data-hotspots]')?.addEventListener('focusin', () => {
    if (controller && autoBtn.getAttribute('aria-pressed') === 'true') controller.setAutoRotate(false);
  });

  // Hotspot ↔ açıklama listesi
  hotspots.forEach((map) => {
    map.forEach((b, id) => {
      b.addEventListener('click', () => {
        const d = activeParts().get(id);
        if (d) {
          d.open = true;
          d.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
        }
        controller?.focusPart(id);
        setActivePart(id);
      });
    });
  });
  parts.forEach((map) => {
    map.forEach((d, id) => {
      d.addEventListener('toggle', () => {
        if (d.open) {
          controller?.focusPart(id);
          setActivePart(id);
          if ((id === 'battery' || id === 'battery-door') && controller) syncDoor(controller.isBatteryDoorOpen());
        } else if (![...activeParts().values()].some((x) => x.open)) {
          controller?.highlightPart(null);
          setActivePart(null);
        }
      });
    });
  });

  if ('IntersectionObserver' in window) {
    const io2 = new IntersectionObserver(
      (en) => {
        if (en.some((e) => e.intersectionRatio > 0.5)) {
          io2.disconnect();
          track('product_explore', { mode: 'view' });
        }
      },
      { threshold: [0.5] },
    );
    io2.observe(root);
  }
}
