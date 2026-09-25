import { describe, expect, it, vi } from 'vitest';
import { selectMailProvider } from '../src/providers';
import { brevoProvider } from '../src/providers/brevo';
import { mockProvider } from '../src/providers/mock';
import { resendProvider } from '../src/providers/resend';
import { sendTelegram } from '../src/providers/telegram';
import { parseAddress } from '../src/providers/types';
import { APPOINTMENT_RATE_LIMIT, REVIEWS_RATE_LIMIT, checkRateLimit } from '../src/ratelimit';
import { verifyTurnstile } from '../src/turnstile';

interface Call {
  url: string;
  init: RequestInit;
  body: Record<string, unknown>;
}

/** Ağ yok: verilen durum/gövdeyi döndüren sahte fetch; yapılan çağrıları kaydeder. */
function fakeFetch(status: number, body: unknown) {
  const calls: Call[] = [];
  const fn = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {}, body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {} });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const throwingFetch = (async () => {
  throw new TypeError('fetch failed');
}) as unknown as typeof fetch;

const message = {
  from: 'Ayaz Isitme Randevu <randevu@keciorenisitme.com>',
  to: 'ayazisitmecihazlari@gmail.com',
  subject: 'Yeni randevu talebi — keciorenisitme.com',
  text: 'Telefon: 0507 155 11 51',
  html: '<p>Telefon: 0507 155 11 51</p>',
};

// ---------------------------------------------------------------------------
describe('parseAddress', () => {
  it('ad ve adresi ayırır', () => {
    expect(parseAddress('Ayaz <randevu@keciorenisitme.com>')).toEqual({ name: 'Ayaz', email: 'randevu@keciorenisitme.com' });
    expect(parseAddress('"Ayaz Isitme" <randevu@keciorenisitme.com>')).toEqual({ name: 'Ayaz Isitme', email: 'randevu@keciorenisitme.com' });
    expect(parseAddress('  plain@example.com ')).toEqual({ email: 'plain@example.com' });
  });
});

