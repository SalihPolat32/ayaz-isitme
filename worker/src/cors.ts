/**
 * CORS: yalnızca izin listesindeki kaynaklara (Origin) yanıt verilir; `*` asla kullanılmaz.
 * Cloudflare'ın örnek desenine göre preflight = Origin + Access-Control-Request-Method (+Headers).
 */

export const DEFAULT_ALLOWED_ORIGINS = ['https://keciorenisitme.com', 'http://localhost:4321'];

export function parseAllowedOrigins(raw: string | undefined): ReadonlySet<string> {
  const list = (raw ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return new Set(list.length > 0 ? list : DEFAULT_ALLOWED_ORIGINS);
}

export function isAllowedOrigin(origin: string | null, allowed: ReadonlySet<string>): origin is string {
  return origin !== null && allowed.has(origin);
}

/** İzinli kaynakların hostname'leri (Turnstile `hostname` alanıyla karşılaştırmak için). */
export function allowedHostnames(allowed: ReadonlySet<string>): ReadonlySet<string> {
  const hosts = new Set<string>();
  for (const o of allowed) {
    try {
      hosts.add(new URL(o).hostname);
    } catch {
      /* geçersiz kaynak — yoksay */
    }
  }
  return hosts;
}

export function corsHeaders(origin: string | null, allowed: ReadonlySet<string>): Headers {
  const h = new Headers();
  // Yanıt Origin'e göre değiştiği için ara önbelleklere haber ver (izin verilmese bile).
  h.set('Vary', 'Origin');
  if (isAllowedOrigin(origin, allowed)) {
    h.set('Access-Control-Allow-Origin', origin);
  }
  return h;
}

export function handlePreflight(request: Request, allowed: ReadonlySet<string>): Response {
  const origin = request.headers.get('Origin');
  const requestedMethod = request.headers.get('Access-Control-Request-Method');

  if (origin !== null && requestedMethod !== null) {
    if (!isAllowedOrigin(origin, allowed)) return new Response(null, { status: 403, headers: { Vary: 'Origin' } });
    const h = corsHeaders(origin, allowed);
    h.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    h.set('Access-Control-Allow-Headers', request.headers.get('Access-Control-Request-Headers') || 'Content-Type');
    h.set('Access-Control-Max-Age', '86400');
    return new Response(null, { status: 204, headers: h });
  }
  // Preflight olmayan düz OPTIONS
  return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS' } });
}

/** Yanıta CORS başlıklarını ekler (gövdeye dokunmadan). */
export function applyCors(response: Response, origin: string | null, allowed: ReadonlySet<string>): Response {
  const out = new Response(response.body, response);
  corsHeaders(origin, allowed).forEach((value, key) => out.headers.set(key, value));
  return out;
}
