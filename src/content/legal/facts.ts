/**
 * Hukuki metinlerin (gizlilik / KVKK / çerez) derleme bağlamı ve yayın kapısı.
 *
 *  - LegalBuildContext: metin YALNIZCA bu derlemede gerçekten olan işlemeyi anlatır
 *    (form modu, Turnstile, canlı yorumlar, ölçüm kimlikleri) — derleme ortamından türetilir.
 *  - missingLegalFacts(): business.legal içinde işletmenin/avukatın doldurması gereken eksikler.
 *  - enforceLegalGate(): PUBLIC_SITE_ENV=production derlemesi eksik varsa Türkçe listeyle DURUR;
 *    yalnızca ALLOW_INCOMPLETE_LEGAL=1 (QA) bunu aşar ve eksikler işaretli yer tutucu olarak basılır.
 *  - textApproval onayı NİHAİ METNİN kendisine bağlıdır: { version, context, hash }. hash, bu bağlamda gerçek
 *    işletme bilgileriyle basılan metinlerin içerik özetidir (text-hash.ts > legalTextHash(ctx, facts));
 *    döngüsel içe aktarmayı önlemek için bu modül özeti hesaplamaz, çağıran (index.ts) parametre olarak verir.
 *  - Sıra zorunludur: onay dışındaki bilgiler eksikken onay kabul edilmez ve kopyalanacak özet BASILMAZ
 *    (yer tutuculu metnin özeti olurdu); hepsi dolunca derleme nihai metnin özetini içeren nesneyi basar.
 *
 * Bu modül astro:env içe aktarmaz (vitest ile doğrudan test edilir); ortam değerleri sayfadan gelir.
 */
import type { LegalFacts, NotificationChannel } from '../../config/business';

/**
 * Metinlerin insan okuyabilir sürüm etiketi: 'YYYY-AA-GG' (son içerik değişikliği tarihi), aynı gün sonraki
 * değişikliklerde '.N' eki ('2026-09-27.4'). Metin (gizlilik sayfası, çerez paneli, harita notu) değişince
 * güncellenir; sayfadaki "Son güncelleme" tarihi buradan gelir. Onay yalnızca bu etikete değil, nihai metnin içerik
 * özetine de (textApproval.hash) bağlıdır: etiketi artırmayı unutsanız bile ifade değişikliği onayı geçersiz kılar.
 * .2 (27 Eyl 2026): KVKK m.11 bentleri Kanun lafzıyla (a–ğ); çerez paneli ve kaydı yapılandırmaya bağlı.
 * .3 (27 Eyl 2026): bildirim kanalları "ve/and" ile listelenir; pazarlama hizmeti varken "reklam profili" cümlesi kesinleşti.
 */
export const LEGAL_TEXT_VERSION = '2026-09-27.5';

/** QA için kapıyı aşan ortam değişkeni. deploy.yml'de ASLA tanımlanmaz (tests/legal.test.ts denetler). */
export const LEGAL_OVERRIDE_ENV = 'ALLOW_INCOMPLETE_LEGAL';

export interface LegalBuildContext {
  /** PUBLIC_SITE_ENV === 'production' */
  production: boolean;
  /** ALLOW_INCOMPLETE_LEGAL=1|true */
  allowIncomplete: boolean;
  /** PUBLIC_API_BASE boş → 'whatsapp' (form hazır WhatsApp mesajı üretir), dolu → 'api' (Cloudflare Worker) */
  formMode: 'whatsapp' | 'api';
  /** Turnstile yalnızca API modunda ve site anahtarı varsa yüklenir (src/scripts/form.ts) */
  turnstile: boolean;
  /** Canlı yorumlar: API modu + karusel (src/scripts/reviews.ts tarayıcıdan Worker'a istek atar) */
  liveReviews: boolean;
  ga4: boolean;
  gads: boolean;
  meta: boolean;
  openai: boolean;
}

