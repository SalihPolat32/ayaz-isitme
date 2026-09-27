/**
 * GET /api/reviews — Google Places API (New) Place Details vekili.
 * Anahtar yalnızca sunucuda kalır; yanıt, ön yüzün ihtiyacı olan alanlara indirgenir.
 *
 * Önbellek VARSAYILAN OLARAK KAPALIDIR (REVIEWS_CACHE_TTL=0): Google Maps Platform şartları yalnızca
 * Place ID'nin saklanmasına açıkça izin verir; yorum içeriğini uçta tutmak işletme sahibinin
 * uyum kararıdır. Açıldığında Cache API (caches.default) sentetik anahtarla kullanılır.
 * Her durumda aynı izolattaki eşzamanlı istekler tek Google çağrısında birleştirilir (coalescing).
 */
import type { Env } from './env';
import { clientIp, fail, intFromEnv, json } from './http';
import { REVIEWS_RATE_LIMIT, checkRateLimit } from './ratelimit';

export const FIELD_MASK = 'id,displayName,rating,userRatingCount,googleMapsUri,reviews';
const PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places/';
const UPSTREAM_TIMEOUT_MS = 10_000;

// ---- Google yanıt tipleri (yalnızca istenen alanlar) ------------------------

export interface LocalizedText {
  text: string;
  languageCode?: string;
}

export interface PlaceReview {
  name?: string;
  relativePublishTimeDescription?: string;
  rating?: number;
  text?: LocalizedText;
  originalText?: LocalizedText;
  authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
  publishTime?: string;
  flagContentUri?: string;
  googleMapsUri?: string;
}

export interface PlaceDetails {
  id?: string;
  displayName?: LocalizedText;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: PlaceReview[];
}

// ---- Ön yüze dönen indirgenmiş biçim ----------------------------------------

export interface TrimmedReview {
  /**
   * Google yorum kimliği: Review.name ("places/{placeId}/reviews/{id}") son parçası; yoksa ''.
   * Ön yüz bunu yalnızca OLUMLU eşleşme işareti olarak kullanır (Takeout kimliğiyle aynı olduğu kanıtlanmadı).
   * Geriye dönük uyumlu ek alan: eski istemciler yok sayar.
   */
  id: string;
  author: string;
  authorUri: string;
  authorPhoto: string;
  rating: number;
  text: string;
  /** text çevrildiyse (text.languageCode !== originalText.languageCode) */
  translated: boolean;
  relativeTime: string;
  /** Yayın zamanı (Review.publishTime, RFC 3339 UTC); yoksa ''. Ön yüz ay eşleşmesi için kullanır. */
  publishTime: string;
  /** Yorumun Google Maps sayfası (Review.googleMapsUri) — politika gereği bağlantı verilmeli. */
  reviewUri: string;
  /** "Sorun bildir" bağlantısı (Review.flagContentUri; önerilir). */
  flagUri: string;
}

