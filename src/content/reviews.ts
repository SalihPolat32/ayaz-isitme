/**
 * Google işletme profili yorumları — src/content/reviews-data.json
 *  - Kaynak: işletmenin kendi Google Takeout dışa aktarımı (26 Eyl 2026): 65 puan, 58 metinli yorum.
 *  - Sıra: src/content/reviews-curation.json (pin/enPin/exclude/enExclude) + kalite puanı (en iyiler önce).
 *    exclude yalnızca 'legal-risk' kayıtları gizler; 'editorial' olanlar gösterilir ama sırada geridedir.
 *  - fp / guard: parmak izleri (scripts/lib/review-fingerprint.mjs) — canlı API modu tekrarları ve çıkarılanları AYNI
 *    kayıt başına kurallarla eler (guard: çıkarılan her yorum tek kayıt; kısa ad + ay ya da 40 karakterlik açılış tek
 *    başına asla — kurallar INTEGRATIONS.md §5).
 *  - SINIR: Takeout bir anlık görüntüdür; Google'da sonradan silinen/düzenlenen yorumları bilemez.
 *    Görüntü SNAPSHOT_MAX_AGE_DAYS günden eskiyse derleme uyarı yazar (warnIfSnapshotStale).
 *  - Gösterim modu: business.reviewsDisplay ('carousel' | 'link'); PUBLIC_REVIEWS_DISPLAY ile ezilebilir.
 *  - Güncellemek için: `node scripts/import-google-reviews.mjs <Takeout klasörü>`.
 *  - text: özgün Türkçe; textEn: Google çevirisi (İngilizce sayfada "Translated by Google" etiketiyle).
 * Yazar adları: varsayılan "Ad S." (bkz. business.reviewsShowFullNames).
 */
import data from './reviews-data.json';
import type { GuardRecord } from '../../scripts/lib/review-fingerprint.mjs';

export interface StaticReview {
  id?: string;
  author: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  textEn?: string;
  approxDate: string; // YYYY-MM
  score?: number;
  /** Parmak izleri: Google kimliği (i…) + kısa ad·yayın ayı (m…) + TR metin / EN çeviri (t…). Kısa ad tek başına yok. */
  fp?: string[];
}

export interface ReviewsSummary {
  rating: number;
  count: number;
  withText?: number;
  asOf: string; // YYYY-MM-DD
  source: 'observed' | 'takeout';
}

export const staticReviews = data.reviews as StaticReview[];
export const reviewsSummary = data.summary as ReviewsSummary;
const enOrder = ((data as { enOrder?: string[] }).enOrder ?? []) as string[];
const guard = ((data as { guard?: unknown }).guard ?? {}) as { tr?: GuardRecord[]; en?: GuardRecord[] };

/**
 * Seçkide çıkarılan yorumların koruma kayıtları (yorum başına bir kayıt: t/i/m + TR/EN kelime kümesi özetleri; metin yok).
 * Canlı API bunlarla eşleşen yorumu geri eklemez. EN, çevirisi hatalı olanları da içerir.
 */
export function reviewsGuard(locale: 'tr' | 'en'): GuardRecord[] {
  return (locale === 'en' ? guard.en : guard.tr) ?? [];
}

/** Takeout görüntüsü bu kadar günden eskiyse derleme uyarır. */
export const SNAPSHOT_MAX_AGE_DAYS = 90;

export function snapshotAgeDays(asOf: string, now: Date = new Date()): number {
  const t = Date.parse(`${asOf}T00:00:00Z`);
  return Number.isFinite(t) ? Math.floor((now.getTime() - t) / 86_400_000) : Number.POSITIVE_INFINITY;
}

let staleWarned = false;
/** Derleme sırasında (bir kez) konsola uyarı: yorum görüntüsü eski → Google'da silinen/düzenlenen yorumlar sitede kalmış olabilir. */
export function warnIfSnapshotStale(now: Date = new Date(), log: (msg: string) => void = console.warn): boolean {
  const age = snapshotAgeDays(reviewsSummary.asOf, now);
  if (age <= SNAPSHOT_MAX_AGE_DAYS) return false;
  if (!staleWarned) {
    staleWarned = true;
    log(
      `[reviews] UYARI: Google yorum görüntüsü ${Number.isFinite(age) ? `${age} günlük` : 'tarihsiz'} (asOf ${reviewsSummary.asOf}, sınır ${SNAPSHOT_MAX_AGE_DAYS} gün). ` +
        'Google\'da sonradan silinen/düzenlenen yorumlar sitede görünüyor olabilir → yeni Takeout ile `node scripts/import-google-reviews.mjs` çalıştırın (INTEGRATIONS.md §5).',
    );
  }
  return true;
}

/** Gösterim modu: bileşen prop'u > PUBLIC_REVIEWS_DISPLAY > business.reviewsDisplay. Geçersiz ortam değeri yok sayılır. */
export function resolveReviewsMode(prop: 'carousel' | 'link' | undefined, env: string | undefined, fallback: 'carousel' | 'link'): 'carousel' | 'link' {
  if (prop) return prop;
  return env === 'link' || env === 'carousel' ? env : fallback;
}

/** Dile göre gösterilecek liste: TR tümü (sıralı); EN yalnızca çevirisi temiz olanlar, enPin sırasıyla. */
export function reviewsFor(locale: 'tr' | 'en'): StaticReview[] {
  if (locale === 'tr') return staticReviews;
  const byId = new Map(staticReviews.map((r) => [r.id, r]));
  const list = enOrder.map((id) => byId.get(id)).filter((r): r is StaticReview => !!r && !!r.textEn);
  return list.length ? list : staticReviews.filter((r) => !!r.textEn);
}

/** "Ad S." biçimi (KVKK açısından daha temkinli varsayılan) */
export function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!;
  const first = parts[0]!;
  const lastInitial = parts[parts.length - 1]!.charAt(0).toLocaleUpperCase('tr-TR');
  return `${first} ${lastInitial}.`;
}

export function formatApproxDate(ym: string, locale: 'tr' | 'en'): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}
