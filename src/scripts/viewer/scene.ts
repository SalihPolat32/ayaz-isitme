/**
 * Renderer, kamera, ışıklar, ortam (RoomEnvironment → PMREM), yumuşak temas gölgesi,
 * render döngüsü (yalnızca gerekince çizer), boyut/görünürlük gözlemcileri,
 * WebGL bağlam kaybı ve tam `dispose()`.
 *
 * Bu dosya modele özgü mantık içermez; `createScene()` bir `DeviceModel` alır ve
 * onu çerçeveler. Etkileşim/parçalama/vurgu mantığı `index.ts` içindedir.
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
/**
 * Varsayılan bakış: ön (+X, kablo tarafı) + dış yüz (+Z), hafif üstten.
 * Kablo/alıcı/dome gövdenin önünde, kameraya yakın kalır. Ayna görünüm için x işaretini çevirin.
 */
export const HOME_DIR = new Vector3(-0.32, 0.16, 1.0).normalize();
/** Parçalanma t=1'de pivot bu oranda küçülür (kamera geri çekilmiş gibi) — açılmış hal çerçeveye sığar. */
export const EXPLODE_ZOOM_OUT = 0.22;
/** Gölge düzleminin en alt noktadan uzaklığı (sahne birimi). */
const GROUND_GAP = 0.4;

const WORLD_UP = new Vector3(0, 1, 0);

export interface HomeView {
  target: Vector3;
  theta: number;
  phi: number;
  /** Geçerli en-boy oranı için ana uzaklık (yeniden boyutta güncellenir). */
  radius: number;
}

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
  /** Bir sonraki karede çizim iste (durum değiştiyse). */
  requestRender(): void;
  /**
   * Her karede, `controls.update()` öncesi çağrılır. `true` dönerse kare çizilir
   * (tween/vurgu gibi kamera dışı değişimler için).
   */
  setFrameCallback(cb: ((time: number, dt: number) => boolean) | null): void;
  /** Her çizimden sonra (hotspot projeksiyonu için). */
  setAfterRender(cb: (() => void) | null): void;
  /** Parçalanma oranına göre pivotu yeniden ortalar ve hafifçe küçültür (0..1). */
  setExplodeFraming(t: number): void;
  setUserPaused(paused: boolean): void;
  isRunning(): boolean;
  /** Anında tek kare çizer (döngüden bağımsız). */
  renderOnce(): void;
  captureImage(width?: number, height?: number): string;
  dispose(): void;
}


/** Kök altındaki tüm mesh köşe noktalarını kök uzayında toplar (sığdırma için; dinlenme halinde çağrılır). */
function collectPoints(root: Group): Vector3[] {
  const out: Vector3[] = [];
  const m = new Matrix4();
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
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

export function createScene(opts: SceneOptions): SceneHandle {
  const { canvas, root, model } = opts;

  /* ---- renderer ---- */
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = VSMShadowMap;
  canvas.style.touchAction = 'pan-y';
  canvas.style.display = canvas.style.display || 'block';

  /* ---- sahne / kamera / pivot ---- */
  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 0.1, 60);
  const pivot = new Group();
  pivot.name = 'pivot';
  // Model merkezi pivot orijinine gelsin: ölçek/kaydırma merkez etrafında olur.
  const restCenter = model.center.clone();
  const explodeShift = model.boundsExploded.getCenter(new Vector3()).sub(restCenter);
  model.root.position.copy(restCenter).negate();
  pivot.position.copy(restCenter);
  pivot.add(model.root);
  scene.add(pivot);

  const setExplodeFraming = (t: number): void => {
    const k = Math.min(1, Math.max(0, t));
    const s = 1 / (1 + EXPLODE_ZOOM_OUT * k);
    pivot.scale.setScalar(s);
    pivot.position.copy(restCenter).addScaledVector(explodeShift, -s * k);
    dirty = true;
  };

  /* ---- çerçeveleme: paketlenmiş silüet, tam perspektif sığdırma ---- */
  const fitPoints = collectPoints(model.root);
  const homeFit = fitView(fitPoints, HOME_DIR, restCenter, camera.fov, 1, FILL);
  const homeTarget = homeFit.target;
  const homeDistanceFor = (aspect: number): number =>
    fitView(fitPoints, HOME_DIR, restCenter, camera.fov, Math.max(aspect, 0.2), FILL).distance;

  const homeSph = new Spherical().setFromVector3(HOME_DIR);
  const home: HomeView = { target: homeTarget.clone(), theta: homeSph.theta, phi: homeSph.phi, radius: homeDistanceFor(1) };

  camera.position.copy(homeTarget).addScaledVector(HOME_DIR, home.radius);
  camera.lookAt(homeTarget);

  /* ---- kontroller ---- */
  const controls = new OrbitControls(camera, canvas);
  // OrbitControls sets touch-action:none in connect(); restore vertical page scrolling.
  canvas.style.touchAction = 'pan-y';
  controls.target.copy(homeTarget);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.enableZoom = true;
  controls.zoomSpeed = 0.8;
  controls.rotateSpeed = 0.9;
  controls.autoRotate = false; // index.ts yönetir
  controls.autoRotateSpeed = 0.9;
  controls.minPolarAngle = 0.08;
  controls.maxPolarAngle = Math.PI * 0.92;
  controls.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };
  controls.update();

  /* ---- ışıklar (nötr, ürün fotoğrafı) ---- */
  // Ana ışık neredeyse tepeden: gölge modelin hemen altında, dar ve yumuşak kalır.
  const key = new DirectionalLight(0xffffff, 1.6);
  key.position.copy(restCenter).add(new Vector3(-0.18, 1, 0.22).normalize().multiplyScalar(8));
  key.target.position.copy(restCenter);
  key.castShadow = true;
  key.shadow.mapSize.set(256, 256); // düşük çözünürlük + geniş VSM bulanıklığı = yumuşak temas gölgesi
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 16;
  key.shadow.camera.left = -2.2;
  key.shadow.camera.right = 2.2;
  key.shadow.camera.top = 2.2;
  key.shadow.camera.bottom = -2.2;
  key.shadow.radius = 10; // texel cinsinden ≈ 0.17 sahne birimi
  key.shadow.blurSamples = 12;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);

  // Kenar ışığı: kameranın karşısından (arka-sol, üst)
  const rim = new DirectionalLight(0xffffff, 0.9);
  rim.position.copy(restCenter).add(new Vector3(-0.7, 0.5, -1).normalize().multiplyScalar(8));
  rim.target.position.copy(restCenter);
  scene.add(rim, rim.target);

  /* ---- temas gölgesi: ShadowMaterial zemin ---- */
  const groundGeo = new PlaneGeometry(8, 8);
  const groundMat = new ShadowMaterial({ color: 0x112b3c, opacity: 0.12 });
  const ground = new Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = model.bounds.min.y - GROUND_GAP;
  ground.receiveShadow = true;
  scene.add(ground);

  /* ---- ortam (RoomEnvironment → PMREM; dosya yok) ---- */
  let envTarget: WebGLRenderTarget | null = null;
  const buildEnvironment = (): void => {
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
  buildEnvironment();

  /* ---- boyut ---- */
  let width = 1;
  let height = 1;
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
  let dirty = true;
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
    buildEnvironment();
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
    controls.dispose();
    groundGeo.dispose();
    groundMat.dispose();
    key.shadow.dispose();
    if (envTarget) {
      envTarget.dispose();
      envTarget = null;
    }
    scene.environment = null;
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
