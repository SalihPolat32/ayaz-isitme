/**
 * Google Business Profile (Takeout / Business Profile API) Review → site verisi.
 * Review şeması: https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews
 *
 * Takeout'ta iki çeviri biçimi görülür:
 *   A) "<özgün>\n\n(Translated by Google)\n<çeviri>"            ← Türkçe yorumlar (bu işletmede 58/58)
 *   B) "(Translated by Google) <çeviri>\n\n(Original)\n<özgün>"  ← yabancı dilde yazılmış yorumlar
 */
import { reviewFps, guardRecord, fnv1a } from './review-fingerprint.mjs';

const STARS = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
const T_RE = /\((?:Translated by Google|Google tarafından çevrildi)\)/i;
const O_RE = /\((?:Original|Orijinal|Özgün)\)/i;
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** Özgün metin ve (varsa) Google çevirisi */
export function splitTranslation(comment) {
  const t = String(comment || '');
  if (O_RE.test(t)) {
    const [before, after] = t.split(O_RE);
    return { original: clean(after), translation: clean(before.replace(T_RE, '')) };
  }
  if (T_RE.test(t)) {
    const [before, after] = t.split(T_RE);
    return { original: clean(before), translation: clean(after) };
  }
  return { original: clean(t), translation: '' };
}
export const originalText = (c) => splitTranslation(c).original;

export function starValue(v) {
  if (typeof v === 'number') return Math.max(1, Math.min(5, Math.round(v)));
  return STARS[String(v || '').toUpperCase()] ?? 0;
}

/** Tek bir Review nesnesini normalize eder; puanı olmayanları eler (null). */
export function normalizeReview(r) {
  const rating = starValue(r.starRating ?? r.rating);
  if (!rating) return null;
  const anon = r.reviewer?.isAnonymous === true;
  const author = anon ? 'Google kullanıcısı' : clean(r.reviewer?.displayName ?? r.author) || 'Google kullanıcısı';
  const created = String(r.createTime ?? r.publishTime ?? '');
  const approxDate = /^\d{4}-\d{2}/.test(created) ? created.slice(0, 7) : '';
  const { original, translation } = splitTranslation(r.comment ?? r.text);
  const updated = String(r.updateTime ?? '');
  // Google yorum kimliği (…/reviews/{id}); yoksa yerel kimlik — ad İÇERMEZ (depo herkese açık), yalnızca özet.
  const gid = String(r.name ?? r.reviewId ?? '').split('/').pop() || '';
  const id = gid || `x${fnv1a(`${author}|${created}|${original}`)}`;
  return { id, gid, author, rating, text: original, translation, approxDate, createTime: created, updateTime: updated };
}

/** Takeout JSON içeriği: { reviews: [...] } veya [...] */
export function reviewsFromJson(json) {
  const list = Array.isArray(json) ? json : Array.isArray(json?.reviews) ? json.reviews : [];
  return list.map(normalizeReview).filter(Boolean);
}

/**
 * "En iyi önce" kalite puanı (0–100, belgelenmiş ağırlıklar):
 *  - Somutluk: süreç/hizmet ayrıntısı (seçim, ayar, kontrol, takip, bilgilendirme, deneme…)  en çok 36
 *  - Güven sinyali: uzman, bilgili, ilgili, güler yüz, güven, profesyonel, tavsiye…           en çok 24
 *  - Uzunluk: 60–450 karakter arası ideal                                                     en çok 25
 *  - Güncellik: son 24 ay                                                                      en çok 15
 *  - Ceza: çok kısa (< 60), "kulaklık/paket" gibi yanıltıcı ifade, rakip karşılaştırması,
 *          kesin sağlık sonucu iddiası, "yeni açılmış" (tarihli ifade)
 */
