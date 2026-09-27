/** review-fingerprint.mjs tür bildirimleri (src/scripts/reviews.ts ve testler için) */
export declare const SIMILARITY_MIN: number;
export declare const TEXT_SIMILARITY_MIN: number;
export declare function fold(value: unknown): string;
export declare function fnv1a(value: string): string;
export declare function textFp(text: unknown): string;
export declare function idFp(id: unknown): string;
export declare function authorKey(name: unknown): string;
export declare function monthOf(value: unknown): string;
export declare function authorMonthFp(name: unknown, month: unknown): string;
export declare function wordSet(text: unknown): Set<string>;
export declare function similarity(a: string | Set<string>, b: string | Set<string>): number;
export declare function reviewFps(input?: { id?: string; author?: string; months?: string[]; texts?: string[] }): string[];
/** Çıkarılan tek yorumun koruma kaydı: t/i/m anahtarları + her metnin sıralı kelime özetleri (8 hex, boşlukla ayrılmış). Metin yok. */
export interface GuardRecord {
  fp: string[];
  w: string[];
}
export declare function guardRecord(input?: { id?: string; author?: string; months?: string[]; texts?: string[] }): GuardRecord;
export interface ReviewCard {
  fp: readonly string[];
  /** Kartın metinleri (benzerlik için): sayfada görünen metin + varsa diğer dildeki metin */
  texts: readonly string[];
}
/** Kayıt başına dizin girdisi (kart ya da koruma kaydı): kendi t/i/m anahtarları ve metinlerinin kelime kümeleri */
export interface IndexedRecord {
  t: Set<string>;
  i: Set<string>;
  m: Set<string>;
  words: Set<string>[];
}
export interface ReviewIndex {
  cards: IndexedRecord[];
  guard: IndexedRecord[];
}
export interface LiveReviewLike {
  id?: string;
  author?: string;
  text?: string;
  publishTime?: string;
}
export type MatchReason = 'text' | 'text-author-month' | 'id' | 'author-month-similar';
export type LiveDecision = ['blocked', MatchReason] | ['duplicate', MatchReason] | ['new', ''];
/** Koruma listesini doğrular; biçim bozuksa hata fırlatır. */
export declare function parseGuard(guard: unknown): IndexedRecord[];
export declare function buildIndex(input?: { cards?: readonly ReviewCard[]; guard?: unknown }): ReviewIndex;
export declare function liveFps(r: LiveReviewLike): { id: string; month: string; text: string };
export declare function classifyLive(r: LiveReviewLike, idx: ReviewIndex): LiveDecision;
export declare function selectFreshReviews<T extends LiveReviewLike>(live: readonly T[], index: ReviewIndex | { cards?: readonly ReviewCard[]; guard?: unknown }, max?: number): T[];
