/**
 * Renderer, kamera, ışıklar, ortam (RoomEnvironment → PMREM), yumuşak temas gölgesi,
 * render döngüsü (yalnızca gerekince çizer), boyut/görünürlük gözlemcileri,
 * WebGL bağlam kaybı ve tam `dispose()`.
 *
 * Bu dosya modele özgü mantık içermez; `createScene()` bir `DeviceModel` alır ve onu
 * çerçeveler; `setModel()` ile model çalışma zamanında değiştirilebilir (yeniden çerçeveleme
 * dahil). `createStudio()` ışık/ortam/zemin kurulumunu çevrimdışı render (render.ts) ile paylaşır.
 */
import {
  ACESFilmicToneMapping,
  DirectionalLight,
  Group,
  Matrix4,
  Mesh,
  type Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShadowMaterial,
  Sphere,
  Spherical,
  SRGBColorSpace,
  TOUCH,
  Vector2,
  Vector3,
  VSMShadowMap,
  WebGLRenderer,
  type WebGLRenderTarget,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { DeviceModel } from './types.ts';

export const MAX_DPR = 1.75;
/** Paketlenmiş model, kısa canvas kenarının bu oranını doldurur. */
const FILL = 0.74;
/** Gölge düzleminin en alt noktadan uzaklığı (sahne birimi) — açık kapak da düzlemin üstünde kalsın. */
const GROUND_GAP = 1.1;

const WORLD_UP = new Vector3(0, 1, 0);

export interface HomeView {
  target: Vector3;
  theta: number;
  phi: number;
  /** Geçerli en-boy oranı için ana uzaklık (yeniden boyutta güncellenir). */
  radius: number;
}

/* ----------------------------------------------------------------------------
 * Stüdyo: ışıklar + ortam + temas gölgesi (etkileşimli sahne ve çevrimdışı render ortak)
 * ------------------------------------------------------------------------- */

export interface Studio {
  /** Işıkları, gölge kamerasını ve zemini modele göre konumlar. */
  setModel(model: DeviceModel): void;
  /** Temas gölgesi düzlemi (kompozit render için kapatılabilir). */
  setGroundShadow(visible: boolean): void;
  rebuildEnvironment(): void;
  dispose(): void;
}

export function configureRenderer(renderer: WebGLRenderer): void {
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = VSMShadowMap;
}

export function createStudio(scene: Scene, renderer: WebGLRenderer): Studio {
  /* ---- ışıklar (nötr, ürün fotoğrafı) ---- */
  // Ana ışık neredeyse tepeden: gölge modelin hemen altında, dar ve yumuşak kalır.
  const key = new DirectionalLight(0xffffff, 1.6);
  key.castShadow = true;
  key.shadow.mapSize.set(256, 256); // düşük çözünürlük + geniş VSM bulanıklığı = yumuşak temas gölgesi
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 18;
  key.shadow.radius = 10;
  key.shadow.blurSamples = 12;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);

  // Kenar ışığı: kameranın karşısından (arka-sol, üst)
  const rim = new DirectionalLight(0xffffff, 0.9);
  scene.add(rim, rim.target);

  /* ---- temas gölgesi: ShadowMaterial zemin ---- */
  const groundGeo = new PlaneGeometry(12, 12);
  const groundMat = new ShadowMaterial({ color: 0x112b3c, opacity: 0.12 });
  const ground = new Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  /* ---- ortam (RoomEnvironment → PMREM; dosya yok) ---- */
  let envTarget: WebGLRenderTarget | null = null;
  const rebuildEnvironment = (): void => {
    if (envTarget) {
      envTarget.dispose();
      envTarget = null;
    }
    const pmrem = new PMREMGenerator(renderer);
    const envScene = new RoomEnvironment();
    envTarget = pmrem.fromScene(envScene, 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.9;
    envScene.dispose();
    pmrem.dispose();
  };
  rebuildEnvironment();

  const setModel = (model: DeviceModel): void => {
    const c = model.center;
    key.position.copy(c).add(new Vector3(-0.18, 1, 0.22).normalize().multiplyScalar(8));
    key.target.position.copy(c);
    rim.position.copy(c).add(new Vector3(-0.7, 0.5, -1).normalize().multiplyScalar(8));
    rim.target.position.copy(c);
    // Gölge kamerası: açılmış hal + açık kapak sığsın
    const half = Math.max(2.2, model.boundsExploded.getBoundingSphere(new Sphere()).radius * 1.35);
    key.shadow.camera.left = -half;
    key.shadow.camera.right = half;
    key.shadow.camera.top = half;
    key.shadow.camera.bottom = -half;
    key.shadow.camera.updateProjectionMatrix();
    ground.position.set(c.x, model.bounds.min.y - GROUND_GAP, c.z);
  };

  return {
    setModel,
    setGroundShadow: (visible) => {
      ground.visible = visible;
    },
    rebuildEnvironment,
    dispose: () => {
      groundGeo.dispose();
      groundMat.dispose();
      key.shadow.dispose();
      if (envTarget) {
        envTarget.dispose();
        envTarget = null;
      }
      scene.environment = null;
      scene.remove(key, key.target, rim, rim.target, ground);
    },
  };
}

/* ----------------------------------------------------------------------------
 * Sığdırma
 * ------------------------------------------------------------------------- */

/** Kök altındaki tüm mesh köşe noktalarını kök uzayında toplar (sığdırma için; dinlenme halinde çağrılır). */
export function collectPoints(root: Group): Vector3[] {
  const out: Vector3[] = [];
  const m = new Matrix4();
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || !mesh.visible) return;
    m.identity();
    for (let node: Object3D | null = mesh; node && node !== root; node = node.parent) {
      node.updateMatrix();
      m.premultiply(node.matrix);
    }
    const pos = mesh.geometry.getAttribute('position');
    const step = pos.count > 4000 ? 2 : 1;
    for (let i = 0; i < pos.count; i += step) out.push(new Vector3().fromBufferAttribute(pos, i).applyMatrix4(m));
  });
  return out;
}