const SPECIFIC = /(seçim|seçtik|ayar|ince ayar|kontrol|takip|satış sonrası|iletişim halinde|bilgilendir|anlattı|detaylı|deneme|deneyerek|soru|işlem|iki kulağ|cihaz tanıt|uygun cihaz|güvende)/giu;
const TRUST = /(uzman|bilgili|bilgisi|ilgili|ilgi ve alaka|güler ?yüz|samimi|güven|profesyonel|işinin ehli|özen|tavsiye)/giu;
const PENALTY = [
  { re: /kulaklık|paketlen/iu, pts: 12 },
  { re: /diğer firma|bir çok cihaz bayisi|birçok yeri gezdik|birkaç işitme merkezine/iu, pts: 6 },
  { re: /sorunu kalmadı|sorunu çözüldü|iyileşti|tamamen duy/iu, pts: 10 },
  { re: /yeni açıl/iu, pts: 6 },
];
export function qualityScore(r, now = new Date()) {
  const t = r.text || '';
  if (!t) return 0;
  const hits = (re) => new Set((t.match(re) || []).map((m) => m.toLocaleLowerCase('tr-TR'))).size;
  const specific = Math.min(36, hits(SPECIFIC) * 9);
  const trust = Math.min(24, hits(TRUST) * 6);
  const len = t.length;
  const length = len < 60 ? 0 : len <= 450 ? Math.min(25, ((len - 60) / 390) * 25 + 5) : 25 - Math.min(10, (len - 450) / 40);
  const months = r.approxDate ? (now.getUTCFullYear() - Number(r.approxDate.slice(0, 4))) * 12 + (now.getUTCMonth() + 1 - Number(r.approxDate.slice(5, 7))) : 36;
  const recency = Math.max(0, 15 - Math.max(0, months) * 0.6);
  const penalty = PENALTY.reduce((s, p) => s + (p.re.test(t) ? p.pts : 0), 0) + (len < 60 ? 15 : 0);
  return Math.max(0, Math.round((specific + trust + length + recency - penalty) * 10) / 10);
}

const key = (r) => `${r.author.toLocaleLowerCase('tr-TR')}|${r.text.slice(0, 48).toLocaleLowerCase('tr-TR')}`;

/**
 * Seçki kategorileri (src/content/reviews-curation.json):
 *  exclude[].category   'legal-risk' → gösterilmez (sağlık sonucu iddiası, rakip kıyası/kötüleme, marka/model,
 *                                      fiyat ya da doğrulanamaz üstünlük iddiası, olası çıkar çatışması)
 *                       'editorial'  → GÖSTERİLİR, yalnızca sırada geriye alınır (kısa/zayıf, argo, "kulaklık"…)
 *  enExclude[].category 'translation-error' → İngilizce sayfada gösterilmez (Google çevirisi özgünü çarpıtıyor)
 *                       'editorial'         → İngilizcede de gösterilir, geriye alınır
 * Kategorisiz / düz metin kayıtlar güvenli tarafta kalır: gösterilmez.
 */
const entryId = (e) => (typeof e === 'string' ? e : e?.id);
const entryCat = (e) => (typeof e === 'string' ? '' : String(e?.category || ''));
export function curationSets(curation = {}) {
  const exclude = new Set(), demote = new Set(), enExclude = new Set(), enDemote = new Set();
  for (const e of curation.exclude || []) (entryCat(e) === 'editorial' ? demote : exclude).add(entryId(e));
  for (const e of curation.enExclude || []) (entryCat(e) === 'editorial' ? enDemote : enExclude).add(entryId(e));
  return { exclude, demote, enExclude, enDemote };
}

/**
 * Tekrarları eler, özet çıkarır (tüm puanlar), metinli yorumları sıralar:
 * curation.pin sırası → kalan en yüksek kalite puanı önce → editoryal olarak geriye alınanlar en sonda.
 * 'legal-risk' kayıtlar gösterilmez (özete yine sayılır; özet Google'daki gerçek toplamdır); her biri `guard`
 * listesine TEK koruma kaydı olarak yazılır (t/i/m + TR/EN kelime kümesi özetleri; metin yok). Canlı API modu,
 * statik kart tekrarıyla AYNI kayıt başına kurallarla eşleşen yorumu geri eklemez (bkz. review-fingerprint.mjs,
 * INTEGRATIONS.md §5).
 */
