/**
 * IP başına hız sınırı.
 *  1) Workers Rate Limiting binding (tercih; ücretsiz, kurulum gerektirmez, PoP başına sayar)
 *  2) KV sabit pencere sayacı (yedek; her istek 1 KV yazma harcar — yalnızca form uç noktası için)
 *  3) Hiçbiri yoksa: izin ver, bir kez uyar.
 */

export interface RateLimitOptions {
  /** Pencere başına izin verilen istek (KV yedeği için; binding'inki wrangler.jsonc'da). */
  limit: number;
  /** Pencere süresi, saniye. */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  source: 'binding' | 'kv' | 'none';
}

export interface RateLimitBackends {
  /** wrangler.jsonc "ratelimits" içindeki binding. */
  limiter?: RateLimit;
  /** İsteğe bağlı KV yedeği. */
  kv?: KVNamespace;
}

export const APPOINTMENT_RATE_LIMIT: RateLimitOptions = { limit: 5, windowSeconds: 60 };
export const REVIEWS_RATE_LIMIT: RateLimitOptions = { limit: 30, windowSeconds: 60 };

const warned = new Set<string>();

export async function checkRateLimit(
  backends: RateLimitBackends,
  key: string,
  opts: RateLimitOptions,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  if (backends.limiter) {
    const { success } = await backends.limiter.limit({ key });
    return { allowed: success, source: 'binding' };
  }

  if (backends.kv) {
    const window = Math.floor(now / 1000 / opts.windowSeconds);
    const kvKey = `rl:${key}:${window}`;
    const count = Number((await backends.kv.get(kvKey)) ?? '0') + 1;
    // expirationTtl en az 60 sn olmalı; pencerenin iki katı yeter.
    await backends.kv.put(kvKey, String(count), { expirationTtl: Math.max(60, opts.windowSeconds * 2) });
    return { allowed: count <= opts.limit, source: 'kv' };
  }

  const scope = key.split(':')[0] ?? key;
  if (!warned.has(scope)) {
    warned.add(scope);
    console.warn(`[ratelimit] "${scope}" için binding yok; hız sınırı uygulanmıyor`);
  }
  return { allowed: true, source: 'none' };
}