export interface LegalEnv {
  PUBLIC_SITE_ENV?: string;
  PUBLIC_API_BASE?: string;
  PUBLIC_TURNSTILE_SITE_KEY?: string;
  PUBLIC_GA4_ID?: string;
  PUBLIC_GADS_ID?: string;
  PUBLIC_META_PIXEL_ID?: string;
  PUBLIC_OPENAI_PIXEL_ID?: string;
  ALLOW_INCOMPLETE_LEGAL?: string;
}

const filled = (v: string | undefined) => !!v && v.trim().length > 0;

export function legalContextFromEnv(env: LegalEnv, reviewsMode: 'carousel' | 'link'): LegalBuildContext {
  const api = filled(env.PUBLIC_API_BASE);
  const override = (env.ALLOW_INCOMPLETE_LEGAL ?? '').trim().toLowerCase();
  return {
    production: env.PUBLIC_SITE_ENV === 'production',
    allowIncomplete: override === '1' || override === 'true',
    formMode: api ? 'api' : 'whatsapp',
    turnstile: api && filled(env.PUBLIC_TURNSTILE_SITE_KEY),
    liveReviews: api && reviewsMode === 'carousel',
    ga4: filled(env.PUBLIC_GA4_ID),
    gads: filled(env.PUBLIC_GADS_ID),
    meta: filled(env.PUBLIC_META_PIXEL_ID),
    openai: filled(env.PUBLIC_OPENAI_PIXEL_ID),
  };
}

/**
 * Onaylanan metin, derleme yapılandırmasına göre değişir (WhatsApp/API modu, Turnstile, canlı yorumlar, ölçüm
 * etiketleri). Onay bu imzaya bağlanır: yapılandırma değişirse (ör. GitHub Variables'a PUBLIC_GA4_ID eklenirse)
 * üretim derlemesi yeni metnin onayını ister.
 */
export function legalContextSignature(ctx: LegalBuildContext): string {
  const b = (v: boolean) => (v ? 1 : 0);
  return `form=${ctx.formMode};turnstile=${b(ctx.turnstile)};live=${b(ctx.liveReviews)};ga4=${b(ctx.ga4)};gads=${b(ctx.gads)};meta=${b(ctx.meta)};openai=${b(ctx.openai)}`;
}

/** Metinde adı geçen sağlayıcılar ve kendi politikalarının adresleri. */
export const PROVIDERS = {
  github: { name: 'GitHub, Inc. (GitHub Pages)', privacy: 'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement', pages: 'https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages#data-collection' },
  google: { name: 'Google', privacy: 'https://policies.google.com/privacy', cookies: 'https://policies.google.com/technologies/cookies' },
  whatsapp: { name: 'WhatsApp (Meta)', privacy: 'https://www.whatsapp.com/legal/privacy-policy' },
  meta: { name: 'Meta Platforms', privacy: 'https://www.facebook.com/privacy/policy/', cookies: 'https://www.facebook.com/privacy/policies/cookies/' },
  cloudflare: { name: 'Cloudflare, Inc.', privacy: 'https://www.cloudflare.com/privacypolicy/' },
  openai: { name: 'OpenAI', privacy: 'https://openai.com/policies/privacy-policy/' },
  resend: { name: 'Resend', privacy: 'https://resend.com/legal/privacy-policy' },
  brevo: { name: 'Brevo', privacy: 'https://www.brevo.com/legal/privacypolicy/' },
  telegram: { name: 'Telegram', privacy: 'https://telegram.org/privacy' },
} as const;

export const NOTIFICATION_CHANNELS: readonly NotificationChannel[] = ['resend', 'brevo', 'telegram'];

/** Liste birleştirme: 'A', 'A ve B', 'A, B ve C' (EN: 'and'). */
export const joinList = (items: readonly string[], and: string): string =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;

/** Eksik bir işletme bilgisi: yapılandırma anahtarı + işletmeye sorulacak soru (TR) + sayfadaki kısa etiket. */
export interface MissingFact {
  key: string;
  question: string;
  label: { tr: string; en: string };
}