export interface ReviewsPayload {
  ok: true;
  attribution: 'Google';
  name: string;
  rating: number | null;
  userRatingCount: number | null;
  /** İşletmenin Google Maps sayfası (Place.googleMapsUri). */
  googleMapsUri: string | null;
  reviews: TrimmedReview[];
  fetchedAt: string;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Google Place Details yanıtını ön yüz için sadeleştirir (saf; testte kullanılır). */
export function trimPlace(place: PlaceDetails, fetchedAt: string): ReviewsPayload {
  const reviews: TrimmedReview[] = (Array.isArray(place.reviews) ? place.reviews : [])
    .filter((r): r is PlaceReview => r !== null && typeof r === 'object')
    .map((r) => {
      const text = r.text?.text ?? r.originalText?.text ?? '';
      const translated = Boolean(r.text?.languageCode && r.originalText?.languageCode && r.text.languageCode !== r.originalText.languageCode);
      const id = str(r.name).split('/').pop() ?? '';
      return {
        id: /^[A-Za-z0-9_-]+$/.test(id) ? id : '',
        author: str(r.authorAttribution?.displayName),
        authorUri: str(r.authorAttribution?.uri),
        authorPhoto: str(r.authorAttribution?.photoUri),
        rating: typeof r.rating === 'number' ? r.rating : 0,
        text: str(text).trim(),
        translated,
        relativeTime: str(r.relativePublishTimeDescription),
        publishTime: str(r.publishTime),
        reviewUri: str(r.googleMapsUri),
        flagUri: str(r.flagContentUri),
      };
    });

  return {
    ok: true,
    attribution: 'Google',
    name: str(place.displayName?.text),
    rating: typeof place.rating === 'number' ? place.rating : null,
    userRatingCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
    googleMapsUri: place.googleMapsUri ? str(place.googleMapsUri) : null,
    reviews,
    fetchedAt,
  };
}

// ---- Google çağrısı ---------------------------------------------------------

export async function fetchPlace(placeId: string, apiKey: string, fetchImpl: typeof fetch = fetch, locale: 'tr' | 'en' = 'tr'): Promise<PlaceDetails> {
  const url = new URL(PLACES_ENDPOINT + encodeURIComponent(placeId));
  url.searchParams.set('languageCode', locale);
  url.searchParams.set('regionCode', 'TR');

  const res = await fetchImpl(url.toString(), {
    headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELD_MASK, Accept: 'application/json' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!res.ok) {
    // Google hata zarfı: { error: { code, message, status } } — anahtar asla loglanmaz.
    const err = (await res.json().catch(() => null)) as { error?: { status?: string; message?: string } } | null;
    throw new Error(`places ${res.status} ${err?.error?.status ?? ''} ${(err?.error?.message ?? '').slice(0, 160)}`.trim());
  }
  return (await res.json()) as PlaceDetails;
}

// ---- Eşzamanlı istek birleştirme (coalescing) -------------------------------

const inflight = new Map<string, Promise<ReviewsPayload>>();

/**
 * Aynı izolatta aynı anda gelen istekler tek Google çağrısını paylaşır. Sonuç saklanmaz;
 * çağrı biter bitmez kayıt silinir. (Test için dışa açık.)
 */
export function fetchCoalesced(placeId: string, loader: () => Promise<ReviewsPayload>): Promise<ReviewsPayload> {
  const existing = inflight.get(placeId);
  if (existing) return existing;
  const p = loader().finally(() => {
    if (inflight.get(placeId) === p) inflight.delete(placeId);
  });
  inflight.set(placeId, p);
  return p;
}

// ---- İsteğe bağlı önbellek (Cache API) --------------------------------------

interface CachedEntry {
  payload: ReviewsPayload;
  ageSeconds: number;
}

function cacheKeyFor(request: Request, placeId: string, locale: 'tr' | 'en'): Request {
  // Sentetik GET anahtarı; Place ID değişirse eski kopya sunulmasın diye anahtara girer.
  const { origin } = new URL(request.url);
  return new Request(`${origin}/__cache/reviews/v1/${encodeURIComponent(placeId)}?lang=${locale}`, { method: 'GET' });
}

async function readCache(key: Request, now: number): Promise<CachedEntry | null> {
  if (typeof caches === 'undefined') return null;
  try {
    const hit = await caches.default.match(key);
    if (!hit) return null;
    const payload = (await hit.json()) as ReviewsPayload;
    const fetched = Date.parse(payload.fetchedAt);
    if (!Number.isFinite(fetched)) return null;
    return { payload, ageSeconds: Math.max(0, Math.floor((now - fetched) / 1000)) };
  } catch (e) {
    console.warn('[reviews] cache okunamadı', e instanceof Error ? e.message : e);
    return null;
  }
}

async function writeCache(key: Request, payload: ReviewsPayload, lifetimeSeconds: number): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const res = new Response(JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${lifetimeSeconds}` },
    });
    await caches.default.put(key, res);
  } catch (e) {
    console.warn('[reviews] cache yazılamadı', e instanceof Error ? e.message : e);
  }
}

type CacheState = 'bypass' | 'hit' | 'miss' | 'stale';

function respond(payload: ReviewsPayload, state: CacheState, browserMaxAge: number): Response {
  const cacheControl = browserMaxAge > 0 ? `public, max-age=${Math.max(60, browserMaxAge)}` : 'no-store';
  return json(payload, 200, { 'Cache-Control': cacheControl, 'X-Cache': state });
}

// ---- İşleyici ---------------------------------------------------------------

export async function handleReviews(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  // 1) Hız sınırı — yapılandırma kontrolünden önce, ki canlı çekim modu maliyet için suistimal edilemesin.
  const rate = await checkRateLimit({ limiter: env.REVIEWS_LIMITER }, `reviews:${clientIp(request)}`, REVIEWS_RATE_LIMIT);
  if (!rate.allowed) return fail(429, 'rate_limited', {}, { 'Retry-After': '60' });

  const placeId = env.GOOGLE_PLACE_ID?.trim();
  const apiKey = env.GOOGLE_PLACES_API_KEY?.trim();
  if (!placeId || !apiKey) return fail(503, 'not_configured');

  const ttl = intFromEnv(env.REVIEWS_CACHE_TTL, 0, 0);
  const stale = ttl > 0 ? intFromEnv(env.REVIEWS_CACHE_STALE_TTL, 0, 0) : 0;
  const now = Date.now();
  const locale = new URL(request.url).searchParams.get('lang') === 'en' ? 'en' : 'tr';
  const load = () => fetchCoalesced(`${placeId}:${locale}`, async () => trimPlace(await fetchPlace(placeId, apiKey, fetch, locale), new Date().toISOString()));

  // 2) Önbellek kapalı (varsayılan): her istek canlı, eşzamanlılar birleştirilir, tarayıcıya no-store.
  if (ttl === 0) {
    try {
      return respond(await load(), 'bypass', 0);
    } catch (e) {
      console.error('[reviews] Google çağrısı başarısız:', e instanceof Error ? e.message : e);
      return fail(502, 'upstream', {}, { 'Retry-After': '300' });
    }
  }

  // 3) Önbellek açık (işletme sahibinin uyum kararı; bkz. README §5.3)
  const key = cacheKeyFor(request, placeId, locale);
  const cached = await readCache(key, now);
  if (cached && cached.ageSeconds < ttl) return respond(cached.payload, 'hit', ttl - cached.ageSeconds);

  try {
    const payload = await load();
    ctx.waitUntil(writeCache(key, payload, ttl + stale));
    return respond(payload, 'miss', ttl);
  } catch (e) {
    console.error('[reviews] Google çağrısı başarısız:', e instanceof Error ? e.message : e);
    if (cached && cached.ageSeconds < ttl + stale) return respond(cached.payload, 'stale', 300);
    return fail(502, 'upstream', {}, { 'Retry-After': '300' });
  }
}