export function buildDataset(all, asOf, curation = {}, now = new Date()) {
  const seen = new Map();
  for (const r of all) if (!seen.has(key(r))) seen.set(key(r), r);
  const uniq = [...seen.values()];
  const avg = uniq.reduce((s, r) => s + r.rating, 0) / Math.max(1, uniq.length);
  const { exclude, demote, enExclude, enDemote } = curationSets(curation);
  const pin = curation.pin || [];
  const byPin = (pins, demoted, fallback) => (a, b) => {
    const pa = pins.indexOf(a.id), pb = pins.indexOf(b.id);
    if (pa !== -1 || pb !== -1) return (pa === -1 ? 1e9 : pa) - (pb === -1 ? 1e9 : pb);
    const da = demoted.has(a.id) ? 1 : 0, db = demoted.has(b.id) ? 1 : 0;
    return da - db || fallback(a, b);
  };
  const shown = uniq.filter((r) => r.text && !exclude.has(r.id)).map((r) => ({ ...r, score: qualityScore(r, now) }));
  shown.sort(byPin(pin, demote, (a, b) => b.score - a.score || b.createTime.localeCompare(a.createTime)));
  // İngilizce sayfa: çevirisi olanlar (translation-error olanlar hariç); sıra enPin (yoksa pin) + TR sırası.
  const enPin = curation.enPin || pin;
  const en = shown.filter((r) => r.translation && !enExclude.has(r.id));
  const trIndex = new Map(shown.map((r, i) => [r.id, i]));
  const enDemoted = new Set([...demote, ...enDemote]);
  en.sort(byPin(enPin, enDemoted, (a, b) => trIndex.get(a.id) - trIndex.get(b.id)));
  // Parmak izleri (review-fingerprint.mjs): Google kimliği + kısa ad·ay (oluşturma VE güncelleme ayı) + TR özgün + EN çeviri.
  // Kısa ad tek başına anahtar değildir. Koruma (guard) = çıkarılan her yorum için TEK kayıt: aynı parmak izleri +
  // TR/EN metinlerinin kelime kümesi özetleri (benzerlik için; metin yazılmaz).
  const fpInput = (r) => ({ id: r.gid, author: r.author, months: [r.createTime, r.updateTime].filter(Boolean), texts: [r.text, r.translation].filter(Boolean) });
  const fpsOf = (r) => reviewFps(fpInput(r));
  const guardTr = uniq.filter((r) => r.text && exclude.has(r.id)).map((r) => guardRecord(fpInput(r)));
  const guardEn = [...guardTr, ...shown.filter((r) => enExclude.has(r.id)).map((r) => guardRecord(fpInput(r)))];
  return {
    summary: { rating: Math.round(avg * 10) / 10, count: uniq.length, withText: uniq.filter((r) => r.text).length, asOf, source: 'takeout' },
    reviews: shown.map(({ createTime, updateTime, translation, gid, ...rest }) => ({
      ...rest,
      ...(translation && !enExclude.has(rest.id) ? { textEn: translation } : {}),
      fp: fpsOf({ ...rest, gid, createTime, updateTime, translation }),
    })),
    enOrder: en.map((r) => r.id),
    guard: { tr: guardTr, en: guardEn },
  };
}

/**
 * Görünen ad düzeltmeleri (curation.displayNames: { <yorum kimliği>: '<gösterilecek ad>' }), içe aktarıcı uygular.
 * Varsayılan ad biçimi `format` ile ("Ad S." ya da --full-names ile tam ad) üretilir; haritadaki kayıt bunu ezer.
 * Amaç: 'Ad S.' kuralının kısaltamadığı tek kelimelik (ör. ad+soyad bitişik) Google görünen adları için işletme
 * sahibinin yorum başına karar vermesi. Harita boş bırakılır; bir biçim UYDURULMAZ.
 * Parmak izleri (fp) buildDataset'te Google'daki adla hesaplanmıştır → bu değişiklikten etkilenmez.
 * Dönüş: { reviews, unknown } — unknown: haritada olup veride olmayan (ya da değeri boş/geçersiz) kimlikler.
 */
export function applyDisplayNames(reviews, displayNames = {}, format = (a) => a) {
  const map = displayNames && typeof displayNames === 'object' && !Array.isArray(displayNames) ? displayNames : {};
  const ids = new Set(reviews.map((r) => r.id));
  const valid = (v) => typeof v === 'string' && clean(v).length > 0;
  const unknown = Object.keys(map).filter((id) => !ids.has(id) || !valid(map[id]));
  const out = reviews.map((r) => ({ ...r, author: Object.hasOwn(map, r.id) && valid(map[r.id]) ? clean(map[r.id]) : format(r.author) }));
  return { reviews: out, unknown };
}
