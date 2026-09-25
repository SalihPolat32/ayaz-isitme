/**
 * Cloudflare Turnstile sunucu tarafı doğrulaması.
 * https://challenges.cloudflare.com/turnstile/v0/siteverify — her token yalnızca bir kez doğrulanır (300 sn ömür).
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 8_000;

interface SiteverifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

export type TurnstileOutcome =
  | { status: 'skipped' } // gizli anahtar tanımlı değil
  | { status: 'ok' }
  | { status: 'failed'; codes: string[] } // token yok / geçersiz / süresi dolmuş / hostname uyuşmaz
  | { status: 'unavailable' }; // siteverify'a ulaşılamadı

export interface VerifyTurnstileInput {
  secret: string | undefined;
  token: unknown;
  remoteIp: string;
  /** Doluysa yanıttaki hostname bu kümede olmalı. */
  allowedHostnames?: ReadonlySet<string>;
}

export async function verifyTurnstile(input: VerifyTurnstileInput, fetchImpl: typeof fetch = fetch): Promise<TurnstileOutcome> {
  if (!input.secret) return { status: 'skipped' };

  const token = typeof input.token === 'string' ? input.token.trim() : '';
  if (!token || token.length > 2048) return { status: 'failed', codes: ['missing-input-response'] };

  let data: SiteverifyResponse;
  try {
    const res = await fetchImpl(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: input.secret,
        response: token,
        remoteip: input.remoteIp === 'unknown' ? undefined : input.remoteIp,
        idempotency_key: crypto.randomUUID(),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error('[turnstile] siteverify HTTP', res.status);
      return { status: 'unavailable' };
    }
    data = (await res.json()) as SiteverifyResponse;
  } catch (e) {
    console.error('[turnstile] siteverify erişilemedi', e instanceof Error ? e.message : e);
    return { status: 'unavailable' };
  }

  if (!data.success) return { status: 'failed', codes: data['error-codes'] ?? ['unknown'] };

  if (input.allowedHostnames && input.allowedHostnames.size > 0 && data.hostname && !input.allowedHostnames.has(data.hostname)) {
    return { status: 'failed', codes: ['hostname-mismatch'] };
  }
  return { status: 'ok' };
}