/**
 * Perspektif sığdırma: `points` (kök uzayı) `dir` yönünden bakıldığında kısa kenarın
 * `fill` oranını dolduracak uzaklık ve silüeti ortalayan hedef nokta.
 * Yansıtılan aralık uzaklığa doğrusal olmadığından birkaç yineleme yapılır.
 */
export function fitView(
  points: readonly Vector3[],
  dir: Vector3,
  center: Vector3,
  fovDeg: number,
  aspect: number,
  fill: number,
): { distance: number; target: Vector3 } {
  const tanV = Math.tan((fovDeg * Math.PI) / 360);
  const tanH = tanV * aspect;
  const forward = dir.clone().negate();
  const right = new Vector3().crossVectors(forward, WORLD_UP);
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
  right.normalize();
  const up = new Vector3().crossVectors(right, forward).normalize();
  const target = center.clone();
  const o = new Vector3();
  let distance = 0;
  for (const p of points) distance = Math.max(distance, o.copy(p).sub(center).length());
  distance = distance / (tanV * fill) + 1;
  for (let iter = 0; iter < 5; iter++) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      o.copy(p).sub(target);
      const dist = Math.max(0.05, distance - o.dot(dir));
      const xn = o.dot(right) / (dist * tanH);
      const yn = o.dot(up) / (dist * tanV);
      if (xn < minX) minX = xn;
      if (xn > maxX) maxX = xn;
      if (yn < minY) minY = yn;
      if (yn > maxY) maxY = yn;
    }
    const cx = (maxX + minX) / 2;
    const cy = (maxY + minY) / 2;
    target.addScaledVector(right, cx * distance * tanH).addScaledVector(up, cy * distance * tanV);
    const span = Math.max(maxX - minX, maxY - minY);
    distance *= span / (2 * fill);
  }
  return { distance, target };
}

