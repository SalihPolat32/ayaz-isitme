/**
 * Ayaz İşitme — 3B cihaz görüntüleyici: ortak tipler ve parça kimlikleri.
 *
 * Bileşen (Astro) tarafı yalnızca `DeviceType`, `PartId`, `PART_IDS`, `ViewerOptions`
 * ve `ViewerController`'a ihtiyaç duyar; `DevicePart`/`DeviceModel` model üreticisi
 * ile sahne arasındaki sözleşmedir.
 */
import type { Box3, Group, MeshStandardMaterial, Sphere, Vector3 } from 'three';

/** Etkileşimli üç cihaz tipi (pil ile çalışan temsili modeller). */
export type DeviceType = 'ric' | 'bte' | 'cic';

/** Parça kimliği — tipe göre geçerli değerler `PART_IDS` içindedir. */
export type PartId = string;

/** Tipe göre parça kimlikleri (sıra = hotspot/açıklama sırası). GLB'de düğüm adları bunlarla eşleşmeli. */
export const PART_IDS: Record<DeviceType, readonly string[]> = {
  ric: ['mics', 'body', 'button', 'wire', 'receiver', 'dome', 'battery-door', 'battery'],
  bte: ['mics', 'body', 'button', 'hook', 'tube', 'earmold', 'battery-door', 'battery'],
  cic: ['shell', 'faceplate', 'mic', 'battery-door', 'battery', 'vent', 'pull-string', 'receiver-outlet'],
};

export const DEVICE_TYPES: readonly DeviceType[] = ['ric', 'bte', 'cic'];

export const isDeviceType = (x: unknown): x is DeviceType => x === 'ric' || x === 'bte' || x === 'cic';

export interface ViewerOptions {
  /** Astro bileşeninin sağladığı canvas (CSS boyutu bileşen tarafından belirlenir). */
  canvas: HTMLCanvasElement;
  /** Başlangıç cihazı. Varsayılan: `'ric'`. */
  deviceType?: DeviceType;
  /**
   * Her çizilen karede, geçerli cihazın her parçası için çağrılır. `x`/`y` canvas'ın
   * sol-üst köşesine göre CSS piksel; `visible` = nokta kameraya dönük ve canvas içinde
   * (pil çapası kapak kapalıyken her zaman `false`).
   */
  onHotspot?: (id: PartId, x: number, y: number, visible: boolean) => void;
  /** İlk kullanıcı etkileşiminde (döndürme / yaklaştırma / parçalama / kapak) bir kez çağrılır. */
  onInteract?: () => void;
  /** Shader'lar derlenip ilk kare çizilmeye hazır olduğunda çağrılır. */
  onReady?: () => void;
  onExplodeChange?: (t: number) => void;
  onAutoRotateChange?: (enabled: boolean) => void;
  /** Pil kapağı hedef durumu değiştiğinde (animasyon başında) çağrılır. */
  onDoorChange?: (open: boolean) => void;
  /** `setDeviceType` ile model değiştirildikten sonra çağrılır. */
  onDeviceChange?: (type: DeviceType) => void;
  /** Varsayılan: hareket azaltma tercihi yoksa `true`. */
  autoRotate?: boolean;
  /** Varsayılan: `matchMedia('(prefers-reduced-motion: reduce)')`. */
  reducedMotion?: boolean;
}