const FACTS: Record<string, Omit<MissingFact, 'key'>> = {
  'retention.appointmentRequestsMonths': {
    question: 'Randevu ve iletişim talepleri (form bildirimi, e-posta, telefonla alınan talep kayıtları) talebin alındığı tarihten itibaren en fazla kaç ay saklanıyor ve sonra siliniyor?',
    label: { tr: 'randevu taleplerinin saklama süresi (ay)', en: 'retention period for appointment requests (months)' },
  },
  'retention.whatsappMonths': {
    question: 'WhatsApp yazışmaları (randevu mesajları dahil) işletmenin WhatsApp hesabında en fazla kaç ay tutuluyor ve sonra siliniyor?',
    label: { tr: 'WhatsApp yazışmalarının saklama süresi (ay)', en: 'retention period for WhatsApp conversations (months)' },
  },
  'retention.technicalLogsDays': {
    question: 'Cloudflare Worker çalışma kayıtları (Workers Logs / observability) kaç gün tutuluyor? (Cloudflare panelindeki plan/ayar)',
    label: { tr: 'teknik kayıtların saklama süresi (gün)', en: 'retention period for technical logs (days)' },
  },
  notificationChannels: {
    question: "Cloudflare Worker'da randevu bildirimi için gerçekten hangi kanallar etkin: 'resend', 'brevo', 'telegram' (bir veya birkaçı)?",
    label: { tr: 'randevu bildiriminin iletildiği sağlayıcı(lar)', en: 'notification provider(s) that deliver appointment requests' },
  },
  'crossBorderBasis.tr': {
    question: 'KVKK m.9 kapsamında yurt dışına aktarımın (GitHub Pages barındırma, Google Haritalar, WhatsApp/Meta; API modunda Cloudflare ve bildirim sağlayıcısı; izinle ölçüm hizmetleri) dayanağı nedir? Avukatın yazdığı tek cümlelik Türkçe metin.',
    label: { tr: 'yurt dışına aktarım dayanağı (KVKK m.9)', en: 'legal basis for cross-border transfer (Art. 9)' },
  },
  'crossBorderBasis.en': {
    question: 'Aynı yurt dışı aktarım dayanağının İngilizce karşılığı (avukat onaylı).',
    label: { tr: 'yurt dışına aktarım dayanağı (İngilizce metin)', en: 'legal basis for cross-border transfer (English text)' },
  },
  legalBasesConfirmation: {
    question: 'Metindeki hukuki sebepler doğru mu: form/iletişim için m.5/2-(c) ve m.5/2-(f); barındırma kayıtları, harita ve bot koruması için m.5/2-(f); isteğe bağlı analitik/pazarlama çerezleri için m.5/1 açık rıza? Teyit eden (rol/kısa ad) ve tarih.',
    label: { tr: 'hukuki sebeplerin teyidi', en: 'confirmation of the legal bases' },
  },
  textApproval: {
    question: `Gizlilik, KVKK ve çerez metinlerinin NİHAİ hali (diğer tüm bilgiler doldurulduktan sonraki gizlilik sayfası TR/EN, çerez paneli, harita notu ve randevu formunun onay metni; sürüm ${LEGAL_TEXT_VERSION}, bu derlemenin yapılandırmasıyla) işletme sahibi/avukat tarafından okunup onaylandı mı? Onaylayan (rol/kısa ad) ve tarih; sürüm, yapılandırma imzası (context) ve nihai metnin özeti (hash) derlemenin bastığı nesnede hazırdır, olduğu gibi kopyalanır.`,
    label: { tr: 'metinlerin işletme/avukat onayı', en: 'approval of these texts by the business/lawyer' },
  },
};

export const factInfo = (key: string): MissingFact => ({ key, ...FACTS[key]! });

const posInt = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v > 0;
const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
const isoDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const confirmation = (v: unknown): boolean => {
  const c = v as { by?: unknown; date?: unknown } | null;
  return !!c && text(c.by) && isoDate(c.date);
};

/** Onayın bu derlemede taşıması gereken alanlar (by/date dışındakiler): sürüm etiketi, yapılandırma imzası, metin özeti. */
export function expectedTextApproval(ctx: LegalBuildContext, textHash: string): { version: string; context: string; hash: string } {
  return { version: LEGAL_TEXT_VERSION, context: legalContextSignature(ctx), hash: textHash };
}

