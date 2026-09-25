/** JSON yanıt yardımcıları, güvenlik başlıkları ve güvenli gövde okuma. */

export const JSON_TYPE = 'application/json; charset=utf-8';

/** Bir API'nin ihtiyaç duyduğu kadar: içerik koklama yok, çerçeveleme yok, referrer sızmaz. */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  const h = new Headers(headers);
  h.set('Content-Type', JSON_TYPE);
  if (!h.has('Cache-Control')) h.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(data), { status, headers: h });
}

/** Standart hata zarfı: { ok:false, error:<kod>, ...ek }. Kişisel veri veya yığın izi asla girmez. */
export function fail(status: number, error: string, extra: Record<string, unknown> = {}, headers: HeadersInit = {}): Response {
  return json({ ok: false, error, ...extra }, status, headers);
}

export const MAX_JSON_BYTES = 16 * 1024;

export type ReadJsonResult<T> = { ok: true; value: T } | { ok: false; reason: 'content_type' | 'too_large' | 'invalid_json' };

/** JSON gövdesini içerik türü ve boyut sınırıyla okur; parse hatası istisna fırlatmaz. */
export async function readJson<T = unknown>(request: Request, maxBytes = MAX_JSON_BYTES): Promise<ReadJsonResult<T>> {
  const contentType = request.headers.get('Content-Type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) return { ok: false, reason: 'content_type' };

  const declared = Number(request.headers.get('Content-Length') ?? '0');
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, reason: 'too_large' };

  // Count incoming bytes, not JS characters; stop reading before an unbounded allocation.
  const reader = request.body?.getReader();
  if (!reader) return { ok: false, reason: 'invalid_json' };
  const decoder = new TextDecoder();
  let text = '';
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return { ok: false, reason: 'too_large' };
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch {
    return { ok: false, reason: 'invalid_json' };
  } finally {
    reader.releaseLock();
  }

  try {
    return { ok: true, value: JSON.parse(text) as T };
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }
}

/** Cloudflare'ın eklediği gerçek istemci IP'si. Yerel geliştirmede olmayabilir. */
export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP')?.trim() || 'unknown';
}

/**
 * Formun gönderildiği sayfa adresi: yalnızca Referer (sorgu/parça atılır), yoksa Origin.
 * Sorgu dizesi atılır ki reklam tıklama kimlikleri vb. e-postaya taşınmasın.
 */
export function pageUrlFrom(referer: string | null, origin: string | null): string {
  for (const candidate of [referer, origin]) {
    if (!candidate) continue;
    try {
      const u = new URL(candidate);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
      return `${u.origin}${u.pathname}`;
    } catch {
      /* geçersiz URL — sonraki adaya geç */
    }
  }
  return '-';
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/** Sayısal ortam değişkeni; boş/geçersizse varsayılan. */
export function intFromEnv(raw: string | undefined, fallback: number, min = 0): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || raw === undefined || raw === '') return fallback;
  return Math.max(min, Math.floor(n));
}