/* ----------------------------------------------------------------------------
 * Etkileşimli sahne
 * ------------------------------------------------------------------------- */

export interface SceneOptions {
  canvas: HTMLCanvasElement;
  /** Görünürlük (IntersectionObserver) için gözlenen kök eleman. */
  root: HTMLElement;
  model: DeviceModel;
}

export interface SceneHandle {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  /** Modelin bağlı olduğu grup (parçalanma sırasında ortalanır/küçülür). */
  pivot: Group;
  home: HomeView;
  /** Modeli değiştirir ve ana bakışı yeniden hesaplar (kamerayı taşımaz; `home` güncellenir). */
  setModel(model: DeviceModel): void;
  /** Bir sonraki karede çizim iste (durum değiştiyse). */
  requestRender(): void;
  /**
   * Her karede, `controls.update()` öncesi çağrılır. `true` dönerse kare çizilir
   * (tween/vurgu gibi kamera dışı değişimler için).
   */
  setFrameCallback(cb: ((time: number, dt: number) => boolean) | null): void;
  /** Her çizimden sonra (hotspot projeksiyonu için). */
  setAfterRender(cb: (() => void) | null): void;
  /** Parçalanma oranına göre pivotu yeniden ortalar ve küçültür (0..1). */
  setExplodeFraming(t: number): void;
  setUserPaused(paused: boolean): void;
  isRunning(): boolean;
  /** Anında tek kare çizer (döngüden bağımsız). */
  renderOnce(): void;
  captureImage(width?: number, height?: number): string;
  dispose(): void;
}