/**
 * Derleme hatasında (ve önizleme uyarısında) basılan, business.legal.textApproval'a olduğu gibi kopyalanacak nesne
 * (by/date yer tutucu). Yalnızca onay dışındaki bilgiler tamamken çağrılmalıdır (awaitingApprovalOnly).
 */
export function textApprovalTemplate(ctx: LegalBuildContext, textHash: string): string {
  const e = expectedTextApproval(ctx, textHash);
  return `{ by: '<rol/kısa ad>', date: '<YYYY-AA-GG>', version: '${e.version}', context: '${e.context}', hash: '${e.hash}' }`;
}

/**
 * Bu derlemede gerekli olup eksik/geçersiz olan işletme bilgileri.
 * textHash: bu bağlamda bu bilgilerle basılan nihai metnin özeti (text-hash.ts > legalTextHash(ctx, facts)); onay buna eşit olmalı.
 */
export function missingLegalFacts(facts: LegalFacts, ctx: LegalBuildContext, textHash: string): MissingFact[] {
  const keys: string[] = [];
  if (!posInt(facts.retention.appointmentRequestsMonths)) keys.push('retention.appointmentRequestsMonths');
  if (!posInt(facts.retention.whatsappMonths)) keys.push('retention.whatsappMonths');
  if (ctx.formMode === 'api') {
    if (!posInt(facts.retention.technicalLogsDays)) keys.push('retention.technicalLogsDays');
    const ch = facts.notificationChannels;
    if (!ch || ch.length === 0 || ch.some((c) => !NOTIFICATION_CHANNELS.includes(c))) keys.push('notificationChannels');
  }
  if (!text(facts.crossBorderBasis?.tr)) keys.push('crossBorderBasis.tr');
  if (!text(facts.crossBorderBasis?.en)) keys.push('crossBorderBasis.en');
  if (!confirmation(facts.legalBasesConfirmation)) keys.push('legalBasesConfirmation');
  const exp = expectedTextApproval(ctx, textHash);
  const a = facts.textApproval;
  // Diğer bilgiler eksikken onay hiçbir koşulda geçerli sayılmaz: onaylanacak nihai metin henüz yok (yer tutuculu).
  const others = keys.length > 0;
  if (others || !confirmation(a) || a?.version !== exp.version || a?.context !== exp.context || a?.hash !== exp.hash) keys.push('textApproval');
  return keys.map(factInfo);
}

/** Eksik yalnızca textApproval mı? (Diğer bilgiler tamam → nihai metin hazır, özeti onaya sunulabilir.) */
export const awaitingApprovalOnly = (missing: readonly MissingFact[]): boolean => missing.length === 1 && missing[0]!.key === 'textApproval';

/** Onay satırının altına basılan açıklama: diğer bilgiler eksikse özet YOK, tamamsa kopyalanacak tam nesne. */
function approvalHint(missing: MissingFact[], ctx: LegalBuildContext, textHash: string): string {
  if (!awaitingApprovalOnly(missing)) {
    const n = missing.length - 1;
    return (
      `\n     → Önce yukarıdaki ${n} bilgiyi doldurun ve derlemeyi yeniden çalıştırın. Onay nesnesi (hash dahil) ancak onay dışındaki tüm bilgiler` +
      `\n       dolunca basılır: şu an basılacak özet yer tutuculu metne ait olurdu. Sıra: bilgileri doldur → nihai metni önizlemede oku → basılan nesneyi onayla.`
    );
  }
  return (
    `\n     → textApproval: ${textApprovalTemplate(ctx, textHash)}` +
    `\n     (hash, diğer bilgiler doldurulmuş NİHAİ metnin özetidir; önizlemedeki /gizlilik/ ve /en/privacy/ sayfaları, çerez paneli, harita notu ve form onay metni okunup onaylandıktan sonra kopyalanır.` +
    `\n      Metin, işletme bilgilerinden biri — ör. saklama süresi, bildirim kanalı, m.9 cümlesi — ya da yapılandırma — ör. PUBLIC_GA4_ID — değişirse hash/context değişir ve yeni onay gerekir.)`
  );
}

