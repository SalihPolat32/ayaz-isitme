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

/** Hukuki metinlerde adı geçebilecek bildirim kanalları (Worker: MAIL_PROVIDER + ilgili gizli anahtarlar). */
export type NotificationChannel = 'resend' | 'brevo' | 'telegram';

/** Onay kaydı. by: rol veya kısa ad ("İşletme sahibi", "Av. A. B.") — repo HERKESE AÇIK, tam ad yazmayın. */
export interface LegalConfirmation {
  by: string;
  /** YYYY-AA-GG */
  date: string;
}

/**
 * Gizlilik / KVKK / çerez metinleri için YALNIZCA işletmenin (veya avukatının) verebileceği bilgiler.
 * Tahminle doldurulmaz: bilinmeyen değer null kalır. PUBLIC_SITE_ENV=production derlemesi eksik alan
 * varsa durur (src/content/legal/facts.ts, CONTENT-VERIFICATION.md §7). Önizlemede eksikler sayfada
 * işaretli yer tutucu olarak görünür.
 */
export interface LegalFacts {
  retention: {
    /** Randevu/iletişim talepleri (form bildirimi, e-posta, telefonla alınan talep kayıtları): talebin alındığı tarihten itibaren kaç AY saklanıyor? */
    appointmentRequestsMonths: number | null;
    /** WhatsApp yazışmaları kaç AY saklanıyor? */
    whatsappMonths: number | null;
    /** Yalnızca API modu (PUBLIC_API_BASE dolu): Cloudflare Worker çalışma kayıtları (Workers Logs) kaç GÜN tutuluyor? */
    technicalLogsDays: number | null;
  };
  /** Yalnızca API modu: Worker'da gerçekten etkin bildirim kanalları (ör. ['resend'] ya da ['brevo', 'telegram']). */
  notificationChannels: readonly NotificationChannel[] | null;
  /** KVKK m.9 yurt dışı aktarım dayanağı — avukatın yazdığı tek cümle, TR ve EN. */
  crossBorderBasis: { tr: string; en: string } | null;
  /** Metinde yazan hukuki sebeplerin (m.5/2-c, m.5/2-f, m.5/1 açık rıza) teyidi. */
  legalBasesConfirmation: LegalConfirmation | null;
  /**
   * Metinlerin tamamının onayı: `{ by, date, version, context, hash }`.
   *  - `version`: src/content/legal/facts.ts > LEGAL_TEXT_VERSION (insan okuyabilir sürüm etiketi).
   *  - `context`: onaylanan derleme yapılandırmasının imzası (legalContextSignature: form modu, Turnstile,
   *    canlı yorumlar, ölçüm kimlikleri) — metin bu yapılandırmaya göre farklı basılır.
   *  - `hash`: onaylanan NİHAİ METNİN içerik özeti (src/content/legal/text-hash.ts > legalTextHash: bu bağlamda,
   *    yukarıdaki alanların GERÇEK değerleriyle basılan gizlilik sayfası TR/EN, çerez paneli TR/EN, harita notu ve
   *    form onay metni + bu alanların kendisi; yalnızca textApproval özete girmez).
   * Sıra: önce yukarıdaki alanlar doldurulur → nihai metin önizlemede okunur → onay verilir. Yukarıdaki alanlardan
   * biri eksikken onay kabul edilmez ve derleme özet basmaz. Değerleri elle hesaplamayın: alanlar tamamken
   * PUBLIC_SITE_ENV=production derlemesi durduğunda hata mesajı (ve önizleme sayfasının uyarısı) bu nesneyi tam
   * haliyle basar; by/date doldurulup olduğu gibi kopyalanır. Onaydan sonra yukarıdaki alanlardan biri (ör. saklama
   * süresi, bildirim kanalı, m.9 cümlesi), metnin herhangi bir ifadesi ya da yapılandırma (ör. GitHub Variables'a
   * PUBLIC_GA4_ID eklenmesi) değişince hash/context değişir, onay geçersizleşir ve yeni onay gerekir.
   */
  textApproval: (LegalConfirmation & { version: string; context: string; hash: string }) | null;
}