// ---------------------------------------------------------------------------
describe('resendProvider', () => {
  it('doğru uç nokta, Bearer ve gövde; başarılı yanıt id döndürür', async () => {
    const { fn, calls } = fakeFetch(200, { id: 'msg_123' });
    const result = await resendProvider('re_test', fn).send(message);

    expect(result).toEqual({ ok: true, provider: 'resend', id: 'msg_123' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.resend.com/emails');
    expect(calls[0]?.init.method).toBe('POST');
    expect(new Headers(calls[0]?.init.headers).get('Authorization')).toBe('Bearer re_test');
    expect(calls[0]?.body).toEqual({ from: message.from, to: [message.to], subject: message.subject, text: message.text, html: message.html });
  });

  it('hata yanıtını kısa özetler', async () => {
    const { fn } = fakeFetch(422, { statusCode: 422, name: 'validation_error', message: 'The from address is not verified' });
    const result = await resendProvider('re_test', fn).send(message);
    expect(result.ok).toBe(false);
    expect(result.provider).toBe('resend');
    expect(result.error).toBe('422 validation_error The from address is not verified');
  });
});

// ---------------------------------------------------------------------------
describe('brevoProvider', () => {
  it('api-key başlığı ve Brevo gövde biçimi; 201 messageId döndürür', async () => {
    const { fn, calls } = fakeFetch(201, { messageId: '<abc@relay.brevo.com>' });
    const result = await brevoProvider('xkeysib-test', fn).send(message);

    expect(result).toEqual({ ok: true, provider: 'brevo', id: '<abc@relay.brevo.com>' });
    expect(calls[0]?.url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(new Headers(calls[0]?.init.headers).get('api-key')).toBe('xkeysib-test');
    expect(calls[0]?.body).toEqual({
      sender: { name: 'Ayaz Isitme Randevu', email: 'randevu@keciorenisitme.com' },
      to: [{ email: 'ayazisitmecihazlari@gmail.com' }],
      subject: message.subject,
      textContent: message.text,
      htmlContent: message.html,
    });
  });

  it('hata yanıtını kısa özetler', async () => {
    const { fn } = fakeFetch(401, { code: 'unauthorized', message: 'Key not found' });
    const result = await brevoProvider('bad', fn).send(message);
    expect(result).toEqual({ ok: false, provider: 'brevo', error: '401 unauthorized Key not found' });
  });
});

// ---------------------------------------------------------------------------
describe('mockProvider', () => {
  it('göndermez, ok döner ve gövdeyi loglamaz', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await mockProvider.send(message);
    expect(result).toEqual({ ok: true, provider: 'mock', id: 'mock' });
    const logged = spy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logged).toContain('[mail:mock]');
    expect(logged).not.toContain('0507 155 11 51');
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
describe('selectMailProvider', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

  it('MAIL_PROVIDER + anahtar eşleşmesi', () => {
    expect(selectMailProvider({ MAIL_PROVIDER: 'resend', RESEND_API_KEY: 'k' }).name).toBe('resend');
    expect(selectMailProvider({ MAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'k' }).name).toBe('brevo');
    expect(selectMailProvider({ MAIL_PROVIDER: 'mock', RESEND_API_KEY: 'k' }).name).toBe('mock');
    expect(selectMailProvider({ MAIL_PROVIDER: 'RESEND', RESEND_API_KEY: 'k' }).name).toBe('resend');
  });

  it('anahtar yoksa mock’a düşer', () => {
    expect(selectMailProvider({ MAIL_PROVIDER: 'resend' }).name).toBe('mock');
    expect(selectMailProvider({ MAIL_PROVIDER: 'brevo' }).name).toBe('mock');
    expect(selectMailProvider({}).name).toBe('mock');
  });

  it('MAIL_PROVIDER boşsa anahtarı olan ilk sağlayıcı', () => {
    expect(selectMailProvider({ RESEND_API_KEY: 'k', BREVO_API_KEY: 'k' }).name).toBe('resend');
    expect(selectMailProvider({ BREVO_API_KEY: 'k' }).name).toBe('brevo');
    expect(selectMailProvider({ MAIL_PROVIDER: 'sendgrid', BREVO_API_KEY: 'k' }).name).toBe('brevo');
  });

  warn.mockRestore();
});

// ---------------------------------------------------------------------------
describe('sendTelegram', () => {
  it('yapılandırma yoksa fetch etmeden false', async () => {
    const { fn, calls } = fakeFetch(200, { ok: true });
    expect(await sendTelegram(undefined, '1', 'x', fn)).toBe(false);
    expect(await sendTelegram('t', undefined, 'x', fn)).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('sendMessage çağrısı ve 4096 karakter sınırı', async () => {
    const { fn, calls } = fakeFetch(200, { ok: true, result: {} });
    expect(await sendTelegram('123:ABC', '-1001', 'y'.repeat(5000), fn)).toBe(true);
    expect(calls[0]?.url).toBe('https://api.telegram.org/bot123:ABC/sendMessage');
    expect(calls[0]?.body.chat_id).toBe('-1001');
    expect(String(calls[0]?.body.text)).toHaveLength(4096);
    expect(calls[0]?.body).not.toHaveProperty('parse_mode');
  });

  it('HTTP hatası veya ağ hatası → false, istisna fırlatmaz', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await sendTelegram('t', 'c', 'x', fakeFetch(400, { ok: false }).fn)).toBe(false);
    expect(await sendTelegram('t', 'c', 'x', throwingFetch)).toBe(false);
    err.mockRestore();
  });
});

// ---------------------------------------------------------------------------
describe('verifyTurnstile', () => {
  const hosts = new Set(['keciorenisitme.com', 'localhost']);

  it('gizli anahtar yoksa atlanır', async () => {
    const { fn, calls } = fakeFetch(200, { success: true });
    expect(await verifyTurnstile({ secret: undefined, token: 'tok', remoteIp: '1.2.3.4' }, fn)).toEqual({ status: 'skipped' });
    expect(calls).toHaveLength(0);
  });

  it('token yoksa fetch etmeden failed', async () => {
    const { fn, calls } = fakeFetch(200, { success: true });
    expect(await verifyTurnstile({ secret: 's', token: undefined, remoteIp: '1.2.3.4' }, fn)).toEqual({
      status: 'failed',
      codes: ['missing-input-response'],
    });
    expect(await verifyTurnstile({ secret: 's', token: 42, remoteIp: '1.2.3.4' }, fn)).toMatchObject({ status: 'failed' });
    expect(calls).toHaveLength(0);
  });

  it('siteverify gövdesi doğru; başarılı ve hostname izinli → ok', async () => {
    const { fn, calls } = fakeFetch(200, { success: true, hostname: 'keciorenisitme.com', 'error-codes': [] });
    const out = await verifyTurnstile({ secret: 'sec', token: 'tok', remoteIp: '1.2.3.4', allowedHostnames: hosts }, fn);
    expect(out).toEqual({ status: 'ok' });
    expect(calls[0]?.url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(calls[0]?.body).toMatchObject({ secret: 'sec', response: 'tok', remoteip: '1.2.3.4' });
    expect(typeof calls[0]?.body.idempotency_key).toBe('string');
  });

  it("IP bilinmiyorsa remoteip gönderilmez", async () => {
    const { fn, calls } = fakeFetch(200, { success: true });
    await verifyTurnstile({ secret: 'sec', token: 'tok', remoteIp: 'unknown' }, fn);
    expect(calls[0]?.body).not.toHaveProperty('remoteip');
  });

  it('hostname uyuşmazlığı → failed', async () => {
    const { fn } = fakeFetch(200, { success: true, hostname: 'evil.example' });
    expect(await verifyTurnstile({ secret: 's', token: 't', remoteIp: '1.1.1.1', allowedHostnames: hosts }, fn)).toEqual({
      status: 'failed',
      codes: ['hostname-mismatch'],
    });
  });

  it('başarısız doğrulama hata kodlarıyla döner', async () => {
    const { fn } = fakeFetch(200, { success: false, 'error-codes': ['timeout-or-duplicate'] });
    expect(await verifyTurnstile({ secret: 's', token: 't', remoteIp: '1.1.1.1' }, fn)).toEqual({
      status: 'failed',
      codes: ['timeout-or-duplicate'],
    });
  });

  it('siteverify erişilemezse unavailable (istisna yok)', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await verifyTurnstile({ secret: 's', token: 't', remoteIp: '1.1.1.1' }, fakeFetch(500, {}).fn)).toEqual({ status: 'unavailable' });
    expect(await verifyTurnstile({ secret: 's', token: 't', remoteIp: '1.1.1.1' }, throwingFetch)).toEqual({ status: 'unavailable' });
    err.mockRestore();
  });
});

// ---------------------------------------------------------------------------
describe('checkRateLimit', () => {
  const fakeLimiter = (success: boolean) => {
    const keys: string[] = [];
    const limiter = { limit: async ({ key }: { key: string }) => (keys.push(key), { success }) } as unknown as RateLimit;
    return { limiter, keys };
  };

  const fakeKv = () => {
    const store = new Map<string, string>();
    const ttls: number[] = [];
    const kv = {
      get: async (k: string) => store.get(k) ?? null,
      put: async (k: string, v: string, opts?: { expirationTtl?: number }) => {
        store.set(k, v);
        if (opts?.expirationTtl) ttls.push(opts.expirationTtl);
      },
    } as unknown as KVNamespace;
    return { kv, store, ttls };
  };

  it('binding varsa onu kullanır', async () => {
    const ok = fakeLimiter(true);
    expect(await checkRateLimit({ limiter: ok.limiter }, 'appt:1.2.3.4', APPOINTMENT_RATE_LIMIT)).toEqual({ allowed: true, source: 'binding' });
    expect(ok.keys).toEqual(['appt:1.2.3.4']);
    const blocked = fakeLimiter(false);
    expect(await checkRateLimit({ limiter: blocked.limiter }, 'appt:1.2.3.4', APPOINTMENT_RATE_LIMIT)).toEqual({ allowed: false, source: 'binding' });
  });

  it('binding yoksa KV sabit pencere sayacı; limit aşımında reddeder', async () => {
    const { kv, ttls } = fakeKv();
    const now = 1_800_000_000_000;
    const opts = { limit: 3, windowSeconds: 60 };
    for (let i = 0; i < 3; i++) expect((await checkRateLimit({ kv }, 'appt:ip', opts, now)).allowed).toBe(true);
    expect(await checkRateLimit({ kv }, 'appt:ip', opts, now)).toEqual({ allowed: false, source: 'kv' });
    // Yeni pencere → sayaç sıfırlanır
    expect((await checkRateLimit({ kv }, 'appt:ip', opts, now + 60_000)).allowed).toBe(true);
    // Başka IP etkilenmez
    expect((await checkRateLimit({ kv }, 'appt:other', opts, now)).allowed).toBe(true);
    expect(ttls.every((t) => t >= 60)).toBe(true);
  });

  it('hiçbir binding yoksa izin verir ve kaynağı none olarak bildirir', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await checkRateLimit({}, 'nolimiter:ip', APPOINTMENT_RATE_LIMIT)).toEqual({ allowed: true, source: 'none' });
    warn.mockRestore();
  });
});

describe('sabit limitler', () => {
  it('form 5/60 sn, yorumlar 30/60 sn', () => {
    expect(APPOINTMENT_RATE_LIMIT).toEqual({ limit: 5, windowSeconds: 60 });
    expect(REVIEWS_RATE_LIMIT).toEqual({ limit: 30, windowSeconds: 60 });
  });
});
