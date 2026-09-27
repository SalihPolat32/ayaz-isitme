/**
 * Malzemeler — nötr stüdyo görünümü (RoomEnvironment PMREM + ACES).
 * Her parça kendi örneğini alır (vurgu emissive'i parçaya özel olsun); aynı tanımlı
 * malzemeler shader programını paylaşır, ek derleme maliyeti yoktur.
 */
import { BackSide, Color, DoubleSide, MeshPhysicalMaterial } from 'three';

export type MaterialKind =
  | 'graphite' // RIC/BTE gövde ve kapak: grafit, mat-saten
  | 'graphiteInner' // kapak iç yüzü (çift taraflı, biraz daha mat)
  | 'champagne' // BTE gövde ve kapak: açık şampanya / gümüş-bej metalik
  | 'champagneInner' // BTE kapak iç yüzü (daha koyu, mat)
  | 'cavity' // pil yuvası iç yüzleri (yanak iç yüzleri, dikiş yüzü): koyu mat
  | 'lumen' // hortum / kanca iç kanalı (şeffaf malzemenin içinden koyu görünen iç duvar)
  | 'matte' // düğmeler, soket
  | 'portDark' // mikrofon portu, havalandırma, pil yuvası içi
  | 'steel' // pil: fırçalanmış metal
  | 'tabBrown' // 312 pil etiketi
  | 'tabOrange' // 13 pil etiketi
  | 'tabYellow' // 10 pil etiketi
  | 'titanium' // RIC alıcı kapsülü
  | 'wire' // RIC alıcı kablosu (opak açık gri)
  | 'clear' // BTE hortumu ve kancası (şeffaf PVC)
  | 'skin' // kulak kalıbı / faceplate: sıcak ten rengi akrilik
  | 'skinShell' // CIC kabuğu: hafif yarı saydam akrilik
  | 'dome' // silikon dome
  | 'string' // çıkarma ipi
  | 'bead' // ip ucu boncuğu
  | 'waxGuard' // kulak kiri koruyucusu (beyaz plastik)
  | 'mold' // BTE kulak kalıbı: yarı saydam sıcak pembe/ten akrilik, parlak vernik
  | 'shellAcrylic' // kulak içi kabuk: hafif yarı saydam akrilik (renk parametreli)
  | 'faceplate' // faceplate ve pil kapağı: opak akrilik (renk parametreli)
  | 'nylon' // şeffaf naylon çıkarma ipi
  | 'knob' // ip ucu topuzu (şeffaf-beyaz)
  | 'screw' // mikrofon portu halkası / menteşe pimi (açık metal)
  | 'wheel'; // ses ayar tekerleği (koyu tırtıllı plastik)

/** `color` verilirse taban rengi onunla değiştirilir (kabuk / faceplate tonları). */
export function makeMaterial(kind: MaterialKind, color?: number): MeshPhysicalMaterial {
  const m = baseMaterial(kind);
  if (color !== undefined) m.color.setHex(color);
  return m;
}