/** Yalnızca işletme/avukat yanıtıyla doldurulur (tahmin yok). Sorular: CONTENT-VERIFICATION.md §7. 27 Eyl 2026: tamamı işletmeden geldi (saklama süreleri, m.9 cümlesi, hukuki sebep teyidi, metin onayı). */
export const legalFacts: LegalFacts = {
  retention: {
    /** İşletme sahibi yanıtı, 27 Eyl 2026: randevu/iletişim talepleri 6 ay saklanır. */
    appointmentRequestsMonths: 6,
    /** İşletme sahibi yanıtı, 27 Eyl 2026: WhatsApp yazışmaları 6 ay saklanır. */
    whatsappMonths: 6,
    technicalLogsDays: null,
  },
  notificationChannels: null,
  /**
   * İşletme tarafından iletilen metin, 27 Eyl 2026 (TR aynen; EN, Claude çevirisi — nihai metin onayı kapsamında onaylanır).
   * Genel ifadedir; sağlayıcı başına mekanizma saymaz. Uyum için işletmenin sağlayıcılarla m.9'daki uygun güvenceleri
   * (ör. standart sözleşme) fiilen sağlaması gerekir — bu cümle tek başına bunu sağlamaz (CONTENT-VERIFICATION.md §7).
   */
  crossBorderBasis: {
    tr: 'Kişisel verileriniz, 6698 sayılı Kişisel Verilerin Korunması Kanunu’nun 9. maddesi kapsamında, ilgili mevzuatta öngörülen şartların sağlanması ve gerekli uygun güvencelerin bulunması hâlinde, hizmet alınan yurt dışındaki hizmet sağlayıcılara aktarılabilmektedir.',
    en: 'Your personal data may be transferred to the service providers abroad whose services we use, within the scope of Article 9 of the Turkish Personal Data Protection Law No. 6698, provided that the conditions set out in the relevant legislation are met and the necessary appropriate safeguards are in place.',
  },
  /** İşletme sahibi teyidi, 27 Eyl 2026 (sohbette: "Hukuki sebepleri teyit eden: İşletme sahibi"). */
  legalBasesConfirmation: { by: 'İşletme sahibi', date: '2026-09-27' },
  /**
   * İşletme sahibi onayı, 27 Eyl 2026: son gizlilik metni TR/EN (AYAZ-GIZLILIK-METNI-SON-TR.pdf, AYAZ-PRIVACY-NOTICE-FINAL-EN.pdf)
   * okundu, "Okudum, onaylıyorum". version/context/hash derlemenin bastığı nesneden aynen kopyalandı; metin, bir işletme
   * bilgisi ya da yapılandırma değişirse hash tutmaz → üretim derlemesi yeniden onay ister.
   */
  textApproval: {
    by: 'İşletme sahibi',
    date: '2026-09-27',
    version: '2026-09-27.6',
    context: 'form=whatsapp;turnstile=0;live=0;ga4=0;gads=0;meta=0;openai=0',
    hash: '5c05496f033b303e',
  },
};

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
    /** Places API (New) Place ID — işletmenin kendi Google Takeout dışa aktarımından (26 Eyl 2026) doğrulandı. */
    placeId: { value: 'ChIJFz--mydN0xQRGFX1eR6q5s8', status: 'verified' as VerificationStatus },
    /** Google'ın belgelenmiş Maps URL biçimi (query_place_id): işletme kartını ve yorumları açar. */
    placeUrl:
      'https://www.google.com/maps/search/?api=1&query=Ayaz%20%C4%B0%C5%9Fitme%20Cihazlar%C4%B1%20Sat%C4%B1%C5%9F%20ve%20Uygulama%20Merkezi&query_place_id=ChIJFz--mydN0xQRGFX1eR6q5s8',
    /** Google İşletme Profili > "Daha fazla yorum alın" bağlantısı (resmî). Boşsa paylaşım bağlantısı kullanılır. */
    writeReviewUrl: '',
    /** Doğrudan yüklenen harita gömmesi (işletme adı + adres sorgusu → işaretli konum). */
    mapsEmbedUrl:
      'https://www.google.com/maps?q=Ayaz%20%C4%B0%C5%9Fitme%20Cihazlar%C4%B1%20Sat%C4%B1%C5%9F%20ve%20Uygulama%20Merkezi%2C%20Ayval%C4%B1%20Cd.%20No%3A26%20A%2C%20A%C5%9Fa%C4%9F%C4%B1%20E%C4%9Flence%2C%2006010%20Ke%C3%A7i%C3%B6ren%20Ankara&z=17&output=embed',
  },

  /**
   * Çalışma saatleri: Google İşletme Profili (Takeout, 26 Eyl 2026; yorumlu ana kayıt) Pzt–Cmt 09:00–19:00,
   * Pazar kapalı; işletme tarafı 26 Eyl 2026'da bu saatlerin esas alınmasını onayladı.
   */
  hours: {
    status: 'verified' as VerificationStatus,
    weekly: [
      { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const, opens: '09:00', closes: '19:00' },
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

  /** Sitedeki yorum seçkisinde yazar adları tam mı ('Ali Veli') yoksa kısa mı ('Ali V.') gösterilsin? */
  reviewsShowFullNames: false,

  /**
   * Yorum bölümü gösterimi — PUSH ÖNCESİ KARAR GEREKLİ.
   *  'carousel' : Google yorumları + "5,0 · 65 yorum" özeti, döngülü (kullanıcı talebi).
   *  'link'     : Yorum metni/puan/adet YOK; yalnızca Google işletme profiline bağlantı.
   * Hukuk incelemesi (26 Eyl 2026): Ticari Reklam ve Haksız Ticari Uygulamalar Yön. m.28/B(1),(6)
   * (RG 1/7/2026-33297, yürürlük 1/8/2026) + Reklam Kurulu 14/2/2025 kararı, satın alımı doğrulanamayan
   * Google yorum ve puanlarının satıcı sitesinde yayınını yasaklıyor → önerilen: 'link'.
   * Ortam değişkeni PUBLIC_REVIEWS_DISPLAY ('carousel' | 'link') bu değeri ezer (GitHub > Variables).
   */
  reviewsDisplay: 'carousel' as 'carousel' | 'link',

  /** Kurumsal bağlantılar (doğrulananlar) */
  sameAs: ['https://maps.app.goo.gl/x7CAB5ZyCWHGagyi7', 'https://share.google/A7IBtvRd3n1rcFSQv'],

  /** Hukuki metin girdileri (işletme/avukat) — bkz. legalFacts yukarıda. */
  legal: legalFacts,

  /** Mevcut sitedeki GA4 kimliği (herkese açık HTML'de). .env ile etkinleşir. */
  knownAnalytics: { ga4: 'G-VRC710M0YF' },
} as const;

export type Business = typeof business;

export const whatsappLink = (text?: string) =>
  text ? `${business.whatsapp.href}?text=${encodeURIComponent(text)}` : business.whatsapp.href;

/** Vitrin/tabela iddiaları için yayın kontrolü */
export const canShow = (v: { status: VerificationStatus; value?: unknown }) => v.value !== false && isPublishable(v.status);