export interface ViewerController {
  /** Parçalanma miktarı 0..1. `animate` (varsayılan true) ~600 ms ease-in-out tween. */
  setExplode(t: number, animate?: boolean): void;
  getExplode(): number;
  /** Animasyonlu olarak 1'e / 0'a götürür. */
  explode(): void;
  assemble(): void;
  /** Kamera ana konuma, parçalanma 0, kapak kapalı, otomatik dönüş tercihe göre yeniden açık. */
  reset(): void;
  setAutoRotate(on: boolean): void;
  /**
   * Kamerayı parçaya doğru yumuşakça çevirir ve ~1.2 s vurgular (emissive nabız).
   * `'battery'` / `'battery-door'` için pil kapağı otomatik açılır.
   */
  focusPart(id: PartId): void;
  /** Kalıcı vurgu; `null` kaldırır. */
  highlightPart(id: PartId | null): void;
  /**
   * Modeli değiştirir: eski geometri/malzemeler serbest bırakılır, kamera yeniden
   * çerçevelenir, parçalanma 0 ve kapak kapalı olur; otomatik dönüş durumu korunur.
   * `onDeviceChange` çağrılır ve yeni parça kimlikleri için hotspot bildirimi başlar.
   */
  setDeviceType(type: DeviceType): Promise<void>;
  getDeviceType(): DeviceType;
  getPartIds(): readonly string[];
  /** Pil kapağı: ~450 ms easeInOutCubic menteşe animasyonu (hareket azaltmada anında). */
  setBatteryDoor(open: boolean, animate?: boolean): void;
  toggleBatteryDoor(): void;
  isBatteryDoorOpen(): boolean;
  /**
   * Geçerli karenin PNG dataURL'i. `width`/`height` verilirse o piksel boyutunda
   * (DPR=1) tek kare çizilir ve aynı tick içinde okunur (preserveDrawingBuffer gerekmez).
   */
  captureImage(width?: number, height?: number): string;
  pause(): void;
  resume(): void;
  destroy(): void;
}

/**
 * Modeldeki tek bir parça. `object` parçanın kök grubudur; `restPosition`, `explodeDirection`
 * ve `anchorLocal` **üst nesnenin (parent) uzayında** tanımlıdır — pil, kapak grubunun
 * çocuğu olduğundan kapakla birlikte döner.
 */
export interface DevicePart {
  id: PartId;
  object: Group;
  restPosition: Vector3;
  explodeDirection: Vector3;
  explodeDistance: number;
  /** Etkin nokta (hotspot) çapası — dinlenme halinde, model uzayında, parça yüzeyinde. */
  anchor: Vector3;
  /** Aynı çapa, parça-yerel uzayda (explode/kapak ile birlikte hareket etmesi için). */
  anchorLocal: Vector3;
  /** Çapanın yüzey normali (parça-yerel uzay, birim). Görünürlük testi için. */
  anchorNormal: Vector3;
  /** `false` iken hotspot her zaman görünmez bildirilir (ör. kapak kapalıyken pil). Model günceller. */
  anchorEnabled: boolean;
  /** Parçaya özel malzeme örnekleri (vurgu için emissive değiştirilir). */
  materials: MeshStandardMaterial[];
  /**
   * Katman (yalnızca render betiği için): `'body'` kulak arkasında kalan parçalar,
   * `'front'` kulağın üzerinden geçenler (kablo/alıcı/dome, kanca/hortum/kalıp).
   */
  layer: 'body' | 'front';
}

export interface DeviceModel {
  type: DeviceType;
  root: Group;
  parts: Record<PartId, DevicePart>;
  partList: readonly DevicePart[];
  /** Dinlenme halindeki çapalar (model uzayı). */
  anchors: Record<PartId, Vector3>;
  /** Dinlenme halinde (kapak kapalı, t=0) sınır kutusu (model uzayı). */
  bounds: Box3;
  /** Tam açılmış (t = 1, kapak kapalı) halde sınır kutusu. */
  boundsExploded: Box3;
  /** Dinlenme halinin sınır küresi. */
  sphere: Sphere;
  /** Dinlenme halinin merkezi. */
  center: Vector3;
  /** Yaklaşık üçgen sayısı (tüm parçalar). */
  triangleCount: number;
  /** 1 sahne birimi kaç milimetre? (Bu modellerde 10.) */
  unitMm: number;
  /** Tercih edilen ana bakış yönü (model uzayı, birim vektör; kameradan modele değil, modelden kameraya). */
  homeDir: Vector3;
  /** Parçaları t ∈ [0,1] oranında açar (anında; tween sahne tarafında). */
  setExplode(t: number): void;
  getExplode(): number;
  /** Pil kapağı açıklığı t ∈ [0,1] (anında; tween sahne tarafında). Pil kapağın beşiğinde kapakla birlikte döner (kayma yok). */
  setDoor(t: number): void;
  getDoor(): number;
  dispose(): void;
}
