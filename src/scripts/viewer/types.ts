/**
 * Ayaz İşitme — 3B cihaz görüntüleyici: ortak tipler.
 *
 * Bu dosya yalnızca tip dışa aktarır (runtime kodu yok). Bileşen (Astro) tarafı
 * yalnızca `PartId`, `ViewerOptions` ve `ViewerController`'a ihtiyaç duyar;
 * `DevicePart`/`DeviceModel` model üreticisi ile sahne arasındaki sözleşmedir.
 */
import type { Box3, Group, MeshStandardMaterial, Sphere, Vector3 } from 'three';

/** Parçalanabilir (explode) parça kimlikleri. GLB ile değiştirilirse düğüm adları bunlarla eşleşmeli. */
export type PartId = 'mics' | 'body' | 'button' | 'wire' | 'receiver' | 'dome' | 'power';

export interface ViewerOptions {
  /** Astro bileşeninin sağladığı canvas (CSS boyutu bileşen tarafından belirlenir). */
  canvas: HTMLCanvasElement;
  /**
   * Her çizilen karede, her parça için çağrılır. `x`/`y` canvas'ın sol-üst köşesine
   * göre CSS piksel; `visible` = nokta kameraya dönük ve canvas içinde.
   */
  onHotspot?: (id: PartId, x: number, y: number, visible: boolean) => void;
  /** İlk kullanıcı etkileşiminde (döndürme / yaklaştırma / parçalama) bir kez çağrılır. */
  onInteract?: () => void;
  /** Shader'lar derlenip ilk kare çizilmeye hazır olduğunda çağrılır. */
  onReady?: () => void;
  onExplodeChange?: (value: number) => void;
  onAutoRotateChange?: (enabled: boolean) => void;
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
  /** Kamera ana konuma, parçalanma 0, otomatik dönüş yeniden açık. */
  reset(): void;
  setAutoRotate(on: boolean): void;
  /** Kamerayı parçaya doğru yumuşakça çevirir ve ~1.2 s vurgular (emissive nabız). */
  focusPart(id: PartId): void;
  /** Kalıcı vurgu; `null` kaldırır. */
  highlightPart(id: PartId | null): void;
  /**
   * Geçerli karenin PNG dataURL'i. `width`/`height` verilirse o piksel boyutunda
   * (DPR=1) tek kare çizilir ve aynı tick içinde okunur (preserveDrawingBuffer gerekmez).
   */
  captureImage(width?: number, height?: number): string;
  pause(): void;
  resume(): void;
  destroy(): void;
}

/** Modeldeki tek bir parça. Konumlar model (root) uzayındadır, açılma (explode) yönü birim vektördür. */
export interface DevicePart {
  id: PartId;
  /** Parçanın kök grubu; `position` = restPosition + explodeDirection * explodeDistance * t. */
  object: Group;
  restPosition: Vector3;
  explodeDirection: Vector3;
  explodeDistance: number;
  /** Etkin nokta (hotspot) çapası — dinlenme halinde, model uzayında, parça yüzeyinde. */
  anchor: Vector3;
  /** Aynı çapa, parça-yerel uzayda (explode ile birlikte hareket etmesi için). */
  anchorLocal: Vector3;
  /** Çapanın yüzey normali (model uzayı, birim). Görünürlük testi için. */
  anchorNormal: Vector3;
  /** Parçaya özel malzeme örnekleri (vurgu için emissive değiştirilir). */
  materials: MeshStandardMaterial[];
}

export interface DeviceModel {
  root: Group;
  parts: Record<PartId, DevicePart>;
  partList: readonly DevicePart[];
  /** Dinlenme halindeki çapalar (model uzayı). */
  anchors: Record<PartId, Vector3>;
  /** Dinlenme halinde sınır kutusu (model uzayı). */
  bounds: Box3;
  /** Tam açılmış (t = 1) halde sınır kutusu. */
  boundsExploded: Box3;
  /** Dinlenme halinin sınır küresi. */
  sphere: Sphere;
  /** Dinlenme halinin merkezi. */
  center: Vector3;
  /** Yaklaşık üçgen sayısı (tüm parçalar). */
  triangleCount: number;
  /** 1 sahne birimi kaç milimetre? (Bu modelde 10.) */
  unitMm: number;
  /** Parçaları t ∈ [0,1] oranında açar (anında; tween sahne tarafında). */
  setExplode(t: number): void;
  dispose(): void;
}
