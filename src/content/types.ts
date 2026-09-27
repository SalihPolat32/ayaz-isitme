/** İçerik modeli — TR/EN sözlükleri bu tipi doldurur. */
export type Locale = 'tr' | 'en';

export interface NavItem {
  href: string;
  label: string;
}

export interface Hero {
  eyebrow: string;
  h1: string;
  sub: string;
  ctaPrimary: string;
  ctaSecondary: string;
  trust: string[];
  deviceCaption: string;
}

export interface Hotspot {
  id: string;
  title: string;
  text: string;
}

export type DeviceModelId = 'ric' | 'bte' | 'cic';

export interface ExplorerModel {
  id: DeviceModelId;
  label: string;
  sub: string;
  caption: string;
  hotspots: Hotspot[];
}

export interface Explorer {
  eyebrow: string;
  h2: string;
  lead: string;
  representativeNote: string;
  /** Açma/kapama düğmeleri (door, explode, autoRotate): sabit etiket + aria-pressed (durum etiketle ikinci kez söylenmez) */
  controls: { rotate: string; zoom: string; reset: string; explode: string; autoRotate: string; explodeLabel: string; door: string; modelLabel: string };
  models: ExplorerModel[];
  fallbackTitle: string;
  fallbackText: string;
  loadErrorTitle: string;
  loadErrorText: string;
  reloadLabel: string;
  keyboardHint: string;
  loading: string;
  cta: string;
}

export type Level = 1 | 2 | 3 | 4 | 5;

export interface DeviceType {
  id: string;
  code: string;
  name: string;
  short: string;
  description: string;
  suits: string;
  /** level: 1 = neredeyse görünmez … 5 = çok görünür (dolu nokta sayısı) */
  visibility: { level: Level; label: string };
  power: string;
  rechargeable: string;
  wireless: string;
  handling: string;
  care: string;
  note?: string;
}

export interface Devices {
  eyebrow: string;
  h2: string;
  lead: string;
  tableHeaders: { visibility: string; power: string; rechargeable: string; wireless: string; handling: string; care: string; suits: string };
  types: DeviceType[];
  /** Türden bağımsız sistemler; id, bileşendeki görseli seçer (CROS şeması, BTE görseli, kalıp büyümesi). */
  systems: { title: string; items: { id: 'cros' | 'power' | 'kids'; name: string; text: string }[] };
  disclaimer: string;
  askCta: string;
  sourcesNote: string;
  /** Kulak çizimi ve küçük görseller: hepsi temsili (render/çizim), asla "fotoğraf" denmez. */
  figure: {
    earLabel: (name: string) => string;
    thumbAlt: (code: string) => string;
    /** Nokta ölçeği: daha çok dolu nokta = dışarıdan DAHA ÇOK görünür (1 = neredeyse görünmez). */
    visibilityAria: (level: Level, label: string) => string;
    /** BTE / RIC: kulak arkasındaki gövde yarı saydam çizilir → açıklama zorunlu */
    behindEarNote: string;
    inEarNote: string;
  };
}

export interface BrandGroup {
  group: string;
  /** Marka kutusunun altındaki grup etiketi (ör. "Demant grubu", "Bağımsız üretici") */
  label: string;
  brands: string[];
}

export interface Brands {
  eyebrow: string;
  h2: string;
  lead: string;
  /** Marka duvarı: resmî logo yok, yazıyla marka adı (logo kullanımı yazılı izin ister, ASSET-MANIFEST.md) */
  wallTitle: string;
  groups: BrandGroup[];
  disclaimer: string;
  techTitle: string;
  tech: { name: string; text: string }[];
  techNote: string;
}

export interface Service {
  id: string;
  icon: string;
  title: string;
  text: string;
  badge?: string;
}

export interface Services {
  eyebrow: string;
  h2: string;
  lead: string;
  items: Service[];
}

export type MoldStyleId = 'full-shell' | 'half-shell' | 'skeleton' | 'semi-skeleton' | 'canal' | 'canal-lock' | 'cros' | 'micro';

export interface EarMold {
  eyebrow: string;
  h2: string;
  lead: string;
  steps: { title: string; text: string }[];
  /** Başlıktaki kalıp görseli: temsili render, asla "fotoğraf" denmez */
  imageAlt: string;
  stylesTitle: string;
  /** Galerinin altındaki not: görseller temsili ve aynı ölçekte; biçim birlikte seçilir */
  stylesNote: string;
  /** Kalıp biçimleri; id, render dosyasını seçer (src/assets/device/molds/<id>.png) */
  styles: { id: MoldStyleId; name: string; text: string }[];
  materialsTitle: string;
  /** Malzeme ve RIC ucu; id: 'acrylic' (şeffaf akrilik render), 'silicone' (silikon render), 'dome' (RIC alıcısı + dome) */
  materials: { id: 'acrylic' | 'silicone' | 'dome'; name: string; text: string }[];
  careTitle: string;
  care: string[];
  distinction: string;
  cta: string;
}

