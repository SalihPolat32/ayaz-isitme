/**
 * Tek işletme yapılandırması. Sayfadaki tüm iletişim bilgileri, JSON-LD ve
 * bağlantılar buradan türetilir. Başka bir işletmenin (ör. Med-SEM) verisi
 * buraya taşınmaz.
 *
 * verificationStatus:
 *  - 'verified'        : işletme sahibi tarafından yazılı olarak teyit edildi
 *  - 'from-live-site'  : mevcut canlı site (GitHub master, 13 Nis 2026) böyle yayımlıyor
 *  - 'storefront'      : mağaza tabelası/vitrin fotoğraflarında görülüyor
 *  - 'unverified'      : yayına alınmaz
 * Yayınlanabilirlik kuralı: isPublishable() — bkz. CONTENT-VERIFICATION.md
 */
export type VerificationStatus = 'verified' | 'from-live-site' | 'storefront' | 'unverified';

export const PUBLISHABLE: readonly VerificationStatus[] = ['verified', 'from-live-site', 'storefront'];
export const isPublishable = (s: VerificationStatus) => PUBLISHABLE.includes(s);

export interface Verified<T> {
  value: T;
  status: VerificationStatus;
  note?: string;
}

export const business = {
  brand: 'Ayaz İşitme Merkezi',
  legalName: 'Ayaz İşitme Cihazları Satış ve Uygulama Merkezi',
  brandEn: 'Ayaz Hearing Center',
  legalNameEn: 'Ayaz Hearing Aids Sales & Fitting Center',
  url: 'https://keciorenisitme.com',

  phone: {
    display: '0507 155 11 51',
    e164: '+905071551151',
    href: 'tel:+905071551151',
  },
  whatsapp: {
    number: '905071551151',
    href: 'https://wa.me/905071551151',
    /** Hazır mesajla açmak için: whatsappLink('Merhaba...') */
  },
  email: 'ayazisitmecihazlari@gmail.com',

  address: {
    street: 'Aşağı Eğlence Mahallesi, Ayvalı Caddesi No:26/A',
    district: 'Keçiören',
    city: 'Ankara',
    country: 'TR',
    postalCode: { value: '06010', status: 'from-live-site' as VerificationStatus },
    /** Tek satır görünüm */
    line: 'Aşağı Eğlence Mah. Ayvalı Cad. No:26/A, Keçiören / Ankara',
  },

  google: {
    /** İşletme profili paylaşım bağlantısı (kullanıcı verdi). Place ID DEĞİLDİR. */
    shareUrl: 'https://share.google/A7IBtvRd3n1rcFSQv',
    /** Yol tarifi (mevcut sitede kullanılan) */
    directionsUrl: 'https://maps.app.goo.gl/x7CAB5ZyCWHGagyi7',
    /** Places API (New) Place ID — doğrulanınca doldurulur; boşken yorum API'si kapalı kalır. */
    placeId: { value: '', status: 'unverified' as VerificationStatus },
    /** Google İşletme Profili > "Daha fazla yorum alın" bağlantısı (resmî). Boşsa paylaşım bağlantısı kullanılır. */
    writeReviewUrl: '',
    /** Tıklayınca yüklenen harita gömme adresi (çerez onayından bağımsız, kullanıcı eylemiyle). */
    mapsEmbedUrl:
      'https://www.google.com/maps?q=A%C5%9Fa%C4%9F%C4%B1%20E%C4%9Flence%20Mahallesi%2C%20Ayval%C4%B1%20Caddesi%20No%3A26%2FA%2C%20Ke%C3%A7i%C3%B6ren%20Ankara&output=embed',
  },

  /** Çalışma saatleri: canlı sitedeki JSON-LD'den. İşletme yazılı teyit vermeli. */
  hours: {
    status: 'unverified' as VerificationStatus,
    weekly: [
      { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const, opens: '09:00', closes: '18:00' },
    ],
    closedDays: ['Sunday'] as const,
  },

  /** Koordinat canlı sitede yuvarlatılmış (≈). Doğrulanmadığı için JSON-LD'ye yazılmaz. */
  geo: { status: 'unverified' as VerificationStatus, lat: 39.978, lng: 32.866 },

  /** Vitrin/tabela fotoğraflarında görülen ifadeler. Yazılı teyit istenir. */
  claims: {
    sgkContracted: { value: true, status: 'unverified' as VerificationStatus, note: 'Vitrinde "SGK anlaşmalı" yazısı görülüyor (ofis-6.jpg).' },
    freeHearingTest: { value: true, status: 'unverified' as VerificationStatus, note: 'Vitrinde "Ücretsiz işitme testi" ve canlı site başlığında "Ücretsiz Test".' },
    batteriesAndFilters: { value: true, status: 'storefront' as VerificationStatus, note: 'Vitrinde "İşitme cihazı pili" yazısı; ofiste Varta pil standı.' },
    earMolds: { value: true, status: 'storefront' as VerificationStatus, note: 'Vitrinde "Kulak kalıbı" yazısı.' },
  },

  /** Ekip: isim ve unvan vitrin/masa isimliğinde "Ody. Emre DAĞLIOĞLU" olarak görülüyor. */
  team: [
    {
      name: 'Emre Dağlıoğlu',
      titleShort: 'Ody.',
      title: { value: 'Odyolog', status: 'unverified' as VerificationStatus, note: '"Ody." kısaltması Odyolog mu Odyometrist mi teyit edilmeli.' },
      status: 'storefront' as VerificationStatus,
      photo: 'ofis-1',
    },
  ],

  /** Satılan / uygulanan markalar. Yetkili bayilik iddiası yayına alınmaz. */
  brandsInPractice: {
    status: 'unverified' as VerificationStatus,
    note: 'Ofis fotoğraflarında Bernafon, Demant ve Tim Group materyalleri görülüyor; dizinde Bernafon/Oticon/Coselgi fiyat listeleri var. Satış/uygulama/yetki durumu yazılı teyit edilmeli.',
    observed: ['Bernafon', 'Oticon', 'Coselgi'],
  },

  /** Kurumsal bağlantılar (doğrulananlar) */
  sameAs: ['https://maps.app.goo.gl/x7CAB5ZyCWHGagyi7', 'https://share.google/A7IBtvRd3n1rcFSQv'],

  /** Mevcut sitedeki GA4 kimliği (herkese açık HTML'de). .env ile etkinleşir. */
  knownAnalytics: { ga4: 'G-VRC710M0YF' },
} as const;

export type Business = typeof business;

export const whatsappLink = (text?: string) =>
  text ? `${business.whatsapp.href}?text=${encodeURIComponent(text)}` : business.whatsapp.href;

/** Vitrin/tabela iddiaları için yayın kontrolü */
export const canShow = (v: { status: VerificationStatus; value?: unknown }) => v.value !== false && isPublishable(v.status);