export function formatLegalGateError(missing: MissingFact[], ctx: LegalBuildContext, textHash: string): string {
  const mode = ctx.formMode === 'api' ? 'API modu: PUBLIC_API_BASE dolu' : 'WhatsApp modu: PUBLIC_API_BASE boş';
  return [
    `[hukuki-metin-kapısı] Üretim derlemesi durduruldu: gizlilik/KVKK/çerez metinleri için ${missing.length} işletme bilgisi eksik (${mode}).`,
    'Doldurulacak yer: src/config/business.ts > legalFacts (business.legal). Değerler tahminle yazılmaz; işletme/avukat yanıtı gerekir.',
    ...missing.map((m, i) => `  ${i + 1}. business.legal.${m.key} — ${m.question}` + (m.key === 'textApproval' ? approvalHint(missing, ctx, textHash) : '')),
    `Yalnızca QA/deneme derlemesi için: ${LEGAL_OVERRIDE_ENV}=1 ile derleme, eksikler işaretli yer tutucu olarak basılarak tamamlanır (deploy.yml'de ASLA tanımlanmaz).`,
  ].join('\n');
}

export interface LegalGateResult {
  missing: MissingFact[];
  /** Eksikler sayfada yer tutucu olarak basılacak mı (önizleme veya QA geçersiz kılma) */
  placeholders: boolean;
}

/** Üretimde eksik varsa ve geçersiz kılma yoksa hata fırlatır (derleme durur). textHash: legalTextHash(ctx, facts). */
export function enforceLegalGate(facts: LegalFacts, ctx: LegalBuildContext, textHash: string): LegalGateResult {
  const missing = missingLegalFacts(facts, ctx, textHash);
  if (missing.length && ctx.production && !ctx.allowIncomplete) throw new Error(formatLegalGateError(missing, ctx, textHash));
  return { missing, placeholders: missing.length > 0 };
}

/** Eksik bilgi için sayfada görünen işaretli yer tutucu. */
export function todo(key: string, locale: 'tr' | 'en'): string {
  const f = factInfo(key);
  const lead = locale === 'tr' ? 'İşletme dolduracak' : 'To be provided by the business';
  return `<mark class="legal-todo" data-legal-todo="${key}">${lead}: ${f.label[locale]} (<code>business.legal.${key}</code>)</mark>`;
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** LEGAL_TEXT_VERSION (tarih kısmı) → "26 Eylül 2026" / "26 September 2026" */
export function formatVersionDate(locale: 'tr' | 'en'): string {
  const [y, m, d] = LEGAL_TEXT_VERSION.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(y!, m! - 1, d!));
}

/** Metinde kullanılacak değer ya da yer tutucu. */
export interface LegalValues {
  appointmentMonths: string;
  whatsappMonths: string;
  logsDays: string;
  channels: NotificationChannel[] | null;
  channelsTodo: string;
  crossBorder: string;
}

export function legalValues(facts: LegalFacts, locale: 'tr' | 'en'): LegalValues {
  const n = (v: number | null, key: string) => (posInt(v) ? String(v) : todo(key, locale));
  const ch = facts.notificationChannels && facts.notificationChannels.length && facts.notificationChannels.every((c) => NOTIFICATION_CHANNELS.includes(c)) ? [...facts.notificationChannels] : null;
  const cb = facts.crossBorderBasis?.[locale];
  return {
    appointmentMonths: n(facts.retention.appointmentRequestsMonths, 'retention.appointmentRequestsMonths'),
    whatsappMonths: n(facts.retention.whatsappMonths, 'retention.whatsappMonths'),
    logsDays: n(facts.retention.technicalLogsDays, 'retention.technicalLogsDays'),
    channels: ch,
    channelsTodo: todo('notificationChannels', locale),
    crossBorder: text(cb) ? escapeHtml(cb!.trim()) : todo(`crossBorderBasis.${locale}`, locale),
  };
}

/** Dış bağlantı */
export const ext = (href: string, label: string) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
