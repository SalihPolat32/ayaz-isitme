/**
 * keciorenisitme.com API — Cloudflare Worker giriş noktası.
 *   POST /api/appointment  randevu talebi → e-posta (+Telegram)
 *   GET  /api/reviews      Google yorumları (önbellekli vekil)
 *   GET  /api/health       sürüm ve etkin özellikler
 */
import pkg from '../package.json';
import { handleAppointment } from './appointment';
import { applyCors, handlePreflight, isAllowedOrigin, parseAllowedOrigins } from './cors';
import type { Env } from './env';
import { SECURITY_HEADERS, fail, intFromEnv, json } from './http';
import { selectMailProvider } from './providers';
import { handleReviews } from './reviews';

const VERSION: string = pkg.version;

function methodNotAllowed(allow: string): Response {
  return fail(405, 'method_not_allowed', {}, { Allow: allow });
}

function health(env: Env): Response {
  return json({
    ok: true,
    version: VERSION,
    features: {
      mail: selectMailProvider(env).name,
      telegram: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
      turnstile: Boolean(env.TURNSTILE_SECRET_KEY),
      reviews: Boolean(env.GOOGLE_PLACE_ID && env.GOOGLE_PLACES_API_KEY),
      rateLimit: {
        appointment: env.APPT_LIMITER ? 'binding' : env.RATE_KV ? 'kv' : 'none',
        reviews: env.REVIEWS_LIMITER ? 'binding' : 'none',
      },
      reviewsCacheTtl: intFromEnv(env.REVIEWS_CACHE_TTL, 0, 0),
    },
  });
}

async function route(request: Request, env: Env, ctx: ExecutionContext, allowed: ReadonlySet<string>): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method.toUpperCase();

  switch (path) {
    case '/api/appointment': {
      if (method !== 'POST') return methodNotAllowed('POST, OPTIONS');
      // Yalnızca tarayıcıdan, izinli kaynaktan gelen istekler.
      if (!isAllowedOrigin(request.headers.get('Origin'), allowed)) return fail(403, 'origin');
      return handleAppointment(request, env, allowed);
    }
    case '/api/reviews': {
      if (method !== 'GET') return methodNotAllowed('GET, OPTIONS');
      return handleReviews(request, env, ctx);
    }
    case '/api/health': {
      if (method !== 'GET') return methodNotAllowed('GET, OPTIONS');
      return health(env);
    }
    default:
      return fail(404, 'not_found');
  }
}

/** Güvenlik başlıkları + CORS; mevcut başlıkların üzerine yazmaz. */
function finalize(response: Response, origin: string | null, allowed: ReadonlySet<string>): Response {
  const out = applyCors(response, origin, allowed);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) if (!out.headers.has(k)) out.headers.set(k, v);
  return out;
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const allowed = parseAllowedOrigins(env.ALLOWED_ORIGINS);
    const origin = request.headers.get('Origin');

    let response: Response;
    try {
      response = request.method === 'OPTIONS' ? handlePreflight(request, allowed) : await route(request, env, ctx, allowed);
    } catch (e) {
      // Yığın izi ve mesaj yalnızca loga; istemciye genel hata.
      console.error('[worker] beklenmeyen hata:', e instanceof Error ? `${e.name}: ${e.message}` : String(e));
      response = fail(500, 'internal');
    }
    return finalize(response, origin, allowed);
  },
} satisfies ExportedHandler<Env>;
