/**
 * 3B cihaz inceleme bölümü: motoru (three) yalnızca bölüm görünür olunca veya düğmeyle yükler,
 * kontrolleri ve hotspot'ları bağlar; WebGL yoksa statik posteri ve açıklamaları bırakır.
 */
import { prefersReducedMotion, isDev } from './config';
import { track } from './analytics';
import type { ViewerController, PartId } from './viewer/types';

export function initExplorer(): void {
  const root = document.querySelector<HTMLElement>('[data-explorer]');
  if (!root) return;
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const startBtn = root.querySelector<HTMLButtonElement>('[data-start]')!;
  const fallback = root.querySelector<HTMLElement>('[data-fallback]')!;
  const range = root.querySelector<HTMLInputElement>('[data-explode-range]')!;
  const toggle = root.querySelector<HTMLButtonElement>('[data-explode-toggle]')!;
  const resetBtn = root.querySelector<HTMLButtonElement>('[data-reset]')!;
  const autoBtn = root.querySelector<HTMLButtonElement>('[data-autorotate]')!;
  const hotspots = new Map<string, HTMLButtonElement>();
  root.querySelectorAll<HTMLButtonElement>('[data-hotspot]').forEach((b) => hotspots.set(b.dataset.hotspot!, b));
  const parts = new Map<string, HTMLDetailsElement>();
  root.querySelectorAll<HTMLDetailsElement>('[data-part]').forEach((d) => parts.set(d.dataset.part!, d));

  const reduced = prefersReducedMotion();
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
  // WebGL testi ilk yüklemede DEĞİL, motor yüklenirken yapılır (context oluşturmak ana iş parçacığını meşgul eder).
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
  const showFallback = () => {
    root.dataset.state = 'error';
    fallback.hidden = false;
  };

  let controller: ViewerController | null = null;
  let loading = false;
  let interacted = false;
  autoBtn.setAttribute('aria-pressed', String(!reduced));

  const setActivePart = (id: PartId | null) => {
    parts.forEach((d, k) => d.classList.toggle('is-active', k === id));
    hotspots.forEach((b, k) => b.classList.toggle('is-active', k === id));
  };

  const mount = async () => {
    if (controller || loading) return;
    loading = true;
    if (!probeWebGL()) {
      loading = false;
      showFallback();
      return;
    }
    root.dataset.state = 'loading';
    try {
      const mod = await import('./viewer/index');
      const ctrl = await mod.mountDeviceViewer(root, {
        canvas,
        reducedMotion: reduced,
        autoRotate: !reduced,
        onReady: () => {
          root.dataset.state = 'ready';
          root.querySelector('[data-hotspots]')?.setAttribute('aria-hidden', 'false');
        },
        onExplodeChange: (value) => syncToggle(value),
        onAutoRotateChange: (enabled) => autoBtn.setAttribute('aria-pressed', String(enabled)),
        onInteract: () => {
          if (interacted) return;
          interacted = true;
          track('product_explore', { mode: '3d' });
        },
        onHotspot: (id, x, y, visible) => {
          const b = hotspots.get(id);
          if (!b) return;
          b.style.setProperty('--x', `${x}px`);
          b.style.setProperty('--y', `${y}px`);
          b.classList.toggle('is-visible', visible);
          b.hidden = !visible;
          b.tabIndex = visible ? 0 : -1;
        },
      });
      controller = ctrl;
      if (isDev) (window as unknown as { __ayazViewer: ViewerController }).__ayazViewer = ctrl;
    } catch (err) {
      if (isDev) console.error('[explorer]', err);
      showFallback();
    } finally {
      loading = false;
    }
  };

  startBtn.addEventListener('click', () => void mount());
  // Motor yalnızca sahne gerçekten görünür olunca (≥%25) ve tarayıcı boşken yüklenir;
  // ilk yükleme/LCP/TBT ölçümüne karışmaz. Veri tasarrufu açıksa yalnızca düğmeyle.
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

  // Kontroller
  const syncToggle = (t: number) => {
    const on = t > 0.5;
    toggle.setAttribute('aria-pressed', String(on));
    toggle.querySelector('span')!.textContent = on ? toggle.dataset.labelOn || '' : toggle.dataset.labelOff || '';
    range.value = String(Math.round(t * 100));
    range.setAttribute('aria-valuetext', `${Math.round(t * 100)}%`);
  };
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
  resetBtn.addEventListener('click', () => {
    controller?.reset();
    syncToggle(0);
    parts.forEach((d) => { d.open = false; });
    setActivePart(null);
  });
  autoBtn.addEventListener('click', () => {
    const on = autoBtn.getAttribute('aria-pressed') !== 'true';
    autoBtn.setAttribute('aria-pressed', String(on));
    controller?.setAutoRotate(on);
  });

  // Hotspot ↔ açıklama listesi
  hotspots.forEach((b, id) => {
    b.addEventListener('click', () => {
      const d = parts.get(id);
      if (d) {
        d.open = true;
        d.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
      }
      controller?.focusPart(id as PartId);
      setActivePart(id as PartId);
    });
  });
  parts.forEach((d, id) => {
    d.addEventListener('toggle', () => {
      if (d.open) {
        controller?.focusPart(id as PartId);
        setActivePart(id as PartId);
      } else if (root.querySelector('[data-part][open]') === null) {
        controller?.highlightPart(null);
        setActivePart(null);
      }
    });
  });

  // Bölüm görünür olduğunda ürün keşfi olayı (3B yüklenmese de)
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
