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

export interface Explorer {
  eyebrow: string;
  h2: string;
  lead: string;
  representativeNote: string;
  controls: { rotate: string; zoom: string; reset: string; explode: string; assemble: string; autoRotate: string; explodeLabel: string };
  hotspots: Hotspot[];
  fallbackTitle: string;
  fallbackText: string;
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
  systems: { title: string; items: { name: string; text: string }[] };
  disclaimer: string;
  askCta: string;
  sourcesNote: string;
}

export interface BrandGroup {
  group: string;
  brands: string[];
  note: string;
}

export interface Brands {
  eyebrow: string;
  h2: string;
  lead: string;
  featured: { name: string; group: string; text: string }[];
  groupsTitle: string;
  groups: BrandGroup[];
  disclaimer: string;
  techTitle: string;
  tech: { name: string; text: string }[];
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

export interface EarMold {
  eyebrow: string;
  h2: string;
  lead: string;
  steps: { title: string; text: string }[];
  types: { name: string; text: string }[];
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

export interface Consent {
  title: string;
  text: string;
  acceptAll: string;
  rejectAll: string;
  manage: string;
  save: string;
  categories: { key: 'necessary' | 'analytics' | 'marketing'; label: string; text: string; locked?: boolean }[];
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