function baseMaterial(kind: MaterialKind): MeshPhysicalMaterial {
  switch (kind) {
    case 'graphite':
      return new MeshPhysicalMaterial({
        color: 0x2e333a,
        roughness: 0.5,
        metalness: 0.15,
        clearcoat: 0.25,
        clearcoatRoughness: 0.45,
      });
    case 'graphiteInner':
      return new MeshPhysicalMaterial({
        color: 0x262a30,
        roughness: 0.62,
        metalness: 0.1,
        clearcoat: 0.1,
        clearcoatRoughness: 0.6,
        side: DoubleSide,
      });
    case 'champagne':
      // Hedef görünüm: açık şampanya / gümüş-bej, ince metalik pul + parlak vernik (referans BTE fotoğrafları)
      return new MeshPhysicalMaterial({
        color: 0xcdbd9f,
        roughness: 0.3,
        metalness: 0.55,
        clearcoat: 0.6,
        clearcoatRoughness: 0.22,
      });
    case 'champagneInner':
      return new MeshPhysicalMaterial({ color: 0x8c8170, roughness: 0.6, metalness: 0.2, clearcoat: 0.1, clearcoatRoughness: 0.6, side: DoubleSide });
    case 'cavity':
      return new MeshPhysicalMaterial({ color: 0x101215, roughness: 0.85, metalness: 0.05 });
    case 'lumen':
      // İç kanal duvarı: arka yüzü çizilir (BackSide), dıştaki şeffaf cidarın içinden gri bir çekirdek gibi okunur
      return new MeshPhysicalMaterial({
        color: 0x9aa5ab,
        roughness: 0.3,
        metalness: 0,
        transmission: 0.35,
        thickness: 0.05,
        ior: 1.45,
        transparent: true,
        opacity: 1,
        side: BackSide,
      });
    case 'matte':
      return new MeshPhysicalMaterial({ color: 0x15181c, roughness: 0.72, metalness: 0.05 });
    case 'portDark':
      return new MeshPhysicalMaterial({ color: 0x07090b, roughness: 0.95, metalness: 0 });
    case 'steel':
      return new MeshPhysicalMaterial({ color: 0xd3d5d7, metalness: 0.95, roughness: 0.36 });
    case 'tabBrown':
      return new MeshPhysicalMaterial({ color: 0x7a4a2a, roughness: 0.62, metalness: 0 });
    case 'tabOrange':
      return new MeshPhysicalMaterial({ color: 0xe07a1f, roughness: 0.62, metalness: 0 });
    case 'tabYellow':
      return new MeshPhysicalMaterial({ color: 0xf0c020, roughness: 0.62, metalness: 0 });
    case 'titanium':
      return new MeshPhysicalMaterial({ color: 0xb8bcc2, metalness: 0.85, roughness: 0.3 });
    case 'wire':
      return new MeshPhysicalMaterial({ color: 0xd8dde0, roughness: 0.35, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.3 });
    case 'clear':
      return new MeshPhysicalMaterial({
        color: 0xf4f7f8,
        roughness: 0.12,
        metalness: 0,
        transmission: 0.8,
        thickness: 0.12,
        ior: 1.45,
        transparent: true,
        opacity: 1,
      });
    case 'skin':
      // Hedef görünüm #e8c9b3; ACES + parlak ortam altında bir ton koyu taban rengi o tona oturur.
      // Yarı parlak akrilik: düşük clearcoat — açık yüzeyde ortam tavan ışığı patlamasın.
      return new MeshPhysicalMaterial({
        color: 0xdfb99c,
        roughness: 0.4,
        metalness: 0,
        clearcoat: 0.12,
        clearcoatRoughness: 0.5,
      });
    case 'skinShell':
      return new MeshPhysicalMaterial({
        color: 0xdfb99c,
        roughness: 0.4,
        metalness: 0,
        clearcoat: 0.12,
        clearcoatRoughness: 0.5,
        transmission: 0.15,
        thickness: 0.4,
        ior: 1.48,
        // Geçiş tamponu şeffaf zeminde beyaza temizlenir; zayıflatma rengi iletilen ışığı ten tonuna çeker.
        attenuationColor: new Color(0xe0b899),
        attenuationDistance: 0.25,
        transparent: true,
        opacity: 1,
      });
    case 'dome':
      return new MeshPhysicalMaterial({
        color: 0xcfd6da,
        roughness: 0.25,
        metalness: 0,
        transmission: 0.55,
        thickness: 0.3,
        ior: 1.42,
        transparent: true,
        opacity: 1,
      });
    case 'string':
      return new MeshPhysicalMaterial({ color: 0xcfd3d6, roughness: 0.6, metalness: 0 });
    case 'bead':
      return new MeshPhysicalMaterial({ color: 0x6b7075, roughness: 0.4, metalness: 0.05, clearcoat: 0.3 });
    case 'waxGuard':
      return new MeshPhysicalMaterial({ color: 0xf1f1ee, roughness: 0.5, metalness: 0 });
    case 'mold':
      // Akrilik kalıp: sıcak pembe-ten, hafif ışık geçirgen (iletilen ışık kırmızımsı), parlak vernik.
      return new MeshPhysicalMaterial({
        color: 0xe9a996,
        roughness: 0.22,
        metalness: 0,
        clearcoat: 0.85,
        clearcoatRoughness: 0.12,
        transmission: 0.22,
        thickness: 0.5,
        ior: 1.49,
        attenuationColor: new Color(0xd9806a),
        attenuationDistance: 0.35,
        sheen: 0.25,
        sheenColor: new Color(0xffd6c8),
        sheenRoughness: 0.5,
        transparent: true,
        opacity: 1,
      });
    case 'shellAcrylic':
      return new MeshPhysicalMaterial({
        color: 0xb5835f,
        roughness: 0.34,
        metalness: 0,
        clearcoat: 0.35,
        clearcoatRoughness: 0.3,
        transmission: 0.1,
        thickness: 0.4,
        ior: 1.49,
        attenuationColor: new Color(0xa8704f),
        attenuationDistance: 0.3,
        transparent: true,
        opacity: 1,
      });
    case 'faceplate':
      return new MeshPhysicalMaterial({
        color: 0x9e6e4f,
        roughness: 0.42,
        metalness: 0,
        clearcoat: 0.25,
        clearcoatRoughness: 0.4,
      });
    case 'nylon':
      return new MeshPhysicalMaterial({
        color: 0xe6ecef,
        roughness: 0.18,
        metalness: 0,
        clearcoat: 0.6,
        clearcoatRoughness: 0.1,
        transmission: 0.45,
        thickness: 0.02,
        ior: 1.53,
        transparent: true,
        opacity: 1,
      });
    case 'knob':
      return new MeshPhysicalMaterial({
        color: 0xeef2f3,
        roughness: 0.2,
        metalness: 0,
        clearcoat: 0.7,
        clearcoatRoughness: 0.1,
        transmission: 0.35,
        thickness: 0.08,
        ior: 1.5,
        transparent: true,
        opacity: 1,
      });
    case 'screw':
      return new MeshPhysicalMaterial({ color: 0xb9bcc0, metalness: 0.8, roughness: 0.38 });
    case 'wheel':
      return new MeshPhysicalMaterial({ color: 0x3a3430, roughness: 0.55, metalness: 0.05, clearcoat: 0.2 });
  }
}

/** Vurgu rengi (token: --accent). Sahne tarafı emissive için kullanır. */
export const HIGHLIGHT_COLOR = new Color(0x087f8c);