export interface Process {
  eyebrow: string;
  h2: string;
  lead: string;
  steps: { title: string; text: string }[];
  note: string;
}

export interface Center {
  eyebrow: string;
  h2: string;
  lead: string;
  facts: { label: string; value: string }[];
  teamTitle: string;
  teamText: string;
  galleryLabel: string;
  photos: { key: string; alt: string; caption: string }[];
  directionsCta: string;
}

export interface Reviews {
  eyebrow: string;
  h2: string;
  lead: string;
  ratingLabel: string;
  countLabel: (n: number) => string;
  seeAll: string;
  write: string;
  attribution: string;
  loading: string;
  offline: string;
  offlineText: string;
  apiNote: string;
  selectionNote: string;
  carousel: { label: string; prev: string; next: string; pause: string; play: string; slide: string; googleBadge: string };
  /** 'link' modu: yorum metni, puan ve adet gösterilmez; yalnızca Google profiline bağlantı. */
  linkMode: { eyebrow: string; h2: string; lead: string; seeAll: string; write: string; note: string };
}

export interface Faq {
  eyebrow: string;
  h2: string;
  lead: string;
  items: { q: string; a: string }[];
}

export interface Contact {
  eyebrow: string;
  h2: string;
  lead: string;
  form: {
    title: string;
    name: string;
    phone: string;
    time: string;
    timeOptions: string[];
    note: string;
    consent: string;
    consentLink: string;
    submit: string;
    submitWhatsapp: string;
    sending: string;
    successTitle: string;
    successText: string;
    errorTitle: string;
    errorText: string;
    fallbackNotice: string;
    validation: { name: string; phone: string; consent: string; time: string };
    /** JavaScript kapalıyken formun yerinde gösterilen not (form gönderilemez) */
    noScript: string;
    /** Zorunlu alan işareti (*) açıklaması */
    requiredNote: string;
  };
  info: { address: string; phone: string; whatsapp: string; email: string; hours: string; hoursValue: string; closed: string; directions: string; loadMap: string; mapNote: string };
}

export interface Footer {
  legal: string;
  privacy: string;
  cookies: string;
  rights: string;
  quick: string;
  contact: string;
  disclaimer: string;
}

/** Çerez paneli metinleri. Hangi metnin/kategorinin gösterileceğine derleme yapılandırması karar verir (src/content/legal/consent-view.ts). */
export interface Consent {
  /** İzin istenen panelin başlığı (en az bir isteğe bağlı hizmet tanımlıysa) */
  title: string;
  /** İsteğe bağlı hizmet yokken gösterilen bilgilendirmenin başlığı */
  noticeTitle: string;
  /** İsteğe bağlı hizmet varken; {services} = yalnızca tanımlı hizmetlerin adları */
  textWithOptional: string;
  /** Hiçbir isteğe bağlı hizmet yokken: hizmet adı ve izin cümlesi içermez */
  textNoticeOnly: string;
  /** Hizmet adlarını birleştiren bağlaç ("ve" / "and") */
  and: string;
  acceptAll: string;
  rejectAll: string;
  manage: string;
  save: string;
  /** Bilgilendirme modundaki tek düğme */
  acknowledge: string;
  /** analytics/marketing metinlerinde {services} = yalnızca tanımlı hizmetlerin adları */
  categories: Record<'necessary' | 'analytics' | 'marketing', { label: string; text: string }>;
  reopen: string;
  policyLink: string;
}

export interface MobileBar {
  call: string;
  whatsapp: string;
  directions: string;
}

export interface Seo {
  title: string;
  description: string;
  ogAlt: string;
}

export interface SiteContent {
  locale: Locale;
  htmlLang: string;
  seo: Seo;
  nav: NavItem[];
  navCta: string;
  langSwitch: { label: string; href: string; hreflang: string };
  hero: Hero;
  explorer: Explorer;
  devices: Devices;
  brands: Brands;
  services: Services;
  earMold: EarMold;
  process: Process;
  center: Center;
  reviews: Reviews;
  faq: Faq;
  contact: Contact;
  footer: Footer;
  consent: Consent;
  mobileBar: MobileBar;
  common: { skip: string; menu: string; close: string; back: string; next: string; prev: string; learnMore: string; new: string };
}