export function createScene(opts: SceneOptions): SceneHandle {
  const { canvas, root } = opts;

  /* ---- renderer ---- */
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
  configureRenderer(renderer);
  canvas.style.touchAction = 'pan-y';
  canvas.style.display = canvas.style.display || 'block';

  /* ---- sahne / kamera / pivot ---- */
  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 0.1, 80);
  const pivot = new Group();
  pivot.name = 'pivot';
  scene.add(pivot);
  const studio = createStudio(scene, renderer);

  let model = opts.model;
  let restCenter = new Vector3();
  const explodeShift = new Vector3();
  let explodeZoomOut = 0.22;
  let fitPoints: Vector3[] = [];
  let homeDir = new Vector3(0, 0, 1);
  let width = 1;
  let height = 1;
  let dirty = true;
  const home: HomeView = { target: new Vector3(), theta: 0, phi: Math.PI / 2, radius: 5 };

  const homeDistanceFor = (aspect: number): number =>
    fitView(fitPoints, homeDir, restCenter, camera.fov, Math.max(aspect, 0.2), FILL).distance;

  const setExplodeFraming = (t: number): void => {
    const k = Math.min(1, Math.max(0, t));
    const s = 1 / (1 + explodeZoomOut * k);
    pivot.scale.setScalar(s);
    pivot.position.copy(restCenter).addScaledVector(explodeShift, -s * k);
    dirty = true;
  };

  /* ---- kontroller ---- */
  const controls = new OrbitControls(camera, canvas);
  // OrbitControls sets touch-action:none in connect(); restore vertical page scrolling.
  canvas.style.touchAction = 'pan-y';
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  // Tekerlek sayfayı kaydırır (sahne üzerinde sayfa kilitlenmesin). Yakınlaştırma: Ctrl/⌘ + tekerlek (trackpad kıstırma
  // da ctrlKey'li tekerlek olayıdır), dokunmatik iki parmak ve klavye (+ / −). Kapı, OrbitControls'ün kendi dinleyicisinden
  // önce (yakalama evresinde) açılıp kapanır.
  controls.enableZoom = false;
  const zoomGate = (e: WheelEvent): void => {
    controls.enableZoom = e.ctrlKey || e.metaKey;
  };
  const touchZoom = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') controls.enableZoom = true;
  };
  const gateHost = canvas.parentElement ?? canvas;
  gateHost.addEventListener('wheel', zoomGate, { capture: true, passive: true });
  gateHost.addEventListener('pointerdown', touchZoom, { capture: true, passive: true });
  controls.zoomSpeed = 0.8;
  controls.rotateSpeed = 0.9;
  controls.autoRotate = false; // index.ts yönetir
  controls.autoRotateSpeed = 0.9;
  controls.minPolarAngle = 0.08;
  controls.maxPolarAngle = Math.PI * 0.92;
  controls.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };

  const setModel = (next: DeviceModel): void => {
    if (model.root.parent === pivot) pivot.remove(model.root);
    model = next;
    // Model merkezi pivot orijinine gelsin: ölçek/kaydırma merkez etrafında olur.
    restCenter = model.center.clone();
    explodeShift.copy(model.boundsExploded.getCenter(new Vector3())).sub(restCenter);
    model.root.position.copy(restCenter).negate();
    pivot.position.copy(restCenter);
    pivot.scale.setScalar(1);
    pivot.add(model.root);
    // Açılmış hal, dinlenme haline göre ne kadar büyükse pivot o kadar küçülür.
    const restSize = model.bounds.getSize(new Vector3());
    const expSize = model.boundsExploded.getSize(new Vector3());
    // Pay: kameraya doğru açılan parçalar (CIC kapağı) perspektifte büyür; açık pil kapağı da ek yer kaplar.
    const ratio = Math.max(expSize.x, expSize.y, expSize.z) / Math.max(1e-6, Math.max(restSize.x, restSize.y, restSize.z));
    explodeZoomOut = Math.max(0.1, ratio - 1) * 1.3 + 0.08;
    // Çerçeveleme: paketlenmiş silüet, tam perspektif sığdırma
    homeDir = model.homeDir.clone().normalize();
    fitPoints = collectPoints(model.root);
    const fit = fitView(fitPoints, homeDir, restCenter, camera.fov, 1, FILL);
    const sph = new Spherical().setFromVector3(homeDir);
    home.target.copy(fit.target);
    home.theta = sph.theta;
    home.phi = sph.phi;
    home.radius = homeDistanceFor(width / height);
    controls.minDistance = home.radius * 0.55;
    controls.maxDistance = home.radius * 2.2;
    studio.setModel(model);
    dirty = true;
  };

  setModel(model);
  controls.target.copy(home.target);
  camera.position.copy(home.target).addScaledVector(homeDir, home.radius);
  camera.lookAt(home.target);
  controls.update();

  /* ---- boyut ---- */
  const applyPixelRatio = (): boolean => {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    if (renderer.getPixelRatio() !== dpr) {
      renderer.setPixelRatio(dpr);
      return true;
    }
    return false;
  };

  const setSize = (w: number, h: number): void => {
    if (w < 1 || h < 1) return;
    const aspect = w / h;
    const prevHome = home.radius;
    const nextHome = homeDistanceFor(aspect);
    width = w;
    height = h;
    applyPixelRatio();
    renderer.setSize(w, h, false);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    // Kullanıcının yakınlaştırmasını koruyarak çerçeveyi orantılı ölçekle
    if (Math.abs(nextHome - prevHome) > 1e-6) {
      const ratio = nextHome / prevHome;
      const offset = camera.position.clone().sub(controls.target).multiplyScalar(ratio);
      camera.position.copy(controls.target).add(offset);
      home.radius = nextHome;
    }
    controls.minDistance = home.radius * 0.55;
    controls.maxDistance = home.radius * 2.2;
    dirty = true;
  };

  /* ---- döngü ---- */
  let frameCb: ((time: number, dt: number) => boolean) | null = null;
  let afterRender: (() => void) | null = null;
  let last = 0;
  let userPaused = false;
  let hidden = typeof document !== 'undefined' && document.hidden;
  let offscreen = false;
  let contextLost = false;
  let running = false;
  let disposed = false;

  const loop = (time: number): void => {
    const dt = last > 0 ? Math.min((time - last) / 1000, 0.1) : 1 / 60;
    last = time;
    const need = frameCb ? frameCb(time, dt) : false;
    const moved = controls.update(dt);
    if (need || moved || dirty) {
      dirty = false;
      renderer.render(scene, camera);
      afterRender?.();
    }
  };

  const sync = (): void => {
    const shouldRun = !disposed && !userPaused && !hidden && !offscreen && !contextLost;
    if (shouldRun === running) return;
    running = shouldRun;
    last = 0;
    renderer.setAnimationLoop(shouldRun ? loop : null);
  };

  /* ---- gözlemciler ---- */
  const initialRect = canvas.getBoundingClientRect();
  setSize(Math.round(initialRect.width) || canvas.clientWidth || 300, Math.round(initialRect.height) || canvas.clientHeight || 150);

  const ro = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const box = entry.contentBoxSize?.[0];
      const w = box ? box.inlineSize : entry.contentRect.width;
      const h = box ? box.blockSize : entry.contentRect.height;
      setSize(Math.round(w), Math.round(h));
    }
  });
  ro.observe(canvas);

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) offscreen = !entry.isIntersecting;
      sync();
    },
    { threshold: 0 },
  );
  io.observe(root);

  const onVisibility = (): void => {
    hidden = document.hidden;
    sync();
  };
  document.addEventListener('visibilitychange', onVisibility);

  const onWindowResize = (): void => {
    if (applyPixelRatio()) {
      renderer.setSize(width, height, false);
      dirty = true;
    }
  };
  window.addEventListener('resize', onWindowResize);

  const onContextLost = (e: Event): void => {
    e.preventDefault();
    contextLost = true;
    sync();
  };
  const onContextRestored = (): void => {
    contextLost = false;
    studio.rebuildEnvironment();
    dirty = true;
    sync();
  };
  canvas.addEventListener('webglcontextlost', onContextLost, false);
  canvas.addEventListener('webglcontextrestored', onContextRestored, false);

  sync();

  /* ---- API ---- */
  const renderOnce = (): void => {
    if (contextLost || disposed) return;
    controls.update(0);
    renderer.render(scene, camera);
    afterRender?.();
  };

  const captureImage = (w?: number, h?: number): string => {
    if (contextLost || disposed) return '';
    if (w && h && w > 0 && h > 0) {
      const prevPR = renderer.getPixelRatio();
      const prevSize = renderer.getSize(new Vector2());
      const prevAspect = camera.aspect;
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      const url = canvas.toDataURL('image/png');
      renderer.setPixelRatio(prevPR);
      renderer.setSize(prevSize.x, prevSize.y, false);
      camera.aspect = prevAspect;
      camera.updateProjectionMatrix();
      dirty = true;
      return url;
    }
    renderer.render(scene, camera);
    return canvas.toDataURL('image/png');
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    sync();
    renderer.setAnimationLoop(null);
    ro.disconnect();
    io.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', onWindowResize);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    gateHost.removeEventListener('wheel', zoomGate, { capture: true });
    gateHost.removeEventListener('pointerdown', touchZoom, { capture: true });
    controls.dispose();
    studio.dispose();
    pivot.remove(model.root);
    scene.clear();
    renderer.dispose();
  };

  return {
    renderer,
    scene,
    camera,
    controls,
    pivot,
    home,
    setModel,
    requestRender: () => {
      dirty = true;
    },
    setFrameCallback: (cb) => {
      frameCb = cb;
    },
    setAfterRender: (cb) => {
      afterRender = cb;
    },
    setExplodeFraming,
    setUserPaused: (p) => {
      userPaused = p;
      sync();
    },
    isRunning: () => running,
    renderOnce,
    captureImage,
    dispose,
  };
}
