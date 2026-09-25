/**
 * Worker ortamı (bindings + vars + secrets).
 *
 * `wrangler types` küresel bir `Env` üretir; bu modül-kapsamlı sürüm bilinçli olarak
 * ayrı tutulur: her alan isteğe bağlıdır, çünkü Worker eksik yapılandırmayla da
 * (mock e-posta, Turnstile kapalı, yorumlar 503) güvenli şekilde çalışmalıdır.
 */

export type MailProviderName = 'resend' | 'brevo' | 'mock';

export interface Env {
  // ---- vars (wrangler.jsonc) ------------------------------------------------
  /** Virgülle ayrılmış izinli kaynaklar. Boşsa varsayılan liste kullanılır (bkz. cors.ts). */
  ALLOWED_ORIGINS?: string;
  /** "resend" | "brevo" | "mock". Anahtar yoksa "mock"a düşer. */
  MAIL_PROVIDER?: string;
  /** Gönderen: "Ad <adres@dogrulanmis-alan>" */
  MAIL_FROM?: string;
  /** Alıcı (işletme e-postası) */
  MAIL_TO?: string;
  /** Yorum önbelleği süresi (saniye). Varsayılan 0 = önbellek yok, her istek canlı (Google şartları). */
  REVIEWS_CACHE_TTL?: string;
  /** Önbellek açıkken, Google hata verirse eski kopyanın sunulabileceği ek süre (saniye). Varsayılan 0. */
  REVIEWS_CACHE_STALE_TTL?: string;

  // ---- secrets (wrangler secret put / .dev.vars) -----------------------------
  RESEND_API_KEY?: string;
  BREVO_API_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  GOOGLE_PLACES_API_KEY?: string;
  GOOGLE_PLACE_ID?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;

  // ---- bindings (isteğe bağlı) ----------------------------------------------
  /** Workers Rate Limiting binding, randevu formu — 5/60 sn (wrangler.jsonc "ratelimits"). */
  APPT_LIMITER?: RateLimit;
  /** Workers Rate Limiting binding, yorumlar — 30/60 sn. */
  REVIEWS_LIMITER?: RateLimit;
  /** KV yedek sayacı (wrangler.jsonc "kv_namespaces"). */
  RATE_KV?: KVNamespace;
}
